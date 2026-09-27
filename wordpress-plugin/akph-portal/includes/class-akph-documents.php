<?php
/**
 * Document center and attachments (routes /documents*, docs/API-CONTRACT.md).
 *
 * - Files live in the private folder wp-content/uploads/akph-private/{year}/{month}/ under a random name
 *   without extension; the folder has .htaccess (Deny from all / Require all denied), web.config and empty
 *   index.php files, and a file is only ever sent through GET /documents/{id}/download (PHP stream,
 *   Content-Disposition: attachment, X-Content-Type-Options: nosniff; inline preview only for PDF and images).
 * - Upload (multipart, one file per command, Idempotency-Key): allowed extensions only, checked by content
 *   (wp_check_filetype_and_ext and finfo); executable, script, HTML and SVG content and names with a double
 *   extension are refused; the size limit is set by the system administrator (default 20 MB, at most 50 MB).
 *   The SHA-256 is kept; the same file on the same record is reported as a duplicate (and still stored).
 * - Scope as for projects: a project manager sees, downloads, uploads and links only documents of their own
 *   projects (never documents without a project); accountants and senior managers see all.
 * - Documents are archived, never deleted: by the uploader, the system administrator or a senior manager,
 *   and only while no linked record is final (a posted journal entry).
 * - Every change is audited with the user id.
 */
if (!defined('ABSPATH')) {
    exit;
}

final class Akph_Documents {
    const DIR = 'akph-private';
    const PREFIX = 'DOC';
    const DEFAULT_MAX_MB = 20;
    const LIMIT_MAX_MB = 50;

    /** Kinds of document (the app's categories, one to one). */
    const DOC_TYPES = array(
        'client_contract', 'subcontract', 'amendment', 'client_statement', 'subcontractor_statement', 'measurement',
        'supplier_invoice', 'petty_invoice', 'letter', 'minutes', 'drawing', 'qc_report', 'guarantee', 'financial',
        'photo', 'other',
    );
    const ENTITY_TYPES = array(
        'project', 'contract', 'counterparty', 'journal_entry', 'invoice', 'statement', 'petty_expense', 'payment',
        'payroll', 'inventory_doc', 'other', 'petty_request', 'petty_count', 'payment_request', 'receipt', 'transfer',
        'cheque', 'bank_statement',
    );

    /** Allowed extension => MIME type stored and sent. */
    const MIMES = array(
        'pdf' => 'application/pdf',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'webp' => 'image/webp',
        'heic' => 'image/heic',
        'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'xls' => 'application/vnd.ms-excel',
        'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'doc' => 'application/msword',
        'csv' => 'text/csv',
        'txt' => 'text/plain',
        'zip' => 'application/zip',
        'dwg' => 'image/vnd.dwg',
        'dxf' => 'image/vnd.dxf',
    );

    /** What finfo may report for each extension (libmagic versions differ; OOXML is a zip, old Office is OLE). */
    const REAL_MIMES = array(
        'pdf' => array('application/pdf'),
        'jpg' => array('image/jpeg'),
        'jpeg' => array('image/jpeg'),
        'png' => array('image/png'),
        'webp' => array('image/webp'),
        'heic' => array('image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'),
        'xlsx' => array('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'),
        'xls' => array('application/vnd.ms-excel', 'application/vnd.ms-office', 'application/x-ole-storage', 'application/CDFV2'),
        'docx' => array('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'),
        'doc' => array('application/msword', 'application/vnd.ms-office', 'application/x-ole-storage', 'application/CDFV2'),
        'csv' => array('text/csv', 'text/plain', 'application/csv'),
        'txt' => array('text/plain'),
        'zip' => array('application/zip', 'application/x-zip-compressed'),
        'dwg' => array('image/vnd.dwg', 'application/acad', 'application/x-acad', 'application/dwg', 'application/x-dwg', 'image/x-dwg'),
        'dxf' => array('image/vnd.dxf', 'application/dxf', 'image/x-dxf', 'text/plain'),
    );

