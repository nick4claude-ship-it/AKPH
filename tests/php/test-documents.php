<?php
/**
 * Document center: files are stored in the protected private folder under a random name and numbered by the
 * server; disallowed, oversized and double-extension files are refused; a project manager neither sees nor
 * downloads documents of other projects or headquarters; documents are archived, never deleted; uploads are
 * idempotent like every command.
 */
class Test_Akph_Documents extends Akph_Test_Case {
    /** @var string[] */
    private $tmp = array();

    public function set_up() {
        parent::set_up();
        add_filter('akph_documents_accept_local_file', '__return_true');
        add_filter('akph_documents_stream', '__return_false');
        require_once ABSPATH . 'wp-admin/includes/file.php';
    }

    public function tear_down() {
        remove_filter('akph_documents_accept_local_file', '__return_true');
        remove_filter('akph_documents_stream', '__return_false');
        foreach ($this->tmp as $f) {
            if (is_file($f)) {
                unlink($f);
            }
        }
        $this->remove_dir(Akph_Documents::base_dir());
        parent::tear_down();
    }

    private function remove_dir($dir) {
        if (!is_dir($dir)) {
            return;
        }
        foreach (array_diff(scandir($dir), array('.', '..')) as $item) {
            $path = $dir . '/' . $item;
            is_dir($path) ? $this->remove_dir($path) : unlink($path);
        }
        rmdir($dir);
    }

    private function file($content) {
        $path = wp_tempnam('akph-doc');
        file_put_contents($path, $content);
        $this->tmp[] = $path;
        return $path;
    }

    private function pdf($extra = '') {
        return $this->file("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n" . $extra . "\ntrailer << >>\n%%EOF\n");
    }

    private function png() {
        $im = imagecreatetruecolor(20, 20);
        $path = wp_tempnam('akph-png');
        imagepng($im, $path);
        imagedestroy($im);
        $this->tmp[] = $path;
        return $path;
    }

    private function upload($path, $name, array $fields = array(), array $headers = array()) {
        $request = new WP_REST_Request('POST', '/akph/v1/documents');
        $request->set_header('X-WP-Nonce', wp_create_nonce('wp_rest'));
        $request->set_header('Idempotency-Key', isset($headers['Idempotency-Key']) ? $headers['Idempotency-Key'] : wp_generate_uuid4());
        $request->set_file_params(array('file' => array('name' => $name, 'type' => 'application/octet-stream', 'tmp_name' => $path, 'error' => UPLOAD_ERR_OK, 'size' => filesize($path))));
        $request->set_body_params($fields);
        return rest_get_server()->dispatch($request);
    }

    private function doc(WP_REST_Response $response) {
        $this->assertStatus(201, $response);
        return $response->get_data()['records']['documents'][0];
    }

    public function test_upload_is_stored_privately_under_a_random_name_and_numbered() {
        $project = $this->make_project(array('manager_user_id' => self::$users['pm']));
        $this->login('accountant');
        $path = $this->pdf();
        $doc = $this->doc($this->upload($path, 'قرارداد اصلی.pdf', array('title' => 'قرارداد اصلی', 'doc_type' => 'client_contract', 'project_id' => $project['id'])));
        $this->assertMatchesRegularExpression('/^DOC-1[34]\d\d-\d{5}$/', $doc['doc_number']);
        $this->assertSame('قرارداد اصلی.pdf', $doc['file_name']);
        $this->assertSame('application/pdf', $doc['mime']);
        $this->assertSame(hash_file('sha256', $path), $doc['sha256']);
        $this->assertSame(array(array('entity_type' => 'project', 'entity_id' => $project['id'])), $doc['links']);
        $this->assertTrue($doc['preview']);

        global $wpdb;
        $stored = $wpdb->get_var($wpdb->prepare('SELECT stored_name FROM ' . Akph_Documents::table() . ' WHERE id = %d', $doc['id']));
        $this->assertMatchesRegularExpression('#^\d{4}/\d{2}/[0-9a-f]{32}$#', $stored, 'random name without extension');
        $base = Akph_Documents::base_dir();
        $this->assertFileExists($base . '/' . $stored);
        $this->assertStringEndsWith('/uploads/akph-private', $base);
        // No direct access: deny rules for Apache 2.2/2.4 and IIS, empty index files, no listing.
        $htaccess = file_get_contents($base . '/.htaccess');
        $this->assertStringContainsString('Require all denied', $htaccess);
        $this->assertStringContainsString('Deny from all', $htaccess);
        $this->assertStringContainsString('Options -Indexes', $htaccess);
        $this->assertFileExists($base . '/index.php');
        $this->assertFileExists($base . '/web.config');
        $this->assertFileExists(dirname($base . '/' . $stored) . '/index.php');
        $this->assertSame(1, $this->count_rows('audit_log', "action = 'document_uploaded' AND user_id = " . self::$users['accountant']));
    }

