<?php
/**
 * Command framework (docs/API-CONTRACT.md):
 *
 * - Every POST command carries an Idempotency-Key header. The key is stored with the response inside the
 *   command's transaction; repeating the key returns the stored response and runs nothing again. The same
 *   key with a different body is refused (422).
 * - All writes of a command (records, numbers, audit rows, the key itself) are one InnoDB transaction;
 *   any error rolls everything back.
 * - A command on an existing mutable record must send the version it read (409 when stale).
 * - A deadlock or lock wait timeout aborts the whole command with 409 `akph_retry` (data.retryable = true);
 *   the key is not stored either, so the same command may be sent again with the same key.
 * - The response lists the changed records: { message, records: { slice: [record, ...] }, id?, doc_number? }.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_Command {
    const KEY_PATTERN = '/^[A-Za-z0-9_-]{8,100}$/D';
    /** Stored keys older than this are purged by the daily cron. */
    const KEY_TTL_DAYS = 30;

    /**
     * @param callable $handler function (array $body, WP_REST_Request $request): array
     *        returns ['message' => string, 'records' => [...], 'id' => ?, 'doc_number' => ?, 'status' => ?int]
     */
    public static function run(WP_REST_Request $request, callable $handler) {
        global $wpdb;
        $user_id = get_current_user_id();
        $key = $request->get_header('Idempotency-Key');
        if (!is_string($key) || !preg_match(self::KEY_PATTERN, $key)) {
            return new WP_Error('akph_idempotency_key_required', 'سربرگ Idempotency-Key (۸ تا ۱۰۰ نویسه) برای هر فرمان لازم است.', array('status' => 400));
        }
        $body = $request->get_json_params();
        if ($body === null) {
            $raw = trim((string) $request->get_body());
            if ($raw !== '') {
                return new WP_Error('akph_invalid_json', 'بدنه درخواست JSON معتبر نیست.', array('status' => 400));
            }
            $body = array();
        }
        if (!is_array($body)) {
            return new WP_Error('akph_invalid_json', 'بدنه درخواست باید یک شیء JSON باشد.', array('status' => 400));
        }
        $route = substr($request->get_method() . ' ' . $request->get_route(), 0, 191);
        $hash = hash('sha256', $route . "\n" . wp_json_encode(self::canonical($body)));

        $keys = Akph_Schema::table('idempotency_keys');
        $suppress = $wpdb->suppress_errors(true);
        try {
            $stored = self::find_key($user_id, $key);
            if ($stored) {
                return self::replay($stored, $hash, $route);
            }
            Akph_Db::begin();
            // Claim the key first: a concurrent request with the same key waits on this row, then replays.
            $key_id = Akph_Db::try_insert($keys, array(
                'user_id' => $user_id,
                'idem_key' => $key,
                'route' => $route,
                'request_hash' => $hash,
                'status_code' => 0,
                'response' => null,
                'created_at' => Akph_Db::now_utc(),
            ));
            if ($key_id === false) {
                Akph_Db::rollback();
                $stored = self::find_key($user_id, $key);
                return $stored ? self::replay($stored, $hash, $route) : Akph_Error::retry()->to_wp_error();
            }
            Akph_Audit::set_request_key($key);
            $result = $handler($body, $request);
            $status = isset($result['status']) ? (int) $result['status'] : 200;
            unset($result['status']);
            $response = self::shape($result);
            Akph_Db::update($keys, array('status_code' => $status, 'response' => wp_json_encode($response)), array('id' => $key_id));
            Akph_Db::commit();
            Akph_Auth::flush();
            return new WP_REST_Response($response, $status);
        } catch (Akph_Error $e) {
            // Includes 409 akph_retry (deadlock, lock wait timeout): nothing is kept, not even the key, so the
            // client may send the same command again with the same Idempotency-Key.
            Akph_Db::rollback();
            Akph_Auth::flush();
            return $e->to_wp_error();
        } catch (Throwable $e) {
            Akph_Db::rollback();
            Akph_Auth::flush();
            error_log('[akph-portal] command failed: ' . $e->getMessage());
            return new WP_Error('akph_server_error', 'خطای سرور؛ هیچ تغییری ذخیره نشد.', array('status' => 500));
        } finally {
            $wpdb->suppress_errors($suppress);
            Akph_Audit::set_request_key('');
        }
    }

    private static function find_key($user_id, $key) {
        global $wpdb;
        return Akph_Db::row($wpdb->prepare('SELECT * FROM ' . Akph_Schema::table('idempotency_keys') . ' WHERE user_id = %d AND idem_key = %s', $user_id, $key));
    }

    private static function replay($stored, $hash, $route) {
        if (!hash_equals((string) $stored->request_hash, $hash) || $stored->route !== $route) {
            return new WP_Error('akph_idempotency_mismatch', 'این Idempotency-Key قبلاً برای درخواست دیگری به کار رفته است.', array('status' => 422));
        }
        if ((int) $stored->status_code === 0 || $stored->response === null) {
            return new WP_Error('akph_in_progress', 'همین درخواست در حال اجراست؛ کمی بعد دوباره تلاش کنید.', array('status' => 409));
        }
        $data = json_decode($stored->response, true);
        if (is_array($data) && isset($data['records']) && $data['records'] === array()) {
            $data['records'] = new stdClass(); // an empty `records` stays {} exactly as in the first response
        }
        $response = new WP_REST_Response($data, (int) $stored->status_code);
        $response->header('Idempotency-Replayed', 'true');
        return $response;
    }

    /** Response body: records keyed by slice, lists always arrays. */
    private static function shape(array $result) {
        $out = array('message' => isset($result['message']) ? (string) $result['message'] : '', 'records' => new stdClass());
        if (!empty($result['records'])) {
            $out['records'] = $result['records'];
        }
        foreach (array('id', 'doc_number') as $k) {
            if (isset($result[$k])) {
                $out[$k] = (string) $result[$k];
            }
        }
        return $out;
    }

    /** Object keys sorted recursively, so the same body always hashes the same. */
    private static function canonical($value) {
        if (!is_array($value)) {
            return $value;
        }
        $is_list = array_keys($value) === range(0, count($value) - 1);
        $out = array();
        foreach ($value as $k => $v) {
            $out[$k] = self::canonical($v);
        }
        if (!$is_list) {
            ksort($out);
        }
        return $out;
    }

    public static function purge_old_keys() {
        global $wpdb;
        $cutoff = gmdate('Y-m-d H:i:s', time() - self::KEY_TTL_DAYS * DAY_IN_SECONDS);
        Akph_Db::exec($wpdb->prepare('DELETE FROM ' . Akph_Schema::table('idempotency_keys') . ' WHERE created_at < %s', $cutoff));
    }
}