    /** Content that is never accepted, whatever the extension says. */
    const BLOCKED_REAL_MIMES = array(
        'text/html', 'application/xhtml+xml', 'image/svg+xml', 'text/x-php', 'application/x-php', 'application/x-httpd-php',
        'text/javascript', 'application/javascript', 'application/x-javascript', 'application/x-dosexec', 'application/x-msdownload',
        'application/x-executable', 'application/x-sharedlib', 'application/x-mach-binary', 'text/x-shellscript', 'application/x-sh',
        'application/java-archive', 'text/x-python', 'text/x-perl',
    );

    /** Extensions that make a name with a double extension (report.php.pdf) or are refused outright. */
    const DANGEROUS_EXTENSIONS = array(
        'php', 'php3', 'php4', 'php5', 'php7', 'php8', 'phtml', 'pht', 'phar', 'phps', 'inc', 'pl', 'py', 'cgi', 'asp', 'aspx', 'jsp',
        'js', 'mjs', 'html', 'htm', 'shtml', 'xhtml', 'svg', 'svgz', 'xml', 'exe', 'com', 'bat', 'cmd', 'sh', 'msi', 'dll', 'jar',
        'vbs', 'ps1', 'htaccess', 'scr', 'hta',
    );

    // ------------------------------------------------------------------ storage

    public static function table() {
        return Akph_Schema::table('documents');
    }

    public static function links_table() {
        return Akph_Schema::table('document_links');
    }

    /** Upload limit in bytes (Akph_Settings document_max_mb). */
    public static function max_bytes() {
        return (int) Akph_Settings::get('document_max_mb') * 1048576;
    }

    /** Root of the private folder (created and protected on first use). */
    public static function base_dir() {
        $uploads = wp_upload_dir(null, false);
        return trailingslashit($uploads['basedir']) . self::DIR;
    }

    /** Creates {base}/{year}/{month} with the deny rules; returns the folder. */
    public static function storage_dir() {
        $base = self::base_dir();
        $dir = $base . '/' . gmdate('Y') . '/' . gmdate('m');
        if (!wp_mkdir_p($dir)) {
            throw new Akph_Error('akph_storage', 'پوشه خصوصی اسناد ساخته نشد؛ دسترسی نوشتن در wp-content/uploads را بررسی کنید.', 500);
        }
        self::protect($base);
        foreach (array(dirname($dir), $dir) as $folder) {
            if (!file_exists($folder . '/index.php')) {
                file_put_contents($folder . '/index.php', "<?php\n// Silence is golden.\n");
            }
        }
        return $dir;
    }

    /** Deny rules for Apache 2.2 and 2.4 and IIS, and an empty index.php (nginx: see docs/INSTALL-FA.md). */
    public static function protect($base) {
        $htaccess = $base . '/.htaccess';
        $rules = "# akph-portal: private documents, served only through the REST API\n"
            . "Options -Indexes\n"
            . "<IfModule mod_authz_core.c>\n    Require all denied\n</IfModule>\n"
            . "<IfModule !mod_authz_core.c>\n    Order deny,allow\n    Deny from all\n</IfModule>\n";
        if (!file_exists($htaccess) || file_get_contents($htaccess) !== $rules) {
            file_put_contents($htaccess, $rules);
        }
        if (!file_exists($base . '/index.php')) {
            file_put_contents($base . '/index.php', "<?php\n// Silence is golden.\n");
        }
        if (!file_exists($base . '/web.config')) {
            file_put_contents($base . '/web.config', "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<configuration>\n  <system.webServer>\n    <authorization>\n      <deny users=\"*\" />\n    </authorization>\n  </system.webServer>\n</configuration>\n");
        }
    }

    private static function path_of($row) {
        return self::base_dir() . '/' . $row->stored_name;
    }

    // ------------------------------------------------------------------ reads

