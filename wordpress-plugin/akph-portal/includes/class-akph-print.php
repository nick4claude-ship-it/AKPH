<?php
/**
 * «تنظیمات گزارش و چاپ» and the signature slots of printed records (0.6.1, docs/API-CONTRACT.md).
 *
 * - Letterhead: official company name, national id, registration number, address, phone and logo. The logo is
 *   uploaded like an avatar: JPG, PNG or WebP up to 2 MB, checked by content and re-encoded (at most 600 px on
 *   the longer side, proportions kept) into the media library; the previous logo is deleted.
 * - Signatories: for each report type a list of slots, each a position title («تهیه‌کننده», «حسابدار» …) with
 *   an optional portal user (the name is the user's display name) or a name typed by hand. The default is
 *   the titles only, without names. Nothing of the sample data is ever used.
 * - Everything is one versioned row (table report_settings, id 1): a change sends the version it read
 *   (body or If-Match; 409 when stale), runs as a command (Idempotency-Key, one transaction) and is audited.
 *   Only the system administrator (akph_report_settings) changes it; every portal user reads it to print.
 * - Signature slots of a record with an approval workflow (journal entry, petty cash expense and replenishment,
 *   payment request, receipt) come from the server's approval history: the real name and time of every
 *   signed step; a step not signed yet stays empty (the print shows the signature line only).
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_Print {
    const ROW_ID = 1;
    const LOGO_MAX_BYTES = 2097152;
    const LOGO_MAX_SIDE_IN = 6000;
    const LOGO_SIDE = 600;
    const LOGO_MIMES = array('jpg|jpeg|jpe' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp');
    /** Post meta of the logo attachment (only such an attachment is ever deleted here). */
    const LOGO_META = '_akph_report_logo';
    const MAX_SLOTS = 6;
    const DEFAULT_LEGAL_NAME = 'آریا کاوش پی هامون';
    const DEFAULT_TITLES = array('تهیه‌کننده', 'حسابدار', 'مدیر مالی', 'مدیرعامل');

    /**
     * Report types: key => [label, has an approval workflow]. For a workflow type the automatic slots of the
     * record come first and the configured slots are added after them (default: none).
     */
    public static function report_types() {
        return array(
            'projects' => array('گزارش پروژه‌ها', false),
            'management' => array('گزارش مدیریتی و هوش تجاری', false),
            'financial' => array('گزارش‌های مالی (ترازنامه، سود و زیان، تراز)', false),
            'journal_entry' => array('سند حسابداری', true),
            'petty_cash' => array('گزارش‌ها و صورتجلسه تنخواه', false),
            'petty_expense' => array('هزینه تنخواه', true),
            'payment_request' => array('درخواست پرداخت', true),
            'receipt' => array('رسید دریافت', true),
            'contracts' => array('گزارش قراردادها', false),
            'client_statement' => array('صورت‌وضعیت کارفرما', true),
            'subcontractor_statement' => array('صورت‌وضعیت پیمانکار جزء', true),
            'purchase_order' => array('سفارش خرید', false),
            'inventory' => array('اسناد و کاردکس انبار', false),
            'payroll' => array('حقوق و دستمزد', false),
        );
    }

    private static function t() {
        return Akph_Schema::table('report_settings');
    }

    // ------------------------------------------------------------------ reads

    private static function row($lock = false) {
        $row = $lock ? Akph_Db::lock(self::t(), self::ROW_ID) : Akph_Db::find(self::t(), self::ROW_ID);
        if ($row) {
            return $row;
        }
        // First use: the default row (titles only, no names). A concurrent first insert is harmless.
        Akph_Db::try_insert(self::t(), array('id' => self::ROW_ID, 'settings' => wp_json_encode(self::defaults()), 'logo_id' => null, 'version' => 1, 'updated_by' => 0, 'updated_at' => Akph_Db::now_utc()));
        return $lock ? Akph_Db::lock(self::t(), self::ROW_ID) : Akph_Db::find(self::t(), self::ROW_ID);
    }

    public static function defaults() {
        $signatories = array();
        foreach (self::report_types() as $key => $def) {
            $signatories[$key] = $def[1] ? array() : array_map(function ($title) {
                return array('title' => $title, 'user_id' => null, 'name' => '');
            }, self::DEFAULT_TITLES);
        }
        return array(
            'company' => array('legal_name' => self::DEFAULT_LEGAL_NAME, 'national_id' => '', 'registration_number' => '', 'economic_code' => '', 'address' => '', 'phone' => ''),
            'signatories' => $signatories,
        );
    }

    private static function stored($row) {
        $d = self::defaults();
        $s = json_decode((string) $row->settings, true);
        $s = is_array($s) ? $s : array();
        $company = isset($s['company']) && is_array($s['company']) ? array_merge($d['company'], array_intersect_key($s['company'], $d['company'])) : $d['company'];
        $signatories = $d['signatories'];
        if (isset($s['signatories']) && is_array($s['signatories'])) {
            foreach ($s['signatories'] as $type => $slots) {
                if (isset($signatories[$type]) && is_array($slots)) {
                    $signatories[$type] = array_values($slots);
                }
            }
        }
        return array('company' => $company, 'signatories' => $signatories);
    }

    /** GET /report-settings: what every portal user needs to print (no e-mail, no other user data). */
    public static function shape($row = null) {
        $row = $row ?: self::row();
        $s = self::stored($row);
        $types = array();
        foreach (self::report_types() as $key => $def) {
            $types[] = array('key' => $key, 'label' => $def[0], 'workflow' => $def[1]);
        }
        $signatories = array();
        foreach ($s['signatories'] as $type => $slots) {
            $signatories[$type] = array_map(function ($slot) {
                $uid = !empty($slot['user_id']) ? (int) $slot['user_id'] : 0;
                $name = $uid ? Akph_Flow::user_name($uid) : (string) $slot['name'];
                return array('title' => (string) $slot['title'], 'user_id' => $uid ? (string) $uid : null, 'name' => $name);
            }, $slots);
        }
        $logo = $row->logo_id ? wp_get_attachment_url((int) $row->logo_id) : false;
        return array(
            'company' => array_merge($s['company'], array('logo_url' => $logo ? $logo : null)),
            'signatories' => $signatories,
            'report_types' => $types,
            'version' => (int) $row->version,
            'updated_at' => Akph_Db::iso_time($row->updated_at),
        );
    }

    /** Portal users a slot may name (system administrator's picker): id and display name only. */
    public static function portal_users() {
        $users = get_users(array('role__in' => array_keys(Akph_Roles::PORTAL_ROLES), 'orderby' => 'display_name', 'number' => 500, 'fields' => array('ID', 'display_name')));
        $out = array();
        foreach ($users as $u) {
            $out[] = array('id' => (string) $u->ID, 'name' => $u->display_name, 'role' => Akph_Roles::label(Akph_Roles::role_of(get_userdata($u->ID))));
        }
        return $out;
    }

    // ------------------------------------------------------------------ commands

    private static function assert_admin() {
        Akph_Auth::assert_cap(Akph_Roles::REPORT_SETTINGS, 'تنظیمات گزارش و چاپ فقط با نقش مدیر سیستم قابل تغییر است.');
    }

    /** POST /report-settings { company?, signatories?, version } */
    public static function update(array $body, $version) {
        self::assert_admin();
        $row = self::row(true);
        Akph_Input::assert_version($row, $version);
        $before = self::stored($row);
        $after = $before;
        if (array_key_exists('company', $body)) {
            $after['company'] = self::parse_company($body['company'], $before['company']);
        }
        if (array_key_exists('signatories', $body)) {
            if (!is_array($body['signatories'])) {
                throw Akph_Error::invalid('امضاکنندگان باید فهرستی برای هر نوع گزارش باشد.', array('field' => 'signatories'));
            }
            foreach ($body['signatories'] as $type => $slots) {
                if (!isset(self::report_types()[$type])) {
                    throw Akph_Error::invalid('نوع گزارش ناشناخته: ' . $type, array('field' => 'signatories'));
                }
                $after['signatories'][$type] = self::parse_slots($slots, $type);
            }
        }
        Akph_Db::update(self::t(), array('settings' => wp_json_encode($after), 'version' => (int) $row->version + 1, 'updated_by' => get_current_user_id(), 'updated_at' => Akph_Db::now_utc()), array('id' => self::ROW_ID));
        Akph_Audit::log('report_settings', 'report_settings', self::ROW_ID, $before, $after);
        return array('message' => 'تنظیمات گزارش و چاپ ذخیره شد.', 'records' => array('report_settings' => array(self::shape(self::row()))));
    }

    private static function parse_company($value, array $current) {
        if (!is_array($value)) {
            throw Akph_Error::invalid('مشخصات شرکت باید شیء باشد.', array('field' => 'company'));
        }
        $labels = array('legal_name' => 'نام رسمی شرکت', 'national_id' => 'شناسه ملی', 'registration_number' => 'شماره ثبت', 'economic_code' => 'کد اقتصادی', 'address' => 'نشانی', 'phone' => 'تلفن');
        $out = $current;
        foreach ($value as $key => $v) {
            if (!isset($labels[$key])) {
                throw new Akph_Error('akph_unknown_field', 'فیلد ناشناخته: company.' . $key, 400, array('field' => 'company.' . $key));
            }
            $out[$key] = Akph_Input::text($value, $key, $key === 'address' ? 300 : 190, $key === 'legal_name', $labels[$key]);
        }
        if ($out['national_id'] !== '' && !preg_match('/^[0-9]{10,11}$/D', $out['national_id'])) {
            throw Akph_Error::invalid('شناسه ملی باید ۱۰ یا ۱۱ رقم باشد.', array('field' => 'company.national_id'));
        }
        if ($out['registration_number'] !== '' && !preg_match('/^[0-9]{1,12}$/D', $out['registration_number'])) {
            throw Akph_Error::invalid('شماره ثبت باید فقط رقم باشد.', array('field' => 'company.registration_number'));
        }
        if ($out['economic_code'] !== '' && !preg_match('/^[0-9]{10,14}$/D', $out['economic_code'])) {
            throw Akph_Error::invalid('کد اقتصادی باید ۱۰ تا ۱۴ رقم باشد.', array('field' => 'company.economic_code'));
        }
        if ($out['phone'] !== '' && !preg_match('/^[0-9+\-\s()]{5,40}$/D', $out['phone'])) {
            throw Akph_Error::invalid('تلفن فقط رقم، فاصله، + و - می‌پذیرد.', array('field' => 'company.phone'));
        }
        return $out;
    }

    private static function parse_slots($slots, $type) {
        if (!is_array($slots) || ($slots && array_keys($slots) !== range(0, count($slots) - 1))) {
            throw Akph_Error::invalid('جایگاه‌های امضا باید فهرست باشد.', array('field' => 'signatories.' . $type));
        }
        if (count($slots) > self::MAX_SLOTS) {
            throw Akph_Error::invalid('حداکثر ' . self::MAX_SLOTS . ' جایگاه امضا برای هر گزارش.', array('field' => 'signatories.' . $type));
        }
        $out = array();
        foreach ($slots as $slot) {
            if (!is_array($slot)) {
                throw Akph_Error::invalid('جایگاه امضا نامعتبر است.', array('field' => 'signatories.' . $type));
            }
            foreach (array_keys($slot) as $key) {
                if (!in_array($key, array('title', 'user_id', 'name'), true)) {
                    throw new Akph_Error('akph_unknown_field', 'فیلد ناشناخته: ' . $key, 400, array('field' => 'signatories.' . $type));
                }
            }
            $title = Akph_Input::text($slot, 'title', 60, true, 'عنوان جایگاه');
            $uid = Akph_Input::id($slot, 'user_id');
            if ($uid && !Akph_Roles::role_of(get_userdata($uid))) {
                throw Akph_Error::invalid('کاربر انتخاب‌شده برای «' . $title . '» کاربر پرتال نیست.', array('field' => 'signatories.' . $type));
            }
            $name = $uid ? '' : Akph_Input::text($slot, 'name', 80, false, 'نام امضاکننده');
            $out[] = array('title' => $title, 'user_id' => $uid ? $uid : null, 'name' => $name);
        }
        return $out;
    }

    /** POST /report-settings/logo (multipart, file field `logo`; version in If-Match) */
    public static function upload_logo(WP_REST_Request $request, $version) {
        self::assert_admin();
        $files = (array) $request->get_file_params();
        foreach (array_keys($files) as $key) {
            if ($key !== 'logo') {
                throw new Akph_Error('akph_unknown_field', 'فیلد ناشناخته: ' . $key, 400, array('field' => (string) $key));
            }
        }
        foreach (array_keys((array) $request->get_body_params()) as $key) {
            if ($key !== 'version' && !Akph_Input::is_wp_global($key)) {
                throw new Akph_Error('akph_unknown_field', 'فیلد ناشناخته: ' . $key, 400, array('field' => (string) $key));
            }
        }
        if (empty($files['logo']) || !is_array($files['logo']) || is_array($files['logo']['name'] ?? null)) {
            throw Akph_Error::invalid('فایل لوگو (logo) فرستاده نشده است.', array('field' => 'logo'));
        }
        $row = self::row(true);
        Akph_Input::assert_version($row, $version);
        $file = $files['logo'];
        $error = isset($file['error']) ? (int) $file['error'] : UPLOAD_ERR_NO_FILE;
        if ($error === UPLOAD_ERR_INI_SIZE || $error === UPLOAD_ERR_FORM_SIZE) {
            throw self::too_large();
        }
        $tmp = isset($file['tmp_name']) ? (string) $file['tmp_name'] : '';
        if ($error !== UPLOAD_ERR_OK || $tmp === '' || !is_file($tmp)) {
            throw Akph_Error::invalid('بارگذاری فایل انجام نشد؛ دوباره تلاش کنید.', array('field' => 'logo'));
        }
        $size = filesize($tmp);
        if ($size === false || $size <= 0) {
            throw Akph_Error::invalid('فایل خالی است.', array('field' => 'logo'));
        }
        if ($size > self::LOGO_MAX_BYTES) {
            throw self::too_large();
        }
        $check = wp_check_filetype_and_ext($tmp, isset($file['name']) ? (string) $file['name'] : '', self::LOGO_MIMES);
        $info = @getimagesize($tmp); // phpcs:ignore WordPress.PHP.NoSilencedErrors -- a non-image is answered below
        if (empty($check['ext']) || empty($check['type']) || !$info || empty($info['mime']) || $info['mime'] !== $check['type'] || !in_array($info['mime'], self::LOGO_MIMES, true)) {
            throw self::wrong_type();
        }
        $width = (int) $info[0];
        $height = (int) $info[1];
        if ($width < 1 || $height < 1 || $width > self::LOGO_MAX_SIDE_IN || $height > self::LOGO_MAX_SIDE_IN) {
            throw Akph_Error::invalid('ابعاد تصویر باید حداکثر ۶٬۰۰۰ پیکسل باشد.', array('field' => 'logo'));
        }
        $editor = wp_get_image_editor($tmp);
        if (is_wp_error($editor)) {
            throw self::wrong_type();
        }
        // Re-encoding drops metadata and anything hidden in the file; proportions are kept (no crop).
        if (max($width, $height) > self::LOGO_SIDE) {
            $resized = $editor->resize(self::LOGO_SIDE, self::LOGO_SIDE, false);
            if (is_wp_error($resized)) {
                throw self::wrong_type();
            }
        }
        $mime = wp_image_editor_supports(array('mime_type' => $info['mime'])) ? $info['mime'] : 'image/png';
        $ext = array('image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp')[$mime];
        $uploads = wp_upload_dir();
        if (!empty($uploads['error'])) {
            throw new Akph_Error('akph_upload_dir', 'پوشه بارگذاری وردپرس قابل نوشتن نیست؛ به مدیر سیستم اطلاع دهید.', 500);
        }
        $name = wp_unique_filename($uploads['path'], 'akph-logo-' . strtolower(wp_generate_password(8, false, false)) . '.' . $ext);
        $saved = $editor->save(trailingslashit($uploads['path']) . $name, $mime);
        if (is_wp_error($saved) || empty($saved['path'])) {
            throw new Akph_Error('akph_upload_failed', 'ذخیره تصویر انجام نشد.', 500);
        }
        $path = $saved['path'];
        try {
            $attachment = wp_insert_attachment(array(
                'post_mime_type' => $mime,
                'post_title' => 'لوگوی گزارش‌ها',
                'post_content' => '',
                'post_status' => 'inherit',
                'post_author' => get_current_user_id(),
                'guid' => trailingslashit($uploads['url']) . basename($path),
            ), $path, 0, true);
            if (is_wp_error($attachment) || !$attachment) {
                throw new Akph_Error('akph_upload_failed', 'ذخیره تصویر انجام نشد.', 500);
            }
            require_once ABSPATH . 'wp-admin/includes/file.php';
            require_once ABSPATH . 'wp-admin/includes/image.php';
            wp_update_attachment_metadata($attachment, wp_generate_attachment_metadata($attachment, $path));
            update_post_meta($attachment, self::LOGO_META, 1);
            $previous = (int) $row->logo_id;
            Akph_Db::update(self::t(), array('logo_id' => (int) $attachment, 'version' => (int) $row->version + 1, 'updated_by' => get_current_user_id(), 'updated_at' => Akph_Db::now_utc()), array('id' => self::ROW_ID));
            Akph_Audit::log('report_logo', 'report_settings', self::ROW_ID, array('logo_id' => $previous > 0 ? $previous : null), array('logo_id' => (int) $attachment));
        } catch (Throwable $e) {
            if (isset($attachment) && is_int($attachment) && $attachment > 0) {
                wp_delete_attachment($attachment, true);
            }
            if (is_file($path)) {
                wp_delete_file($path);
            }
            throw $e;
        }
        // The old file goes only after the new row is written; a failed command keeps it.
        self::delete_logo_attachment($previous);
        return array('message' => 'لوگو ذخیره شد.', 'records' => array('report_settings' => array(self::shape(self::row()))));
    }

    /** DELETE /report-settings/logo { version } */
    public static function delete_logo($version) {
        self::assert_admin();
        $row = self::row(true);
        Akph_Input::assert_version($row, $version);
        $previous = (int) $row->logo_id;
        if ($previous <= 0) {
            return array('message' => 'لوگویی ثبت نشده بود.', 'records' => array('report_settings' => array(self::shape($row))));
        }
        Akph_Db::update(self::t(), array('logo_id' => null, 'version' => (int) $row->version + 1, 'updated_by' => get_current_user_id(), 'updated_at' => Akph_Db::now_utc()), array('id' => self::ROW_ID));
        Akph_Audit::log('report_logo_removed', 'report_settings', self::ROW_ID, array('logo_id' => $previous), array('logo_id' => null));
        self::delete_logo_attachment($previous);
        return array('message' => 'لوگو حذف شد.', 'records' => array('report_settings' => array(self::shape(self::row()))));
    }

    private static function delete_logo_attachment($attachment_id) {
        if ($attachment_id > 0 && get_post_type($attachment_id) === 'attachment' && get_post_meta($attachment_id, self::LOGO_META, true)) {
            wp_delete_attachment($attachment_id, true);
        }
    }

    private static function too_large() {
        return new Akph_Error('akph_file_too_large', 'حجم تصویر لوگو باید حداکثر ۲ مگابایت باشد.', 413, array('field' => 'logo'));
    }

    private static function wrong_type() {
        return new Akph_Error('akph_file_type', 'فقط تصویر JPG، PNG یا WebP پذیرفته می‌شود.', 415, array('field' => 'logo'));
    }

    // ------------------------------------------------------------------ signature slots of a record

    /** Entity types whose signature slots come from the approval history (key => report type). */
    public static function signature_entities() {
        return apply_filters('akph_signature_entities', array(
            'journal_entry' => 'journal_entry',
            'petty_expense' => 'petty_expense',
            'petty_request' => 'petty_expense',
            'payment_request' => 'payment_request',
            'receipt' => 'receipt',
            'client_statement' => 'client_statement',
            'subcontractor_statement' => 'subcontractor_statement',
        ));
    }

    private static function slot($title, $uid, $at, $role = '') {
        $uid = (int) $uid;
        return array(
            'title' => $title,
            'user_id' => $uid ? (string) $uid : null,
            'name' => $uid ? Akph_Flow::user_name($uid) : '',
            'role' => $role,
            'at' => $uid && $at ? $at : null,
            'signed' => $uid > 0,
            'source' => 'approval',
        );
    }

    /**
     * Approvals of the current round of a history (a return to the submitter or a new submission starts
     * the round again), in order.
     */
    public static function round_approvals(array $history) {
        $approved = array();
        foreach ($history as $h) {
            $action = isset($h['action']) ? $h['action'] : '';
            if ($action === 'submitted' || $action === 'returned' || $action === 'resubmitted') {
                $approved = array();
            } elseif ($action === 'approved') {
                $approved[] = $h;
            }
        }
        return $approved;
    }

    /** Slots of a chain: submitter, then one per step, signed by the round's approvals in order. */
    private static function chain_slots($submitter_title, $submitted_by, $created_at, array $chain, array $history) {
        $slots = array(self::slot($submitter_title, $submitted_by, $created_at));
        $approved = self::round_approvals($history);
        foreach ($chain as $i => $step) {
            $a = isset($approved[$i]) ? $approved[$i] : null;
            $slots[] = self::slot('تأیید ' . $step, $a ? $a['user_id'] : 0, $a ? $a['at'] : null, $a && isset($a['role']) ? $a['role'] : '');
        }
        return $slots;
    }

    /** GET /print/signatures?entity_type=&entity_id= */
    public static function signatures($entity_type, $entity_id) {
        $entities = self::signature_entities();
        if (!isset($entities[$entity_type])) {
            throw Akph_Error::invalid('entity_type باید یکی از این مقادیر باشد: ' . implode('، ', array_keys($entities)), array('field' => 'entity_type'));
        }
        $id = (int) $entity_id;
        $out = apply_filters('akph_signature_slots', null, $entity_type, $id);
        if ($out === null) {
            $out = self::builtin_slots($entity_type, $id);
        }
        $report_type = $entities[$entity_type];
        $settings = self::shape();
        foreach (isset($settings['signatories'][$report_type]) ? $settings['signatories'][$report_type] : array() as $extra) {
            $out['slots'][] = array('title' => $extra['title'], 'user_id' => $extra['user_id'], 'name' => $extra['name'], 'role' => '', 'at' => null, 'signed' => false, 'source' => 'settings');
        }
        return array('entity_type' => $entity_type, 'entity_id' => (string) $id, 'report_type' => $report_type, 'number' => $out['number'], 'slots' => $out['slots']);
    }

    private static function builtin_slots($entity_type, $id) {
        switch ($entity_type) {
            case 'client_statement':
            case 'subcontractor_statement':
                $s = Akph_Statements::statement_or_404($id);
                if (($s->kind === 'client') !== ($entity_type === 'client_statement')) {
                    throw Akph_Error::not_found('صورت‌وضعیت پیدا نشد.');
                }
                return Akph_Statements::signature_slots($id);
            case 'journal_entry':
                Akph_Auth::assert_cap(Akph_Roles::VIEW_ALL, 'اسناد حسابداری در دسترس نقش شما نیست.');
                $row = Akph_Db::find(Akph_Ledger::entries_table(), $id);
                if (!$row) {
                    throw Akph_Error::not_found('سند پیدا نشد.');
                }
                return array('number' => $row->doc_number ?: $row->draft_number, 'slots' => array(
                    self::slot('تهیه‌کننده', $row->created_by, Akph_Db::iso_time($row->created_at)),
                    self::slot('تأییدکننده', $row->status === 'posted' || $row->status === 'reversed' ? $row->approved_by : 0, Akph_Db::iso_time($row->approved_at)),
                ));
            case 'petty_expense':
                $row = Akph_Db::find(Akph_Schema::table('petty_expenses'), $id);
                if (!$row) {
                    throw Akph_Error::not_found('هزینه تنخواه پیدا نشد.');
                }
                Akph_Auth::assert_project($row->project_id);
                return array('number' => $row->number, 'slots' => self::chain_slots('تنخواه‌دار (ثبت‌کننده)', $row->submitted_by, Akph_Db::iso_time($row->created_at), Akph_Flow::chain($row->chain), Akph_Flow::history($row->history)));
            case 'petty_request':
                $row = Akph_Db::find(Akph_Schema::table('petty_requests'), $id);
                if (!$row) {
                    throw Akph_Error::not_found('درخواست شارژ پیدا نشد.');
                }
                Akph_Auth::assert_project($row->project_id);
                return array('number' => $row->number, 'slots' => self::chain_slots('درخواست‌کننده', $row->requested_by, Akph_Db::iso_time($row->created_at), Akph_Flow::chain($row->chain), Akph_Flow::history($row->history)));
            case 'payment_request':
                Akph_Auth::assert_cap(Akph_Roles::VIEW_ALL, 'درخواست‌های پرداخت در دسترس نقش شما نیست.');
                $row = Akph_Db::find(Akph_Schema::table('payment_requests'), $id);
                if (!$row) {
                    throw Akph_Error::not_found('درخواست پرداخت پیدا نشد.');
                }
                Akph_Auth::assert_project($row->project_id);
                global $wpdb;
                $last = Akph_Db::row($wpdb->prepare('SELECT paid_by, created_at FROM ' . Akph_Schema::table('payments') . ' WHERE payment_request_id = %d ORDER BY id DESC LIMIT 1', $id));
                return array('number' => $row->number, 'slots' => array(
                    self::slot('درخواست‌کننده', $row->requested_by, Akph_Db::iso_time($row->created_at)),
                    self::slot('تأییدکننده', $row->approved_by, Akph_Db::iso_time($row->approved_at)),
                    self::slot('پرداخت‌کننده', $last ? $last->paid_by : 0, $last ? Akph_Db::iso_time($last->created_at) : null),
                ));
            case 'receipt':
                Akph_Auth::assert_cap(Akph_Roles::VIEW_ALL, 'دریافت‌ها در دسترس نقش شما نیست.');
                $row = Akph_Db::find(Akph_Schema::table('receipts'), $id);
                if (!$row) {
                    throw Akph_Error::not_found('دریافت پیدا نشد.');
                }
                Akph_Auth::assert_project($row->project_id);
                return array('number' => $row->number, 'slots' => array(
                    self::slot('ثبت‌کننده', $row->created_by, Akph_Db::iso_time($row->created_at)),
                    self::slot('تأییدکننده', $row->status === 'approved' ? $row->approved_by : 0, Akph_Db::iso_time($row->approved_at)),
                ));
        }
        throw Akph_Error::not_found();
    }
}
