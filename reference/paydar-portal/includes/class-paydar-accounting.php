<?php
/** Accounting ledger. Amounts are exact integers in the explicitly selected unit. */
if (!defined('ABSPATH')) { exit; }
final class Paydar_Accounting {
    const SCHEMA = '1';
    const READ = 'paydar_accounting_read';
    const WRITE = 'paydar_accounting_write';
    const PROJECT = 'paydar_accounting_project';
    const MAX_AMOUNT = 9999999999999;
    private static $instance;
    public static function boot() {
        if (!self::$instance) self::$instance = new self();
        return self::$instance;
    }
    private function __construct() {
        add_action('plugins_loaded', array(__CLASS__, 'upgrade'));
        add_action('rest_api_init', array($this, 'routes'));
    }
    public static function table($name) { global $wpdb; return $wpdb->prefix . 'paydar_ac_' . $name; }
    public static function caps() {
        return array('read'=>current_user_can(self::READ),'write'=>current_user_can(self::WRITE),'project'=>current_user_can(self::PROJECT),'setup'=>current_user_can('manage_options'));
    }
    public static function role_caps() {
        return array('administrator'=>array('paydar_petty_cash_read','paydar_petty_cash_manage','paydar_petty_cash_review','paydar_petty_cash_senior_approve','paydar_petty_cash_pay','paydar_petty_cash_reconcile'),'paydar_senior_manager'=>array('paydar_petty_cash_read','paydar_petty_cash_senior_approve'),'paydar_accountant'=>array('paydar_petty_cash_read','paydar_petty_cash_manage','paydar_petty_cash_review','paydar_petty_cash_pay','paydar_petty_cash_reconcile'),'paydar_project_manager'=>array('paydar_petty_cash_read','paydar_petty_cash_request','paydar_petty_cash_review'));
    }
    public static function upgrade() {
        if (get_option('paydar_accounting_schema') !== self::SCHEMA) self::install();
        if (get_option('paydar_accounting_roles') !== self::SCHEMA) {
            $definitions = array('administrator'=>array(self::READ,self::WRITE,self::PROJECT), 'paydar_senior_manager'=>array(self::READ,self::PROJECT), 'paydar_accountant'=>array(self::READ,self::WRITE,self::PROJECT), 'paydar_project_manager'=>array(self::PROJECT));
            foreach ($definitions as $name=>$caps) { $role=get_role($name); if ($role) foreach($caps as $cap) $role->add_cap($cap); }
            update_option('paydar_accounting_roles',self::SCHEMA,false);
        }
        if (get_option('paydar_petty_cash_roles') !== '2') {
            foreach(self::role_caps() as $name=>$caps){$role=get_role($name);if($role)foreach($caps as $cap)$role->add_cap($cap);}
            foreach(array('administrator','paydar_accountant') as $name){$role=get_role($name);if($role)$role->remove_cap('paydar_petty_cash_request');}
            update_option('paydar_petty_cash_roles','2',false);
        }
    }
    public static function install() {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        $collate=$wpdb->get_charset_collate();
        $definitions=array(
            'settings'=>"id bigint(20) unsigned NOT NULL,\n unit varchar(8) NOT NULL DEFAULT '',\n PRIMARY KEY  (id)",
            'accounts'=>"id bigint(20) unsigned NOT NULL AUTO_INCREMENT,\n code varchar(32) NOT NULL,\n name varchar(190) NOT NULL,\n kind varchar(16) NOT NULL,\n parent_id bigint(20) unsigned NOT NULL DEFAULT 0,\n postable tinyint(1) NOT NULL DEFAULT 1,\n active tinyint(1) NOT NULL DEFAULT 1,\n version bigint(20) unsigned NOT NULL DEFAULT 1,\n PRIMARY KEY  (id),\n UNIQUE KEY code (code),\n KEY parent_id (parent_id)",
            'entries'=>"id bigint(20) unsigned NOT NULL AUTO_INCREMENT,\n entry_date date NOT NULL,\n description text NOT NULL,\n status varchar(12) NOT NULL DEFAULT 'draft',\n source_type varchar(32) NOT NULL DEFAULT 'manual',\n source_id varchar(100) NOT NULL DEFAULT '',\n request_key varchar(64) NOT NULL,\n request_hash varchar(64) NOT NULL,\n reversal_of bigint(20) unsigned DEFAULT NULL,\n created_by bigint(20) unsigned NOT NULL,\n created_at datetime NOT NULL,\n posted_by bigint(20) unsigned DEFAULT NULL,\n posted_at datetime DEFAULT NULL,\n version bigint(20) unsigned NOT NULL DEFAULT 1,\n PRIMARY KEY  (id),\n UNIQUE KEY request_key (request_key),\n UNIQUE KEY reversal_of (reversal_of),\n KEY status_date (status,entry_date)",
            'lines'=>"id bigint(20) unsigned NOT NULL AUTO_INCREMENT,\n entry_id bigint(20) unsigned NOT NULL,\n account_id bigint(20) unsigned NOT NULL,\n project_id varchar(32) NOT NULL DEFAULT '',\n description varchar(500) NOT NULL DEFAULT '',\n debit decimal(20,0) NOT NULL DEFAULT 0,\n credit decimal(20,0) NOT NULL DEFAULT 0,\n PRIMARY KEY  (id),\n KEY entry_id (entry_id),\n KEY account_id (account_id),\n KEY project_id (project_id)",
            'audit'=>"id bigint(20) unsigned NOT NULL AUTO_INCREMENT,\n actor_id bigint(20) unsigned NOT NULL,\n action varchar(40) NOT NULL,\n object_id bigint(20) unsigned NOT NULL DEFAULT 0,\n detail longtext NOT NULL,\n created_at datetime NOT NULL,\n PRIMARY KEY  (id),\n KEY created_at (created_at)"
        );
        foreach($definitions as $name=>$def) {
            $table=self::table($name);
            dbDelta("CREATE TABLE $table (\n $def\n) ENGINE=InnoDB $collate;");
            // Fail closed if table creation failed or the host cannot guarantee transactions.
            $status=$wpdb->get_row($wpdb->prepare('SHOW TABLE STATUS WHERE Name = %s',$table));
            if (!$status || strtolower($status->Engine)!=='innodb') return;
        }
        $table=self::table('settings');
        if ($wpdb->query("INSERT IGNORE INTO $table (id,unit) VALUES (1,'')")===false) return;
        update_option('paydar_accounting_schema',self::SCHEMA,false);
    }
    public function permission($cap) {
        if (!is_user_logged_in()) return self::error('ورود به حساب کاربری لازم است.',401);
        if (!current_user_can('paydar_access') || !current_user_can($cap)) return self::error('دسترسی به این بخش مجاز نیست.',403);
        if (get_option('paydar_accounting_schema')!==self::SCHEMA || PHP_INT_SIZE<8) return self::error('زیرساخت حسابداری آماده نیست؛ PHP ۶۴ بیتی و جدول‌های InnoDB لازم است.',503);
        return true;
    }
    public function routes() {
        $routes=array(
            '/settings'=>array(array('GET','settings',self::READ),array('POST','setup','manage_options')),
            '/accounts'=>array(array('GET','accounts',self::READ),array('POST','save_account',self::WRITE)),
            '/accounts/(?P<id>[1-9][0-9]*)'=>array(array('PUT','save_account',self::WRITE)),
            '/entries'=>array(array('GET','entries',self::READ),array('POST','save_entry',self::WRITE)),
            '/entries/(?P<id>[1-9][0-9]*)'=>array(array('GET','entry',self::READ),array('PUT','save_entry',self::WRITE)),
            '/entries/(?P<id>[1-9][0-9]*)/post'=>array(array('POST','post_entry',self::WRITE)),
            '/entries/(?P<id>[1-9][0-9]*)/reverse'=>array(array('POST','reverse_entry',self::WRITE)),
            '/report'=>array(array('GET','report',self::READ)),
            '/project-summary'=>array(array('GET','project_summary',self::PROJECT)),
            '/audit'=>array(array('GET','audit_list',self::READ))
        );
        foreach($routes as $path=>$defs) {
            $args=array();
            foreach($defs as $def) { $cap=$def[2]; $args[]=array('methods'=>$def[0],'callback'=>array($this,$def[1]),'permission_callback'=>function() use($cap){ return $this->permission($cap); }); }
            register_rest_route('paydar/v1','/accounting'.$path,$args);
        }
    }
    public static function error($message,$status=400) { return new WP_Error('paydar_accounting_error',$message,array('status'=>$status)); }
    private static function reject($message,$status=400) { throw new RuntimeException($message,$status); }
    private static function id($request) { $p=$request->get_url_params(); return isset($p['id'])?(int)$p['id']:0; }
    private static function body($request) { $b=$request->get_json_params(); if(!is_array($b)) self::reject('بدنه درخواست نامعتبر است.'); return $b; }
    private static function text($value,$max=500) { if(!is_string($value)) self::reject('متن نامعتبر است.'); $s=sanitize_textarea_field($value); if(mb_strlen($s)>$max) self::reject('متن بیش از حد طولانی است.'); return trim($s); }
    private static function uint($v) { if((!is_int($v)&&!is_string($v))||!preg_match('/^[0-9]{1,10}$/D',(string)$v)) self::reject('شناسه نامعتبر است.'); return (int)$v; }
    public static function amount($v) {
        if ((!is_string($v)&&!is_int($v))||!preg_match('/^[0-9]{1,13}$/D',(string)$v)) self::reject('مبلغ باید عدد صحیح نامنفی و حداکثر ۱۳ رقمی باشد.');
        return (int)$v;
    }
    public static function valid_date($v) {
        if (!is_string($v)||!preg_match('/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/D',$v,$m)||!checkdate((int)$m[2],(int)$m[3],(int)$m[1])||(int)$m[1]<1900||(int)$m[1]>2200) self::reject('تاریخ سند نامعتبر است.');
        return $v;
    }
    public static function must_for_modules($ok) { return self::must($ok); }
    private static function must($ok) { if($ok===false) self::reject('عملیات پایگاه‌داده انجام نشد؛ هیچ تغییری ثبت نشد.',500); return $ok; }
    /** All mutations serialize on the singleton settings row, including setup and chart changes. */
    private function transaction($fn) {
        global $wpdb;
        try {
            if(get_option('paydar_accounting_schema')!==self::SCHEMA) self::reject('جدول‌های حسابداری آماده نیست.',503);
            self::must($wpdb->query('START TRANSACTION'));
            $lock=$wpdb->get_row('SELECT * FROM '.self::table('settings').' WHERE id=1 FOR UPDATE');
            if(!$lock) self::reject('تنظیمات حسابداری در دسترس نیست.',503);
            $result=$fn($lock);
            self::must($wpdb->query('COMMIT'));
            return rest_ensure_response($result);
        } catch(Throwable $e) {
            $wpdb->query('ROLLBACK');
            $code=$e instanceof RuntimeException && in_array($e->getCode(),array(400,403,404,409,500,503),true)?$e->getCode():500;
            return self::error($code===500?'خطای پایگاه‌داده؛ تغییرات ذخیره نشد.':$e->getMessage(),$code);
        }
    }
    private function log_event($action,$id,$detail) {
        global $wpdb;
        self::must($wpdb->insert(self::table('audit'),array('actor_id'=>get_current_user_id(),'action'=>$action,'object_id'=>$id,'detail'=>wp_json_encode($detail),'created_at'=>current_time('mysql'))));
    }
    public function settings() {
        global $wpdb;
        return rest_ensure_response(array('unit'=>(string)$wpdb->get_var('SELECT unit FROM '.self::table('settings').' WHERE id=1'),'can'=>self::caps()));
    }
    public function setup($r) {
        return $this->transaction(function($lock) use($r){
            global $wpdb; $b=self::body($r); $unit=$b['unit']??'';
            if(!in_array($unit,array('IRR','IRT'),true)) self::reject('واحد ریال یا تومان را انتخاب کنید.');
            if($lock->unit && $lock->unit!==$unit) self::reject('واحد پایه انتخاب شده است و قابل تغییر نیست.',409);
            if(!$lock->unit) { self::must($wpdb->update(self::table('settings'),array('unit'=>$unit),array('id'=>1))); $this->log_event('unit_selected',0,array('unit'=>$unit)); }
            return array('unit'=>$unit);
        });
    }
    public function accounts() { global $wpdb; $rows=$wpdb->get_results('SELECT * FROM '.self::table('accounts').' ORDER BY code'); return is_array($rows)?rest_ensure_response(array('accounts'=>$rows)):self::error('خواندن حساب‌ها انجام نشد.',503); }
    private function account_row($id) { global $wpdb; return $wpdb->get_row($wpdb->prepare('SELECT * FROM '.self::table('accounts').' WHERE id=%d',$id)); }
    public function save_account($r) {
        return $this->transaction(function($lock) use($r){
            global $wpdb;
            if(!$lock->unit) self::reject('مدیر سیستم باید ابتدا واحد پایه را انتخاب کند.');
            $b=self::body($r);$id=self::id($r);$old=$id?$this->account_row($id):null;
            if($id&&!$old) self::reject('حساب پیدا نشد.',404);
            if($old && self::uint($b['version']??0)!==(int)$old->version) self::reject('حساب هم‌زمان تغییر کرده؛ صفحه را تازه کنید.',409);
            $code=self::text($b['code']??'',32);$name=self::text($b['name']??'',190);$kind=$b['kind']??'';
            if(!preg_match('/^[0-9A-Za-z.-]{1,32}$/D',$code)||!$name||!in_array($kind,array('asset','liability','equity','revenue','expense'),true)) self::reject('کد، عنوان یا گروه حساب نامعتبر است.');
            $parent=self::uint($b['parent_id']??0);$postable=!empty($b['postable'])?1:0;$active=!empty($b['active'])?1:0;
            if($parent===$id && $id) self::reject('حساب نمی‌تواند والد خودش باشد.');
            $seen=$id?array($id):array(0);$p=$parent;
            while($p){if(in_array($p,$seen,true)||count($seen)>=5) self::reject('ساختار درختی نامعتبر یا بیش از پنج سطح است.');$seen[]=$p;$row=$this->account_row($p);if(!$row||$row->kind!==$kind||(int)$row->postable||!(int)$row->active) self::reject('والد باید فعال، گروهی و از همان گروه حساب باشد.');$p=(int)$row->parent_id;}
            $t=self::table('accounts');
            if($wpdb->get_var($wpdb->prepare("SELECT id FROM $t WHERE code=%s AND id<>%d",$code,$id))) self::reject('کد حساب تکراری است.',409);
            if($id) {
                $children=(int)$wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $t WHERE parent_id=%d",$id));
                $used=(int)$wpdb->get_var($wpdb->prepare('SELECT COUNT(*) FROM '.self::table('lines').' WHERE account_id=%d',$id));
                if($children && ($kind!==$old->kind||$parent!==(int)$old->parent_id||$postable||!$active)) self::reject('ساختار حساب دارای زیرحساب قابل تغییر نیست.');
                if($used && ($code!==$old->code||$kind!==$old->kind||$parent!==(int)$old->parent_id||$postable!==(int)$old->postable)) self::reject('ساختار حساب استفاده‌شده در سند قابل تغییر نیست.');
            }
            $data=array('code'=>$code,'name'=>$name,'kind'=>$kind,'parent_id'=>$parent,'postable'=>$postable,'active'=>$active,'version'=>$old?((int)$old->version+1):1);
            if($old) self::must($wpdb->update($t,$data,array('id'=>$id))); else {self::must($wpdb->insert($t,$data));$id=(int)$wpdb->insert_id;}
            $this->log_event($old?'account_updated':'account_created',$id,array('before'=>$old,'after'=>$data));
            return array('account'=>$this->account_row($id));
        });
    }
    private function entry_row($id) {global $wpdb;return $wpdb->get_row($wpdb->prepare('SELECT * FROM '.self::table('entries').' WHERE id=%d',$id));}
    private function raw_lines($id) {global $wpdb;return $wpdb->get_results($wpdb->prepare('SELECT * FROM '.self::table('lines').' WHERE entry_id=%d ORDER BY id',$id),ARRAY_A);}
    private function validate_lines($raw) {
        global $wpdb;
        if(!is_array($raw)||count($raw)<2||count($raw)>100) self::reject('هر سند باید ۲ تا ۱۰۰ ردیف داشته باشد.');
        $lines=array();$debit=0;$credit=0;
        foreach($raw as $l) {
            if(!is_array($l)) self::reject('ردیف سند نامعتبر است.');
            $aid=self::uint($l['account_id']??0);$a=$this->account_row($aid);
            if(!$a||!(int)$a->active||!(int)$a->postable) self::reject('حساب ردیف باید فعال و قابل ثبت باشد.');
            $d=self::amount($l['debit']??'0');$c=self::amount($l['credit']??'0');
            if(($d===0)==($c===0)) self::reject('هر ردیف باید فقط یک مبلغ بدهکار یا بستانکار مثبت داشته باشد.');
            $pid=self::text($l['project_id']??'',32);
            if($pid && !$wpdb->get_var($wpdb->prepare('SELECT project_id FROM '.$wpdb->prefix.'paydar_projects WHERE project_id=%s',$pid))) self::reject('پروژه ردیف پیدا نشد.');
            $lines[]=array('account_id'=>$aid,'project_id'=>$pid,'description'=>self::text($l['description']??'',500),'debit'=>(string)$d,'credit'=>(string)$c);
            $debit+=$d;$credit+=$c;
        }
        if($debit!==$credit||$debit===0) self::reject('جمع بدهکار و بستانکار باید برابر و بیشتر از صفر باشد.');
        return $lines;
    }
    public function save_entry($r) {
        return $this->transaction(function($lock) use($r){
            global $wpdb;
            if(!$lock->unit) self::reject('ابتدا واحد پایه را انتخاب کنید.');
            $b=self::body($r);$id=self::id($r);$old=$id?$this->entry_row($id):null;
            if($id&&!$old) self::reject('سند پیدا نشد.',404);
            if($old && ($old->status!=='draft'||$old->reversal_of)) self::reject('سند نهایی قابل ویرایش نیست؛ سند معکوس ثبت کنید.',409);
            if($old && (int)$old->version!==self::uint($b['version']??0)) self::reject('سند تغییر کرده است؛ نسخه تازه را دریافت کنید.',409);
            if(isset($b['source_type']) && $b['source_type']!=='manual') self::reject('در این فاز فقط سند دستی مجاز است.');
            $date=self::valid_date($b['entry_date']??'');$desc=self::text($b['description']??'',2000);
            if(!$desc) self::reject('شرح سند الزامی است.');
            $lines=$this->validate_lines($b['lines']??null);
            $hash=hash('sha256',wp_json_encode(array($date,$desc,$lines)));
            $key=$b['request_key']??'';
            if(!$old) {
                if(!is_string($key)||!preg_match('/^[a-zA-Z0-9-]{16,64}$/D',$key)) self::reject('شناسه درخواست نامعتبر است.');
                $repeat=$wpdb->get_row($wpdb->prepare('SELECT * FROM '.self::table('entries').' WHERE request_key=%s',$key));
                if($repeat){if($repeat->request_hash!==$hash)self::reject('شناسه تکراری با محتوای متفاوت.',409);return array('entry'=>$this->entry_data((int)$repeat->id));}
            }
            $data=array('entry_date'=>$date,'description'=>$desc,'request_hash'=>$hash,'version'=>$old?(int)$old->version+1:1);
            $before=$old?$this->entry_data($id):null;
            if($old) {self::must($wpdb->update(self::table('entries'),$data,array('id'=>$id))); self::must($wpdb->query($wpdb->prepare('DELETE FROM '.self::table('lines').' WHERE entry_id=%d',$id)));}
            else { $data+=array('request_key'=>$key,'source_type'=>'manual','created_by'=>get_current_user_id(),'created_at'=>current_time('mysql'),'status'=>'draft');self::must($wpdb->insert(self::table('entries'),$data));$id=(int)$wpdb->insert_id; }
            foreach($lines as $line) self::must($wpdb->insert(self::table('lines'),$line+array('entry_id'=>$id)));
            $after=$this->entry_data($id);$this->log_event($old?'draft_updated':'draft_created',$id,array('before'=>$before,'after'=>$after));
            return array('entry'=>$after);
        });
    }
    public function post_entry($r) {
        return $this->transaction(function() use($r){
            global $wpdb;$id=self::id($r);$e=$this->entry_row($id);$b=self::body($r);
            if(!$e)self::reject('سند پیدا نشد.',404);
            if($e->status!=='draft')self::reject('این سند قبلاً نهایی شده است.',409);
            if((int)$e->version!==self::uint($b['version']??0))self::reject('نسخه سند تغییر کرده است.',409);
            $this->validate_lines($this->raw_lines($id));
            self::must($wpdb->update(self::table('entries'),array('status'=>'posted','posted_by'=>get_current_user_id(),'posted_at'=>current_time('mysql'),'version'=>(int)$e->version+1),array('id'=>$id)));
            $this->log_event('entry_posted',$id,array('version'=>(int)$e->version+1));
            return array('entry'=>$this->entry_data($id));
        });
    }
    public function reverse_entry($r) {
        return $this->transaction(function() use($r){
            global $wpdb;$id=self::id($r);$e=$this->entry_row($id);$b=self::body($r);
            if(!$e||$e->status!=='posted'||$e->reversal_of)self::reject('فقط سند نهایی اصلی قابل معکوس‌کردن است.',409);
            if($wpdb->get_var($wpdb->prepare('SELECT id FROM '.self::table('entries').' WHERE reversal_of=%d',$id)))self::reject('این سند قبلاً معکوس شده است.',409);
            $date=self::valid_date($b['entry_date']??'');if($date<$e->entry_date)self::reject('تاریخ معکوس نمی‌تواند قبل از سند اصلی باشد.');
            $reason=self::text($b['reason']??'',1500);if(!$reason)self::reject('دلیل اصلاح الزامی است.');
            $data=array('entry_date'=>$date,'description'=>'معکوس سند '.$id.' — '.$reason,'status'=>'posted','source_type'=>'reversal','source_id'=>(string)$id,'request_key'=>'reversal-'.$id,'request_hash'=>hash('sha256',$reason),'reversal_of'=>$id,'created_by'=>get_current_user_id(),'created_at'=>current_time('mysql'),'posted_by'=>get_current_user_id(),'posted_at'=>current_time('mysql'));
            self::must($wpdb->insert(self::table('entries'),$data));$new=(int)$wpdb->insert_id;
            foreach($this->raw_lines($id) as $l) self::must($wpdb->insert(self::table('lines'),array('entry_id'=>$new,'account_id'=>$l['account_id'],'project_id'=>$l['project_id'],'description'=>$l['description'],'debit'=>$l['credit'],'credit'=>$l['debit'])));
            $this->log_event('entry_reversed',$new,array('original_id'=>$id,'reason'=>$reason));
            return array('entry'=>$this->entry_data($new));
        });
    }
    private function entry_data($id) {
        global $wpdb;$e=$this->entry_row($id);if(!$e)return null;
        $e->number='ACC-'.str_pad((string)$e->id,6,'0',STR_PAD_LEFT);
        $e->reversed_by=$wpdb->get_var($wpdb->prepare('SELECT id FROM '.self::table('entries').' WHERE reversal_of=%d',$id));
        $e->lines=$wpdb->get_results($wpdb->prepare('SELECT l.*, a.code, a.name AS account_name FROM '.self::table('lines').' l JOIN '.self::table('accounts').' a ON a.id=l.account_id WHERE l.entry_id=%d ORDER BY l.id',$id));
        return $e;
    }
    public function entry($r) {$data=$this->entry_data(self::id($r));return $data?rest_ensure_response(array('entry'=>$data)):self::error('سند پیدا نشد.',404);}
    private function filters($r,$alias='e') {
        $from=$r->get_param('from');$to=$r->get_param('to');
        if($from)self::valid_date($from);if($to)self::valid_date($to);if($from&&$to&&$from>$to)self::reject('ترتیب بازه تاریخ نامعتبر است.');
        return array($from?:null,$to?:null);
    }
    public function entries($r) {
        global $wpdb;
        try {
            list($from,$to)=$this->filters($r);$where='1=1';if($from)$where.=$wpdb->prepare(' AND e.entry_date >= %s',$from);if($to)$where.=$wpdb->prepare(' AND e.entry_date <= %s',$to);
            $status=$r->get_param('status');if($status){if(!in_array($status,array('draft','posted'),true))self::reject('وضعیت نامعتبر.');$where.=$wpdb->prepare(' AND e.status=%s',$status);}
            $page=max(1,min(100000,(int)$r->get_param('page')));$offset=($page-1)*30;
            $et=self::table('entries');$lt=self::table('lines');
            $rows=$wpdb->get_results("SELECT e.*, (SELECT SUM(l.debit) FROM $lt l WHERE l.entry_id=e.id) AS total, (SELECT x.id FROM $et x WHERE x.reversal_of=e.id) AS reversed_by FROM $et e WHERE $where ORDER BY e.entry_date DESC,e.id DESC LIMIT 30 OFFSET $offset");
            if(!is_array($rows))return self::error('خواندن اسناد انجام نشد.',503);
            return rest_ensure_response(array('entries'=>$rows,'page'=>$page,'total'=>(int)$wpdb->get_var("SELECT COUNT(*) FROM $et e WHERE $where")));
        }catch(Throwable $e){return self::error('فیلتر تاریخ یا وضعیت نامعتبر است.');}
    }
    /** Post a balanced operational event once; unique source request_key makes retries safe. */
    public function post_generated_entry($key,$date,$description,$source_type,$source_id,$lines) {
        $result=$this->transaction(function($lock) use($key,$date,$description,$source_type,$source_id,$lines){
            global $wpdb;
            if(!$lock->unit) self::reject('واحد حسابداری انتخاب نشده است.',503);
            if(!is_string($key)||!preg_match('/^[A-Za-z0-9-]{16,64}$/D',$key))self::reject('شناسه رویداد مالی نامعتبر است.');
            if(!in_array($source_type,array('petty_cash_expense','petty_cash_replenishment'),true))self::reject('منبع رویداد مالی نامعتبر است.');
            $date=self::valid_date($date);$description=self::text($description,2000);$normalized=$this->validate_lines($lines);
            $hash=hash('sha256',wp_json_encode(array($date,$description,$source_type,(string)$source_id,$normalized)));
            $old=$wpdb->get_row($wpdb->prepare('SELECT * FROM '.self::table('entries').' WHERE request_key=%s',$key));
            if($old){if($old->request_hash!==$hash||$old->status!=='posted'||$old->source_type!==$source_type||$old->source_id!==(string)$source_id)self::reject('کلید رویداد قبلاً با اطلاعات دیگری ثبت شده است.',409);return array('entry'=>$this->entry_data((int)$old->id),'duplicate'=>true);}
            $now=current_time('mysql');$data=array('entry_date'=>$date,'description'=>$description,'status'=>'posted','source_type'=>$source_type,'source_id'=>(string)$source_id,'request_key'=>$key,'request_hash'=>$hash,'created_by'=>get_current_user_id(),'created_at'=>$now,'posted_by'=>get_current_user_id(),'posted_at'=>$now);
            self::must($wpdb->insert(self::table('entries'),$data));$id=(int)$wpdb->insert_id;
            foreach($normalized as $line)self::must($wpdb->insert(self::table('lines'),$line+array('entry_id'=>$id)));
            $this->log_event('source_entry_posted',$id,array('source_type'=>$source_type,'source_id'=>(string)$source_id));
            return array('entry'=>$this->entry_data($id),'duplicate'=>false);
        });
        if(is_wp_error($result))return $result;
        return $result instanceof WP_REST_Response?$result->data:$result;
    }
    public function report($r) {
        global $wpdb;
        try {
            list($from,$to)=$this->filters($r);$project=self::text($r->get_param('project_id')??'',32);$account=self::uint($r->get_param('account_id')??0);
            $et=self::table('entries');$lt=self::table('lines');$at=self::table('accounts');
            $where="e.status='posted'";
            if($to)$where.=$wpdb->prepare(' AND e.entry_date<=%s',$to);
            if($project)$where.=$wpdb->prepare(' AND l.project_id=%s',$project);
            $during=$from?$wpdb->prepare('e.entry_date >= %s',$from):'1=1';$before=$from?$wpdb->prepare('e.entry_date < %s',$from):'1=0';
            $rows=$wpdb->get_results("SELECT a.id,a.code,a.name,a.kind, SUM(CASE WHEN $before THEN l.debit-l.credit ELSE 0 END) AS opening, SUM(CASE WHEN $during THEN l.debit ELSE 0 END) AS debit, SUM(CASE WHEN $during THEN l.credit ELSE 0 END) AS credit, SUM(l.debit-l.credit) AS closing FROM $lt l JOIN $et e ON e.id=l.entry_id JOIN $at a ON a.id=l.account_id WHERE $where GROUP BY a.id,a.code,a.name,a.kind ORDER BY a.code");
            $journalWhere=$where.' AND '.$during;if($account)$journalWhere.=$wpdb->prepare(' AND l.account_id=%d',$account);
            $page=max(1,min(100000,(int)$r->get_param('page')));$offset=($page-1)*100;
            $journal=$wpdb->get_results("SELECT e.id AS entry_id,e.entry_date,e.description AS entry_description,l.*,a.code,a.name AS account_name FROM $lt l JOIN $et e ON e.id=l.entry_id JOIN $at a ON a.id=l.account_id WHERE $journalWhere ORDER BY e.entry_date,e.id,l.id LIMIT 100 OFFSET $offset");
            $count=(int)$wpdb->get_var("SELECT COUNT(*) FROM $lt l JOIN $et e ON e.id=l.entry_id WHERE $journalWhere");
            $ledgerOpening='0';if($account&&$from){foreach($rows as $row)if((int)$row->id===$account)$ledgerOpening=(string)$row->opening;}
            $financial=array('revenue'=>'0','expense'=>'0','assets'=>'0','liabilities'=>'0','equity'=>'0','cumulative_profit'=>'0');
            // Return aggregate SQL decimals as strings; client uses BigInt, never floating point.
            $f=$wpdb->get_row("SELECT COALESCE(SUM(CASE WHEN a.kind='revenue' AND ($during) THEN l.credit-l.debit ELSE 0 END),0) AS revenue, COALESCE(SUM(CASE WHEN a.kind='expense' AND ($during) THEN l.debit-l.credit ELSE 0 END),0) AS expense, COALESCE(SUM(CASE WHEN a.kind='asset' THEN l.debit-l.credit ELSE 0 END),0) AS assets, COALESCE(SUM(CASE WHEN a.kind='liability' THEN l.credit-l.debit ELSE 0 END),0) AS liabilities, COALESCE(SUM(CASE WHEN a.kind='equity' THEN l.credit-l.debit ELSE 0 END),0) AS equity, COALESCE(SUM(CASE WHEN a.kind IN ('revenue','expense') THEN l.credit-l.debit ELSE 0 END),0) AS cumulative_profit FROM $lt l JOIN $et e ON e.id=l.entry_id JOIN $at a ON a.id=l.account_id WHERE $where");
            if(!$f||!is_array($rows)||!is_array($journal))return self::error('خواندن گزارش مالی انجام نشد.',503);
            foreach($financial as $k=>$v)$financial[$k]=(string)$f->$k;
            $unit=(string)$wpdb->get_var('SELECT unit FROM '.self::table('settings').' WHERE id=1');
            return rest_ensure_response(array('rows'=>$rows,'journal'=>$journal,'total'=>$count,'page'=>$page,'ledger_opening'=>$ledgerOpening,'financial'=>$financial,'unit'=>$unit,'from'=>$from,'to'=>$to,'project_id'=>$project,'partial'=>!!$project,'posted_count'=>(int)$wpdb->get_var("SELECT COUNT(DISTINCT e.id) FROM $lt l JOIN $et e ON e.id=l.entry_id WHERE $where")));
        }catch(Throwable $e){return self::error('پارامترهای گزارش نامعتبر است.');}
    }
    public function project_summary($r) {
        global $wpdb;
        try {
            $pid=self::text($r->get_param('project_id')??'',32);if(!$pid)self::reject('یک پروژه را انتخاب کنید.');
            $p=$wpdb->get_row($wpdb->prepare('SELECT * FROM '.$wpdb->prefix.'paydar_projects WHERE project_id=%s',$pid));
            if(!$p)self::reject('پروژه پیدا نشد.',404);
            if(!current_user_can(self::READ) && ((int)$p->manager_user_id!==get_current_user_id()||!current_user_can('paydar_edit_exec_own')))self::reject('به این پروژه دسترسی ندارید.',403);
            list($from,$to)=$this->filters($r);$where=$wpdb->prepare("e.status='posted' AND l.project_id=%s",$pid);
            if($from)$where.=$wpdb->prepare(' AND e.entry_date>=%s',$from);if($to)$where.=$wpdb->prepare(' AND e.entry_date<=%s',$to);
            $row=$wpdb->get_row('SELECT COALESCE(SUM(CASE WHEN a.kind=\'revenue\' THEN l.credit-l.debit ELSE 0 END),0) AS revenue, COALESCE(SUM(CASE WHEN a.kind=\'expense\' THEN l.debit-l.credit ELSE 0 END),0) AS expense, COUNT(DISTINCT e.id) AS entries FROM '.self::table('lines').' l JOIN '.self::table('entries').' e ON e.id=l.entry_id JOIN '.self::table('accounts').' a ON a.id=l.account_id WHERE '.$where);
            if(!$row)return self::error('خواندن گزارش پروژه انجام نشد.',503);
            return rest_ensure_response(array('project_id'=>$pid,'name'=>$p->name,'revenue'=>(string)$row->revenue,'expense'=>(string)$row->expense,'entries'=>(int)$row->entries,'unit'=>(string)$wpdb->get_var('SELECT unit FROM '.self::table('settings').' WHERE id=1')));
        }catch(Throwable $e){return self::error($e instanceof RuntimeException?$e->getMessage():'دریافت گزارش انجام نشد.',in_array($e->getCode(),array(400,403,404),true)?$e->getCode():400);}
    }
    public function audit_list($r) {
        global $wpdb;$page=max(1,min(100000,(int)$r->get_param('page')));$offset=($page-1)*50;$t=self::table('audit');
        // Detailed before/after data is retained server-side, not exposed in the list.
        return rest_ensure_response(array('events'=>$wpdb->get_results("SELECT id,actor_id,action,object_id,created_at FROM $t ORDER BY id DESC LIMIT 50 OFFSET $offset"),'page'=>$page,'total'=>(int)$wpdb->get_var("SELECT COUNT(*) FROM $t")));
    }
}
Paydar_Accounting::boot();