    private static function scope_where() {
        return Akph_Auth::project_scope_sql('d.project_id');
    }

    /** GET /documents */
    public static function list_documents(array $f, $page, $per_page) {
        global $wpdb;
        $t = self::table();
        $l = self::links_table();
        $where = self::scope_where();
        $status = isset($f['status']) ? $f['status'] : 'active';
        if ($status === 'active' || $status === 'archived') {
            $where .= $wpdb->prepare(' AND d.status = %s', $status);
        }
        if (!empty($f['project_id'])) {
            $where .= $wpdb->prepare(' AND d.project_id = %d', $f['project_id']);
        }
        if (!empty($f['doc_type'])) {
            $where .= $wpdb->prepare(' AND d.doc_type = %s', $f['doc_type']);
        }
        if (!empty($f['entity_type'])) {
            $where .= $wpdb->prepare(" AND EXISTS (SELECT 1 FROM {$l} x WHERE x.document_id = d.id AND x.entity_type = %s", $f['entity_type'])
                . (!empty($f['entity_id']) ? $wpdb->prepare(' AND x.entity_id = %s', $f['entity_id']) : '') . ')';
        }
        if (!empty($f['q'])) {
            $like = '%' . $wpdb->esc_like($f['q']) . '%';
            $where .= $wpdb->prepare(' AND (d.title LIKE %s OR d.doc_number LIKE %s OR d.file_name LIKE %s)', $like, $like, $like);
        }
        $offset = ($page - 1) * $per_page;
        $rows = Akph_Db::results("SELECT d.* FROM {$t} d WHERE {$where} ORDER BY d.id DESC LIMIT {$per_page} OFFSET {$offset}");
        $total = (int) Akph_Db::value("SELECT COUNT(*) FROM {$t} d WHERE {$where}");
        return array('documents' => self::shape_many((array) $rows), 'page' => $page, 'total' => $total);
    }

    /** The row when the user may see it; 404 otherwise (ids of other projects are not revealed). */
    public static function get_visible($id) {
        $row = Akph_Db::find(self::table(), $id);
        if (!$row || !Akph_Auth::can_access_project($row->project_id)) {
            throw Akph_Error::not_found('سند پیدا نشد.');
        }
        return $row;
    }

    private static function lock_visible($id) {
        global $wpdb;
        $row = Akph_Db::row($wpdb->prepare('SELECT * FROM ' . self::table() . ' WHERE id = %d FOR UPDATE', $id));
        if (!$row || !Akph_Auth::can_access_project($row->project_id)) {
            throw Akph_Error::not_found('سند پیدا نشد.');
        }
        return $row;
    }

    private static function links_of(array $ids) {
        global $wpdb;
        $out = array();
        if (!$ids) {
            return $out;
        }
        $rows = Akph_Db::results('SELECT document_id, entity_type, entity_id FROM ' . self::links_table() . ' WHERE document_id IN (' . implode(',', array_map('intval', $ids)) . ') ORDER BY id');
        foreach ((array) $rows as $r) {
            $out[(int) $r->document_id][] = array('entity_type' => $r->entity_type, 'entity_id' => $r->entity_id);
        }
        return $out;
    }

    private static function shape_many(array $rows) {
        $links = self::links_of(array_map(function ($r) {
            return (int) $r->id;
        }, $rows));
        $out = array();
        foreach ($rows as $r) {
            $out[] = self::shape($r, isset($links[(int) $r->id]) ? $links[(int) $r->id] : array());
        }
        return $out;
    }