    public function test_disallowed_double_extension_and_disguised_files_are_refused() {
        $this->login('senior');
        $cases = array(
            array($this->file('<?php echo 1;'), 'shell.php', 415),
            array($this->file('<html><body>x</body></html>'), 'page.html', 415),
            array($this->file('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'logo.svg', 415),
            array($this->file("MZ\x90\x00" . str_repeat("\0", 200)), 'setup.exe', 415),
            array($this->file('alert(1)'), 'app.js', 415),
            array($this->pdf(), 'invoice.php.pdf', 400),
            array($this->png(), 'photo.exe.png', 400),
            array($this->pdf(), 'report.html.pdf', 400),
            array($this->file('just some text'), 'fake.pdf', 415),
            array($this->file("<?php system(\$_GET['c']); ?>"), 'notes.txt', 415),
            array($this->file('<html><script>alert(1)</script></html>'), 'table.csv', 415),
            array($this->png(), 'image.pdf', 415),
        );
        foreach ($cases as $case) {
            list($path, $name, $status) = $case;
            $response = $this->upload($path, $name);
            $this->assertStatus($status, $response, $name);
        }
        $this->assertSame(0, $this->count_rows('documents'));
        // Allowed types with the right content pass.
        $this->assertStatus(201, $this->upload($this->png(), 'photo.png'));
        $this->assertStatus(201, $this->upload($this->file("شرح,مبلغ\nالف,100\n"), 'list.csv'));
        $this->assertStatus(201, $this->upload($this->file('یادداشت ساده'), 'note.txt'));
        $this->assertStatus(201, $this->upload($this->pdf(), 'report.v2.pdf'), 'a dot that is not an extension is fine');
    }

    public function test_files_over_the_limit_are_refused_and_the_limit_is_capped_at_50_mb() {
        Akph_Settings::update(array('document_max_mb' => 1));
        $this->login('senior');
        $response = $this->upload($this->pdf(str_repeat('0', 1100000)), 'big.pdf');
        $this->assertStatus(413, $response);
        $this->assertSame('akph_file_too_large', $this->errorCode($response));
        $this->assertStatus(201, $this->upload($this->pdf(str_repeat('0', 900000)), 'small.pdf'));
        Akph_Settings::update(array('document_max_mb' => 200));
        $this->assertSame(50, Akph_Settings::get('document_max_mb'));
        Akph_Settings::update(array('document_max_mb' => 0));
        $this->assertSame(1, Akph_Settings::get('document_max_mb'));
    }

    public function test_project_manager_sees_and_downloads_only_documents_of_own_projects() {
        $own = $this->make_project(array('name' => 'پروژه خودی', 'manager_user_id' => self::$users['pm']));
        $other = $this->make_project(array('name' => 'پروژه دیگر', 'manager_user_id' => self::$users['pm2']));
        $this->login('senior');
        $a = $this->doc($this->upload($this->pdf('a'), 'a.pdf', array('project_id' => $own['id'])));
        $b = $this->doc($this->upload($this->pdf('b'), 'b.pdf', array('project_id' => $other['id'])));
        $hq = $this->doc($this->upload($this->pdf('hq'), 'hq.pdf'));

        $this->login('pm');
        $list = $this->request('GET', '/documents')->get_data();
        $this->assertSame(array($a['id']), wp_list_pluck($list['documents'], 'id'));
        $this->assertSame(1, $list['total']);
        $this->assertStatus(200, $this->request('GET', "/documents/{$a['id']}"));
        foreach (array($b, $hq) as $doc) {
            $this->assertStatus(404, $this->request('GET', "/documents/{$doc['id']}"));
            $this->assertStatus(404, $this->request('GET', "/documents/{$doc['id']}/download"));
            $this->assertStatus(404, $this->request('POST', "/documents/{$doc['id']}/links", array('entity_type' => 'other', 'entity_id' => 'x1')));
        }
        $this->assertStatus(403, $this->request('GET', '/documents', null, array(), array('project_id' => $other['id'])));
        // Upload: own project only; a document without a project is headquarters.
        $this->assertStatus(403, $this->upload($this->pdf('c'), 'c.pdf', array('project_id' => $other['id'])));
        $this->assertStatus(403, $this->upload($this->pdf('d'), 'd.pdf'));
        $this->assertStatus(201, $this->upload($this->pdf('e'), 'e.pdf', array('project_id' => $own['id'])));
        $this->assertStatus(404, $this->request('POST', "/documents/{$a['id']}/links", array('entity_type' => 'project', 'entity_id' => $other['id'])));
        $this->assertStatus(403, $this->request('POST', "/documents/{$a['id']}/links", array('entity_type' => 'journal_entry', 'entity_id' => '1')));

        $download = $this->request('GET', "/documents/{$a['id']}/download");
        $this->assertStatus(200, $download);
        $headers = $download->get_data()['headers'];
        $this->assertSame('application/octet-stream', $headers['Content-Type']);
        $this->assertStringStartsWith('attachment; filename="a.pdf"', $headers['Content-Disposition']);
        $this->assertSame('nosniff', $headers['X-Content-Type-Options']);

        // The accountant sees everything.
        $this->login('accountant');
        $this->assertSame(4, $this->request('GET', '/documents')->get_data()['total']);
        $this->assertStatus(200, $this->request('GET', "/documents/{$hq['id']}/download"));
    }

    public function test_preview_is_inline_only_for_pdf_and_images() {
        $this->login('senior');
        $pdf = $this->doc($this->upload($this->pdf(), 'p.pdf'));
        $txt = $this->doc($this->upload($this->file('متن'), 'n.txt'));
        $inline = $this->request('GET', "/documents/{$pdf['id']}/download", null, array(), array('inline' => '1'))->get_data()['headers'];
        $this->assertSame('application/pdf', $inline['Content-Type']);
        $this->assertStringStartsWith('inline;', $inline['Content-Disposition']);
        $text = $this->request('GET', "/documents/{$txt['id']}/download", null, array(), array('inline' => '1'))->get_data()['headers'];
        $this->assertSame('application/octet-stream', $text['Content-Type']);
        $this->assertStringStartsWith('attachment;', $text['Content-Disposition']);
        $this->assertStringContainsString("filename*=UTF-8''n.txt", $text['Content-Disposition']);
    }

    public function test_documents_are_archived_never_deleted() {
        $this->install_chart();
        $this->login('accountant');
        $doc = $this->doc($this->upload($this->pdf('x'), 'x.pdf'));
        $this->assertStatus(404, $this->request('DELETE', "/documents/{$doc['id']}"), 'no delete route');

        // Only the uploader, the system administrator or a senior manager.
        $this->login('accountant2');
        $this->assertStatus(403, $this->request('POST', "/documents/{$doc['id']}/archive", array('version' => $doc['version'])));
        $this->login('accountant');
        $this->assertStatus(428, $this->request('POST', "/documents/{$doc['id']}/archive", array()));
        $archived = $this->request('POST', "/documents/{$doc['id']}/archive", array('version' => $doc['version']));
        $this->assertStatus(200, $archived);
        $this->assertSame('archived', $archived->get_data()['records']['documents'][0]['status']);
        $this->assertSame(1, $this->count_rows('documents'), 'the row stays');
        global $wpdb;
        $stored = $wpdb->get_var('SELECT stored_name FROM ' . Akph_Documents::table());
        $this->assertFileExists(Akph_Documents::base_dir() . '/' . $stored, 'the file stays');
        $this->assertSame(0, $this->request('GET', '/documents')->get_data()['total']);
        $this->assertSame(1, $this->request('GET', '/documents', null, array(), array('status' => 'archived'))->get_data()['total']);

        // Not while a linked record is final (a posted journal entry); a pending one is fine.
        $entry = $this->make_entry('accountant', Akph_Jalali::today_iso());
        $second = $this->doc($this->upload($this->pdf('y'), 'y.pdf'));
        $this->assertStatus(200, $this->request('POST', "/documents/{$second['id']}/links", array('entity_type' => 'journal_entry', 'entity_id' => $entry['id'])));
        $this->login('accountant2');
        $this->assertStatus(200, $this->request('POST', "/journal-entries/{$entry['id']}/post", array('version' => $entry['version'])));
        $this->login('senior');
        $refused = $this->request('POST', "/documents/{$second['id']}/archive", array('version' => $second['version']));
        $this->assertStatus(422, $refused);
        $this->assertSame(1, $this->count_rows('audit_log', "action = 'document_archived'"));
    }

    public function test_upload_is_idempotent_and_reports_the_same_file_on_the_same_record() {
        $project = $this->make_project();
        $this->login('senior');
        $path = $this->pdf('same');
        $key = wp_generate_uuid4();
        $first = $this->upload($path, 'same.pdf', array('project_id' => $project['id']), array('Idempotency-Key' => $key));
        $again = $this->upload($path, 'same.pdf', array('project_id' => $project['id']), array('Idempotency-Key' => $key));
        $this->assertStatus(201, $first);
        $this->assertSame($first->get_data(), $again->get_data());
        $this->assertSame('true', $again->get_headers()['Idempotency-Replayed']);
        $this->assertSame(1, $this->count_rows('documents'));
        // The same key with another file or other fields is refused.
        $this->assertStatus(422, $this->upload($this->pdf('other'), 'same.pdf', array('project_id' => $project['id']), array('Idempotency-Key' => $key)));
        $this->assertStatus(422, $this->upload($path, 'same.pdf', array('project_id' => $project['id'], 'title' => 'دیگر'), array('Idempotency-Key' => $key)));

        // A new upload of the same content on the same project is stored with a warning.
        $duplicate = $this->upload($path, 'same-again.pdf', array('project_id' => $project['id']));
        $this->assertStatus(201, $duplicate);
        $this->assertSame(array($first->get_data()['doc_number']), $duplicate->get_data()['duplicate_of']);
        $this->assertStringContainsString('هشدار', $duplicate->get_data()['message']);
        $this->assertSame(2, $this->count_rows('documents'));
    }

    public function test_unknown_or_forbidden_fields_are_refused() {
        $this->login('senior');
        $this->assertStatus(400, $this->upload($this->pdf(), 'a.pdf', array('uploaded_by' => '1')));
        $forbidden = $this->upload($this->pdf(), 'a.pdf', array('user_id' => '1'));
        $this->assertStatus(400, $forbidden);
        $this->assertSame('akph_forbidden_field', $this->errorCode($forbidden));
        $this->assertStatus(400, $this->upload($this->pdf(), 'a.pdf', array('doc_type' => 'weird')));
        $this->assertSame(0, $this->count_rows('documents'));
    }
}