    public static function shape($row, $links = null) {
        if ($links === null) {
            $all = self::links_of(array((int) $row->id));
            $links = isset($all[(int) $row->id]) ? $all[(int) $row->id] : array();
        }
        $uploader = get_userdata((int) $row->uploaded_by);
        return array(
            'id' => (string) $row->id,
            'doc_number' => $row->doc_number,
            'title' => $row->title,
            'doc_type' => $row->doc_type,
            'description' => $row->description,
            'project_id' => $row->project_id ? (string) $row->project_id : null,
            'cost_center_id' => $row->cost_center_id ? (string) $row->cost_center_id : null,
            'counterparty_id' => $row->counterparty_id ? (string) $row->counterparty_id : null,
            'file_name' => $row->file_name,
            'mime' => $row->mime,
            'size' => (int) $row->size,
            'sha256' => $row->sha256,
            'version' => (int) $row->version,
            'uploaded_by' => (string) $row->uploaded_by,
            'uploaded_by_name' => $uploader ? $uploader->display_name : '',
            'uploaded_at' => Akph_Db::iso_time($row->uploaded_at),
            'status' => $row->status,
            'archived_at' => $row->archived_at ? Akph_Db::iso_time($row->archived_at) : null,
            'links' => $links,
            'preview' => self::previewable($row->mime),
            'can_archive' => $row->status === 'active' && self::may_archive($row),
        );
    }

    private static function previewable($mime) {
        return in_array($mime, array('application/pdf', 'image/jpeg', 'image/png', 'image/webp'), true);
    }

    /** The uploader, the system administrator or a senior manager. */
    private static function may_archive($row) {
        $role = Akph_Roles::role_of(wp_get_current_user());
        return (int) $row->uploaded_by === get_current_user_id() || in_array($role, array('administrator', 'paydar_senior_manager'), true);
    }

    // ------------------------------------------------------------------ upload

    /**
     * Checks an uploaded file; returns [ext, mime]. Errors: 413 (too large), 415 (type), 400 (name).
     *
     * @param array $file one entry of $_FILES
     */
    public static function check_file(array $file) {
        $error = isset($file['error']) ? (int) $file['error'] : UPLOAD_ERR_NO_FILE;
        if ($error === UPLOAD_ERR_INI_SIZE || $error === UPLOAD_ERR_FORM_SIZE) {
            throw self::too_large();
        }
        $tmp = isset($file['tmp_name']) ? (string) $file['tmp_name'] : '';
        if ($error !== UPLOAD_ERR_OK || $tmp === '' || !is_file($tmp)) {
            throw Akph_Error::invalid('بارگذاری فایل انجام نشد؛ دوباره تلاش کنید.', array('field' => 'file'));
        }
        $size = filesize($tmp);
        if ($size === false || $size <= 0) {
            throw Akph_Error::invalid('فایل خالی است.', array('field' => 'file'));
        }
        if ($size > self::max_bytes()) {
            throw self::too_large();
        }
        $name = self::clean_name(isset($file['name']) ? (string) $file['name'] : '');
        $parts = explode('.', strtolower($name));
        $ext = count($parts) > 1 ? array_pop($parts) : '';
        if (!isset(self::MIMES[$ext])) {
            throw self::wrong_type();
        }
        // report.php.pdf, invoice.exe.jpg: a known extension before the last one.
        array_shift($parts);
        foreach ($parts as $inner) {
            if (isset(self::MIMES[$inner]) || in_array($inner, self::DANGEROUS_EXTENSIONS, true)) {
                throw new Akph_Error('akph_file_name', 'نام فایل پسوند دوگانه دارد (مثل report.php.pdf)؛ نام را اصلاح و دوباره بارگذاری کنید.', 400, array('field' => 'file'));
            }
        }

        $real = self::real_mime($tmp);
        if ($real === '' || in_array($real, self::BLOCKED_REAL_MIMES, true)) {
            throw self::wrong_type();
        }
        if (!in_array($real, self::REAL_MIMES[$ext], true) && !self::known_binary($ext, $real, $tmp)) {
            throw self::wrong_type();
        }
        if (in_array($ext, array('txt', 'csv', 'dxf'), true) && self::looks_like_code($tmp)) {
            throw self::wrong_type();
        }
        // WordPress's own content check, with this plugin's list and the alternates above.
        $allow = function ($mimes) {
            return array_merge($mimes, self::MIMES);
        };
        $alternates = function ($data, $path, $filename, $mimes, $real_mime) use ($ext) {
            if (empty($data['ext']) && is_string($real_mime) && in_array($real_mime, self::REAL_MIMES[$ext], true)) {
                $data['ext'] = $ext;
                $data['type'] = self::MIMES[$ext];
            }
            return $data;
        };
        add_filter('upload_mimes', $allow, 99);
        add_filter('wp_check_filetype_and_ext', $alternates, 99, 5);
        $check = wp_check_filetype_and_ext($tmp, $name, array($ext => self::MIMES[$ext]));
        remove_filter('upload_mimes', $allow, 99);
        remove_filter('wp_check_filetype_and_ext', $alternates, 99);
        if (empty($check['ext']) && !self::known_binary($ext, $real, $tmp)) {
            throw self::wrong_type();
        }
        return array($ext, self::MIMES[$ext], $name, (int) $size);
    }

    private static function real_mime($path) {
        if (!function_exists('finfo_open')) {
            return '';
        }
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = $finfo ? finfo_file($finfo, $path) : false;
        return is_string($mime) ? $mime : '';
    }

    /** Formats that older libmagic reports as plain binary or text, recognised by their own signature. */
    private static function known_binary($ext, $real, $path) {
        $head = (string) file_get_contents($path, false, null, 0, 64);
        if ($ext === 'heic' && in_array($real, array('application/octet-stream', 'image/heic', 'image/heif'), true)) {
            return (bool) preg_match('/^.{4}ftyp(heic|heix|hevc|hevx|mif1|msf1)/s', $head);
        }
        if ($ext === 'dwg' && $real === 'application/octet-stream') {
            return strpos($head, 'AC10') === 0 || strpos($head, 'AC1.') === 0;
        }
        if ($ext === 'dxf' && $real === 'text/plain') {
            return (bool) preg_match('/^\s*0\s*[\r\n]+\s*SECTION/', $head);
        }
        return false;
    }

    /** A text file that carries markup or PHP (served as text/plain, but refused anyway). */
    private static function looks_like_code($path) {
        $head = strtolower((string) file_get_contents($path, false, null, 0, 4096));
        foreach (array('<?php', '<?=', '<script', '<html', '<iframe', '<svg') as $needle) {
            if (strpos($head, $needle) !== false) {
                return true;
            }
        }
        return false;
    }

    /** Display name of the original file: no path, no control characters, at most 200 characters. */
    public static function clean_name($name) {
        $name = wp_basename(str_replace('\\', '/', $name));
        $name = preg_replace('/[\x00-\x1F\x7F]+/u', '', $name);
        $name = trim(str_replace(array('"', "'", '<', '>', '|', ':', '*', '?'), '_', $name), " .\t");
        return mb_substr($name, -200);
    }

    /**
     * POST /documents (inside the command's transaction). `$fields` are the form fields of the multipart
     * request; `$file` the uploaded file.
     */
    public static function upload(array $fields, array $file) {
        list($ext, $mime, $name, $size) = self::check_file($file);
        $title = Akph_Input::text($fields, 'title', 190, false, 'عنوان سند');
        if ($title === '') {
            $title = mb_substr(preg_replace('/\.[^.]+$/', '', $name), 0, 190);
        }
        $doc_type = isset($fields['doc_type']) && $fields['doc_type'] !== '' ? Akph_Input::one_of($fields, 'doc_type', self::DOC_TYPES) : 'other';
        $description = Akph_Input::text($fields, 'description', 1000, false, 'شرح');
        $project_id = Akph_Input::id($fields, 'project_id');
        $cost_center_id = Akph_Input::id($fields, 'cost_center_id');
        $counterparty_id = Akph_Input::id($fields, 'counterparty_id');
        // A project manager uploads only for their own projects (a document without a project is headquarters).
        Akph_Auth::assert_project($project_id);
        if ($project_id && !Akph_Db::find(Akph_Projects::table(), $project_id)) {
            throw Akph_Error::invalid('پروژه پیدا نشد.', array('field' => 'project_id'));
        }
        if ($cost_center_id) {
            $cc = Akph_Db::find(Akph_Schema::table('cost_centers'), $cost_center_id);
            if (!$cc || !Akph_Auth::can_access_project($cc->project_id)) {
                throw Akph_Error::invalid('مرکز هزینه پیدا نشد.', array('field' => 'cost_center_id'));
            }
        }
        if ($counterparty_id && !Akph_Db::find(Akph_Schema::table('counterparties'), $counterparty_id)) {
            throw Akph_Error::invalid('طرف حساب پیدا نشد.', array('field' => 'counterparty_id'));
        }
        $link = null;
        if (!empty($fields['entity_type']) || !empty($fields['entity_id'])) {
            $link = self::parse_link($fields);
        }

        $tmp = (string) $file['tmp_name'];
        $sha = (string) hash_file('sha256', $tmp);
        $duplicates = self::duplicates($sha, $project_id, $link);

        $dir = self::storage_dir();
        $random = bin2hex(random_bytes(16));
        $target = $dir . '/' . $random;
        $moved = is_uploaded_file($tmp) ? move_uploaded_file($tmp, $target) : (apply_filters('akph_documents_accept_local_file', false, $tmp) && copy($tmp, $target));
        if (!$moved) {
            throw new Akph_Error('akph_storage', 'ذخیره فایل انجام نشد.', 500);
        }
        @chmod($target, 0640); // phpcs:ignore WordPress.PHP.NoSilencedErrors -- best effort on shared hosts
        try {
            $now = Akph_Db::now_utc();
            $id = Akph_Db::insert(self::table(), array(
                'doc_number' => 'TMP-' . $random,
                'title' => $title,
                'doc_type' => $doc_type,
                'description' => $description,
                'project_id' => $project_id ?: null,
                'cost_center_id' => $cost_center_id ?: null,
                'counterparty_id' => $counterparty_id ?: null,
                'file_name' => $name,
                'stored_name' => gmdate('Y') . '/' . gmdate('m') . '/' . $random,
                'mime' => $mime,
                'size' => $size,
                'sha256' => $sha,
                'version' => 1,
                'uploaded_by' => get_current_user_id(),
                'uploaded_at' => $now,
                'status' => 'active',
            ));
            $number = Akph_Numbering::issue(self::PREFIX, Akph_Jalali::fiscal_year(Akph_Jalali::today_iso()), 'document', $id);
            Akph_Db::update(self::table(), array('doc_number' => $number), array('id' => $id));
            $links = array();
            if ($project_id) {
                $links[] = array('project', (string) $project_id);
            }
            if ($counterparty_id) {
                $links[] = array('counterparty', (string) $counterparty_id);
            }
            if ($link) {
                $links[] = $link;
            }
            foreach ($links as $l) {
                self::insert_link($id, $l[0], $l[1]);
            }
            $row = Akph_Db::find(self::table(), $id);
            Akph_Audit::log('document_uploaded', 'document', $id, null, array('doc_number' => $number, 'title' => $title, 'file_name' => $name, 'size' => $size, 'sha256' => $sha, 'project_id' => $project_id ?: null), $number);
        } catch (Throwable $e) {
            if (is_file($target)) {
                wp_delete_file($target);
            }
            throw $e;
        }
        $message = 'سند ' . $number . ' بارگذاری شد.';
        if ($duplicates) {
            $message .= ' هشدار: همین فایل قبلاً برای همین رکورد بارگذاری شده است (' . implode('، ', $duplicates) . ').';
        }
        return array('message' => $message, 'records' => array('documents' => array(self::shape($row))), 'id' => $id, 'doc_number' => $number, 'status' => 201, 'duplicate_of' => $duplicates);
    }

    /** Numbers of active documents with the same content on the same record (project or linked record). */
    private static function duplicates($sha, $project_id, $link) {
        global $wpdb;
        $t = self::table();
        $l = self::links_table();
        $conditions = array();
        if ($link) {
            $conditions[] = $wpdb->prepare("EXISTS (SELECT 1 FROM {$l} x WHERE x.document_id = d.id AND x.entity_type = %s AND x.entity_id = %s)", $link[0], $link[1]);
        } elseif ($project_id) {
            $conditions[] = $wpdb->prepare('d.project_id = %d', $project_id);
        } else {
            $conditions[] = 'd.project_id IS NULL';
        }
        $sql = $wpdb->prepare("SELECT d.doc_number FROM {$t} d WHERE d.sha256 = %s AND d.status = 'active' AND ", $sha) . implode(' AND ', $conditions) . ' AND ' . self::scope_where();
        return array_values(array_map('strval', (array) Akph_Db::col($sql)));
    }

    /** [entity_type, entity_id] from a body; checks the record where the server keeps it. */
    private static function parse_link(array $body) {
        $type = Akph_Input::one_of($body, 'entity_type', self::ENTITY_TYPES);
        $id = isset($body['entity_id']) ? (string) $body['entity_id'] : '';
        if (!preg_match('/^[A-Za-z0-9_-]{1,64}$/D', $id)) {
            throw Akph_Error::invalid('شناسه رکورد مرتبط معتبر نیست.', array('field' => 'entity_id'));
        }
        if ($type === 'project') {
            Akph_Projects::get_visible((int) $id);
        } elseif ($type === 'counterparty') {
            if (!ctype_digit($id) || !Akph_Db::find(Akph_Schema::table('counterparties'), (int) $id)) {
                throw Akph_Error::invalid('طرف حساب پیدا نشد.', array('field' => 'entity_id'));
            }
        } elseif ($type === 'journal_entry') {
            // Journal entries are for users who see the books.
            Akph_Auth::assert_cap(Akph_Roles::VIEW_ALL, 'پیوست به سند حسابداری فقط برای کاربرانی است که دفاتر را می‌بینند.');
            if (!ctype_digit($id) || !Akph_Db::find(Akph_Ledger::entries_table(), (int) $id)) {
                throw Akph_Error::invalid('سند حسابداری پیدا نشد.', array('field' => 'entity_id'));
            }
        }
        return array($type, $id);
    }

    /** One row per document and record; linking the same record again keeps the first link (no error swallowed). */
    private static function insert_link($document_id, $type, $entity_id) {
        global $wpdb;
        Akph_Db::exec($wpdb->prepare(
            'INSERT INTO ' . self::links_table() . ' (document_id, entity_type, entity_id, created_by, created_at) VALUES (%d, %s, %s, %d, %s) ON DUPLICATE KEY UPDATE document_id = document_id',
            $document_id, $type, $entity_id, get_current_user_id(), Akph_Db::now_utc()
        ));
    }

    // ------------------------------------------------------------------ links and archive

    /** POST /documents/{id}/links */
    public static function link($id, array $body) {
        $row = self::lock_visible($id);
        if ($row->status !== 'active') {
            throw Akph_Error::conflict('سند بایگانی شده است.');
        }
        list($type, $entity_id) = self::parse_link($body);
        self::insert_link($row->id, $type, $entity_id);
        Akph_Audit::log('document_linked', 'document', $row->id, null, array('entity_type' => $type, 'entity_id' => $entity_id), $row->doc_number);
        return array('message' => 'سند ' . $row->doc_number . ' به رکورد پیوند شد.', 'records' => array('documents' => array(self::shape(Akph_Db::find(self::table(), $row->id)))));
    }

    /** POST /documents/{id}/archive: archived, never deleted. */
    public static function archive($id, $version) {
        global $wpdb;
        $row = self::lock_visible($id);
        Akph_Input::assert_version($row, $version);
        if ($row->status !== 'active') {
            throw Akph_Error::conflict('سند قبلاً بایگانی شده است.');
        }
        if (!self::may_archive($row)) {
            throw Akph_Error::forbidden('فقط بارگذارکننده سند، مدیر سیستم یا مدیر ارشد می‌تواند آن را بایگانی کند.');
        }
        $entries = Akph_Db::col($wpdb->prepare('SELECT entity_id FROM ' . self::links_table() . " WHERE document_id = %d AND entity_type = 'journal_entry'", $row->id));
        foreach ((array) $entries as $entry_id) {
            $status = Akph_Db::value($wpdb->prepare('SELECT status FROM ' . Akph_Ledger::entries_table() . ' WHERE id = %d', (int) $entry_id));
            if ($status === 'posted') {
                throw Akph_Error::rule('این سند پیوست یک سند حسابداری قطعی است و بایگانی نمی‌شود.');
            }
        }
        Akph_Db::update(self::table(), array('status' => 'archived', 'archived_by' => get_current_user_id(), 'archived_at' => Akph_Db::now_utc(), 'version' => (int) $row->version + 1), array('id' => $row->id));
        Akph_Audit::log('document_archived', 'document', $row->id, array('status' => 'active'), array('status' => 'archived'), $row->doc_number);
        return array('message' => 'سند ' . $row->doc_number . ' بایگانی شد.', 'records' => array('documents' => array(self::shape(Akph_Db::find(self::table(), $row->id)))));
    }

    // ------------------------------------------------------------------ download

    /**
     * Path and headers of a download the user may make. Inline (preview) only for PDF and images; everything
     * else is an attachment. Throws 404 for a document outside the user's scope.
     */
    public static function prepare_download($id, $inline) {
        $row = self::get_visible($id);
        $path = self::path_of($row);
        if (!is_file($path)) {
            throw Akph_Error::not_found('فایل این سند روی سرور پیدا نشد.');
        }
        $inline = $inline && self::previewable($row->mime);
        $ascii = preg_replace('/[^A-Za-z0-9._-]+/', '_', remove_accents($row->file_name));
        $ascii = trim($ascii, '_') !== '' ? $ascii : 'document';
        $headers = array(
            'Content-Type' => $inline ? $row->mime : 'application/octet-stream',
            'Content-Disposition' => ($inline ? 'inline' : 'attachment') . '; filename="' . $ascii . '"; filename*=UTF-8\'\'' . rawurlencode($row->file_name),
            'Content-Length' => (string) filesize($path),
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store, max-age=0',
            'Content-Security-Policy' => "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
            'X-Frame-Options' => 'SAMEORIGIN',
        );
        if ($inline && $row->mime === 'application/pdf') {
            // The browser's PDF viewer needs scripts of its own; still nothing from the document's origin.
            $headers['Content-Security-Policy'] = "default-src 'none'; object-src 'self'; frame-ancestors 'self'";
        }
        Akph_Audit::log('document_downloaded', 'document', $row->id, null, array('inline' => $inline), $row->doc_number);
        return array('path' => $path, 'headers' => $headers);
    }

    /** Sends the file through PHP (the private folder is never served directly). */
    public static function stream(array $download) {
        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        foreach ($download['headers'] as $name => $value) {
            header($name . ': ' . $value);
        }
        readfile($download['path']);
        exit;
    }

    private static function too_large() {
        return new Akph_Error('akph_file_too_large', 'حجم فایل بیش از حد مجاز (' . (int) Akph_Settings::get('document_max_mb') . ' مگابایت) است.', 413, array('field' => 'file'));
    }

    private static function wrong_type() {
        return new Akph_Error('akph_file_type', 'این نوع فایل پذیرفته نمی‌شود. مجاز: PDF، تصویر (JPG، PNG، WebP، HEIC)، Excel، Word، CSV، TXT، ZIP، DWG و DXF.', 415, array('field' => 'file'));
    }
}
