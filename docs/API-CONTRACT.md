# قرارداد API سرور پرتال (akph/v1)

این سند قرارداد بین اپ React و افزونه وردپرس **akph-portal** است (کد سرور: `wordpress-plugin/akph-portal`،
آزمون‌ها: `tests/php`، کلاینت: `src/api/akph`). قواعد کسب‌وکار همان [SERVER-RULES.md](./SERVER-RULES.md) است که
پیاده‌سازی مرجع آن `src/store` است.

## ۱. اصل پایه: کلاینت فقط «فرمان» می‌فرستد

- مرورگر هرگز شماره سند، وضعیت، جمع‌ها، `approved_by`، مانده یا سند محاسبه‌شده نمی‌فرستد؛ فقط **ورودی کاربر** و
  **نام فرمان** (مسیر). سرور کنترل دسترسی، تفکیک وظایف، مرحله، قواعد ثبت، شماره‌گذاری و ممیزی را انجام می‌دهد.
- پاسخ هر فرمان **رکوردهای تغییرکرده** را برمی‌گرداند و اپ آن‌ها را به‌جای نسخه محلی می‌گذارد.
- مسیر عمومی نوشتن رکورد (مثل `PUT records/{slice}`) و مسیر حذف وجود ندارد.

## ۲. قواعد مشترک

| موضوع | قاعده |
|---|---|
| آدرس | `rest_url('akph/v1')`. با پیوند یکتای ساده: `https://site/?rest_route=/akph/v1/projects`؛ پارامترها با `&` وصل می‌شوند: `…/journal-entries&status=pending` |
| پارامترهای سراسری وردپرس | `rest_route`، `_locale`، `_wpnonce`، `_method`، `_envelope`، `_fields`، `_embed` و `_jsonp` (فهرست `Akph_Input::WP_GLOBAL_PARAMS`) هیچ‌جا «فیلد ناشناخته» نیستند و در همه اعتبارسنج‌های سخت‌گیر query و فرم نادیده گرفته می‌شوند (۰٫۷٫۱)؛ هر پارامتر ناشناخته دیگر همچنان `400 akph_unknown_field` می‌گیرد. |
| احراز هویت | کوکی ورود وردپرس **و** سربرگ `X-WP-Nonce` (از `window.AkphPortal.nonce`، عمل `wp_rest`) در **همه** مسیرها، حتی GET |
| نقش | فقط `administrator`، `paydar_senior_manager`، `paydar_accountant`، `paydar_project_manager`؛ هر مسیر یک قابلیت `akph_*` لازم دارد (جدول ۳) |
| مبلغ | عدد صحیح **ریال** (JSON integer یا رشته رقمی)، ≥ ۰، حداکثر ۹٬۰۰۷٬۱۹۹٬۲۵۴٬۷۴۰٬۹۹۱ (دقیق در مرورگر). اعشار، منفی و رقم جداشده (`1,000`) رد می‌شود. در پایگاه‌داده `BIGINT`. |
| تاریخ | میلادی ISO `YYYY-MM-DD` در درخواست و پاسخ؛ زمان‌ها UTC با `Z`. سال مالی = سال شمسی تاریخ (محاسبه در سرور، مستقل از WP-Parsidate). |
| Idempotency | هر `POST/PUT/PATCH` سربرگ `Idempotency-Key` (۸ تا ۱۰۰ نویسه `A-Za-z0-9_-`) دارد. کلید **یک بار برای هر ارسال فرم** ساخته می‌شود و هر تکرار همان ارسال (دوبار کلیک، پاسخ گم‌شده، تلاش دوباره پس از `409 akph_retry`) همان کلید را می‌فرستد. تکرار همان کلید توسط همان کاربر، **همان پاسخ** را با سربرگ `Idempotency-Replayed: true` برمی‌گرداند و چیزی دوباره ساخته نمی‌شود. همان کلید با بدنه دیگر ← `422`. فرمانی که خطا داد کلیدش را نگه نمی‌دارد. |
| نسخه | فرمان روی رکورد موجود `version` را در بدنه یا `If-Match: "3"` می‌فرستد. نسخه کهنه ← `409` با `data.current_version`؛ بدون نسخه ← `428`. |
| تراکنش | همه نوشتن‌های یک فرمان (رکورد، شماره، ممیزی، کلید idempotency) یک تراکنش InnoDB است؛ هر خطا ← ROLLBACK کامل. بعد از **هر** کوئری (از جمله `SELECT … FOR UPDATE`) خطای پایگاه‌داده بررسی می‌شود. بن‌بست (1213) یا پایان مهلت انتظار قفل (1205) ← کل فرمان متوقف و `409 akph_retry` با `data.retryable: true`؛ همان فرمان با همان کلید دوباره قابل ارسال است (کلاینت یک بار خودکار تکرار می‌کند). |
| ترتیب قفل | همه فرمان‌های سند: اول قفل شماره‌گذاری سال (ردیف لنگر `seq = 0` با `INSERT … ON DUPLICATE KEY UPDATE`)، بعد ردیف سند (`SELECT … FOR UPDATE`). |
| کش | همه پاسخ‌ها و صفحه اپ: `Cache-Control: no-store, no-cache, must-revalidate, private, max-age=0` (و `X-LiteSpeed-Cache-Control: no-cache`) |
| دامنه مدیر پروژه | فقط پروژه‌هایی که `manager_user_id` آن‌ها شناسه خودش است؛ رکورد بدون پروژه (ستادی) هرگز. پروژه دیگران `404` (نه `403`) تا شناسه‌ها لو نرود. |

### پاسخ فرمان

```json
{
  "message": "سند ACC-1405-00001 تأیید و قطعی شد.",
  "records": { "journal_entries": [ { "id": "12", "status": "posted", "version": 2, "…": "…" } ] },
  "id": "12",
  "doc_number": "ACC-1405-00001"
}
```

کلیدهای `records`: `projects`، `cost_centers`، `counterparties`، `accounts`، `journal_entries`، `account` (حساب کاربری خود کاربر)، `assistant_settings`، `documents`.

### خطا

```json
{ "code": "akph_segregation_of_duties", "message": "تأیید یا رد سندی که خودتان ثبت کرده‌اید مجاز نیست (تفکیک وظایف).", "data": { "status": 403 } }
```

| وضعیت | کدها | معنا |
|---|---|---|
| 400 | `akph_invalid`، `akph_invalid_json`، `akph_idempotency_key_required`، `akph_invalid_date` | ورودی نامعتبر (فیلد در `data.field`) |
| 400 | `akph_unknown_field`، `akph_forbidden_field` | مسیرهای حساب، دستیار و اسناد: فیلد ناشناخته؛ `role`، `capabilities`، `user_login`، `user_id` و مانند آن (در بدنه یا رشته پرسش) |
| 400 | `akph_file_name` | نام فایل سند پسوند دوگانه دارد (مثل `report.php.pdf`) |
| 401 | `akph_unauthorized` | وارد نشده (مهمان) |
| 403 | `akph_invalid_nonce` | `X-WP-Nonce` نیست یا نامعتبر است |
| 403 | `akph_no_portal_role` | کاربر هیچ‌یک از چهار نقش پرتال را ندارد |
| 403 | `akph_role_forbidden` | نقش، قابلیت این مسیر را ندارد |
| 403 | `akph_forbidden`، `akph_field_forbidden` | دامنه پروژه یا گروه فیلد (`data.fields`) |
| 403 | `akph_segregation_of_duties` | ثبت‌کننده نمی‌تواند سند خودش را تأیید یا رد کند (مقایسه با شناسه کاربر) |
| 403 | `akph_wrong_password` | رمز عبور فعلی نادرست (تغییر ایمیل یا رمز) |
| 404 | `akph_not_found`، `rest_no_route` | رکورد نیست یا در دامنه کاربر نیست |
| 409 | `akph_conflict`، `akph_in_progress` | نسخه کهنه، مرحله نادرست (مثلاً سند قطعی)، کد تکراری، درخواست هم‌زمان با همان کلید |
| 409 | `akph_retry` (`data.retryable: true`) | بن‌بست یا پایان مهلت قفل هنگام کار هم‌زمان دو کاربر؛ هیچ تغییری ذخیره نشده؛ همان فرمان با همان کلید دوباره |
| 422 | `akph_rule`، `akph_idempotency_mismatch` | نقض قاعده حسابداری (نامتوازن، حساب گروهی، سال بسته، ترتیب تاریخ)؛ کلید تکراری با بدنه دیگر |
| 413 | `akph_file_too_large` | تصویر پروفایل بیش از ۲ مگابایت؛ سند بیش از سقف تنظیم‌شده (پیش‌فرض ۲۰، بیشینه ۵۰ مگابایت) |
| 415 | `akph_file_type` | تصویر پروفایل JPG، PNG یا WebP واقعی نیست؛ سند با پسوند یا محتوای غیرمجاز (کد، HTML، SVG، اجرایی) |
| 428 | `akph_version_required` | نسخه رکورد فرستاده نشده |
| 429 | `akph_too_many_attempts` (`data.retry_after`) | ۵ بار رمز نادرست در ۱۵ دقیقه؛ تغییر ایمیل و رمز تا پایان بازه بسته است |
| 429 | `akph_daily_limit` | سقف روزانه پرسش از دستیار برای این کاربر پر شده |
| 500 | `akph_storage` | پوشه خصوصی اسناد ساخته یا فایل ذخیره نشد (دسترسی نوشتن `uploads`)؛ هیچ ردیفی ذخیره نشده |
| 500 | `akph_db_error`، `akph_server_error` | خطای پایگاه‌داده یا سرور؛ هیچ تغییری ذخیره نشده. متن خطای پایگاه‌داده، شماره خطا و کوئری فقط در `error_log` سرور نوشته می‌شود و هرگز در پاسخ REST نیست. |
| 502 | `akph_assistant_unreachable`، `akph_assistant_auth`، `akph_assistant_busy`، `akph_assistant_request`، `akph_assistant_unavailable`، و برای Gemini `akph_assistant_region`، `akph_assistant_quota`، `akph_assistant_proxy` | سرویس هوش مصنوعی در دسترس نبود یا درخواست را نپذیرفت؛ پیام فارسی عمومی، بدون متن پاسخ سرویس |
| 503 | `akph_not_ready` | جدول‌ها روی InnoDB آماده نیست یا PHP ۶۴ بیتی نیست |
| 503 | `akph_assistant_disabled` | «دستیار هوشمند هنوز توسط مدیر سیستم فعال نشده است.» |

## ۳. مسیرها و دسترسی

✓ = مجاز. مدیر سیستم و مدیر ارشد همه‌جا مجازند (با تفکیک وظایف)، جز تنظیمات دستیار و «تنظیمات گزارش و چاپ» که فقط مدیر سیستم دارد.

| مسیر | قابلیت | حسابدار | مدیر پروژه |
|---|---|---|---|
| `GET /me` | `akph_access` | ✓ | ✓ |
| `GET /projects`، `GET /projects/{id}` | `akph_access` | ✓ همه | ✓ فقط خودش |
| `POST /projects` | `akph_projects_create` | — | — |
| `POST|PUT|PATCH /projects/{id}` | `akph_access` + گروه فیلد | فقط `financial` | فقط `exec` پروژه خودش |
| `GET /projects/managers` | `akph_projects_assign` | — | — |
| `GET /cost-centers` | `akph_access` | ✓ همه | ✓ پروژه‌های خودش |
| `POST /cost-centers`، `POST /cost-centers/{id}` | `akph_master_data` | ✓ | — |
| `GET /counterparties` | `akph_access` | ✓ همه | ✓ کارفرمای پروژه‌های خودش |
| `POST /counterparties`، `POST /counterparties/{id}` | `akph_master_data` | ✓ | — |
| `GET /accounts` | `akph_view_all` | ✓ | — |
| `POST /accounts`، `POST /accounts/{id}` | `akph_accounts_manage` | ✓ | — |
| `GET /journal-entries`، `GET /journal-entries/{id}` | `akph_view_all` | ✓ | — |
| `POST /journal-entries`، `POST /journal-entries/{id}` | `akph_journal_create` | ✓ | — |
| `POST /journal-entries/{id}/post`، `/reject` | `akph_journal_approve` | ✓ (نه سند خودش) | — |
| `POST /journal-entries/{id}/reverse` | `akph_journal_reverse` | ✓ | — |
| `GET /reports/trial-balance`، `GET /reports/ledger` | `akph_reports` | ✓ | ✓ فقط ردیف‌های پروژه‌های خودش (`partial: true`) |
| `GET /audit` | `akph_audit_read` | ✓ | — |
| `GET /account`، `POST /account/profile`، `/email`، `/password`، `POST|DELETE /account/avatar`، `GET /account/sessions`، `POST /account/sessions/logout-others` | `akph_access` | ✓ فقط حساب خودش | ✓ فقط حساب خودش |
| `GET /documents`، `GET /documents/{id}`، `GET /documents/{id}/download` | `akph_access` | ✓ همه | ✓ فقط اسناد پروژه‌های خودش (سند ستادی هرگز) |
| `POST /documents`، `POST /documents/{id}/links` | `akph_access` | ✓ | ✓ فقط پروژه‌های خودش |
| `POST /documents/{id}/archive` | `akph_access` + بارگذارکننده، مدیر سیستم یا مدیر ارشد | ✓ سند خودش | ✓ سند خودش در پروژه خودش |
| `GET /assistant/status`، `POST /assistant/ask` | `akph_assistant_use` | ✓ | ✓ داده پروژه‌های خودش |
| `GET|POST /assistant/settings`، `POST /assistant/test` | `akph_ai_manage` (فقط مدیر سیستم) | — | — |
| `GET /petty-cash`، `GET /petty-cash/settings`، `GET /petty-cash/categories`، `GET /petty-cash/funds/{id}` | `akph_petty_submit` | ✓ همه | ✓ صندوق‌های پروژه‌های خودش (صندوق ستاد هرگز) |
| `POST /petty-cash/settings` | `akph_settings` | — | — |
| `POST /petty-cash/categories`، `POST /petty-cash/funds`، `POST|PUT|PATCH /petty-cash/funds/{id}`، `POST /petty-cash/funds/{id}/count`، `/close-period` | `akph_petty_manage` | ✓ | — |
| `POST /petty-cash/expenses`، `POST /petty-cash/requests` | `akph_petty_submit` | ✓ | ✓ صندوق پروژه خودش (متصدی یا مدیر پروژه) |
| `POST /petty-cash/expenses/{id}/approve`، `/reject`، `POST /petty-cash/requests/{id}/approve`، `/reject` | `akph_petty_approve` + نقش مرحله | ✓ مرحله «حسابدار» | ✓ مرحله «مدیر پروژه» پروژه خودش |
| `GET /treasury`، `GET /treasury/settings`، `GET /treasury/schedule`، `GET /treasury/accounts`، `GET /treasury/accounts/{id}/movements`، `/reconciliation`، `GET /payment-requests` | `akph_view_all` | ✓ | — |
| `POST /treasury/settings` | `akph_settings` | — | — |
| `POST /treasury/accounts`، `POST|PUT|PATCH /treasury/accounts/{id}`، `POST /treasury/accounts/{id}/statement`، `POST /treasury/transfers`، `POST /payment-requests/{id}/pay`، `POST /receipts`، `POST /cheques/{id}/status`، `POST /bank-statement-lines/{id}/match`، `/voucher` | `akph_treasury_manage` | ✓ | — |
| `POST /payment-requests` | `akph_payment_request` | ✓ | — |
| `POST /payment-requests/{id}/approve`، `/reject`، `POST /receipts/{id}/approve`، `/reject` | `akph_payment_approve` | ✓ تا آستانه (نه درخواست خودش) | — |
| `GET /approvals` | `akph_access` | ✓ موارد مرحله خودش | ✓ موارد مرحله خودش در پروژه‌های خودش |
| `GET /report-settings` | `akph_access` | ✓ | ✓ |
| `POST /report-settings`، `GET /report-settings/users`، `POST|DELETE /report-settings/logo` | `akph_report_settings` (فقط مدیر سیستم) | — | — |
| `GET /print/signatures` | `akph_access` + دسترسی به همان رکورد | ✓ | ✓ فقط رکورد پروژه‌های خودش (سند حسابداری، درخواست پرداخت و دریافت هرگز) |
| `GET /contracts`، `GET /contracts/{id}`، `GET /contracts/guarantees-due`، `GET /reports/contracts`، `GET /statements`، `GET /statements/{id}` | `akph_access` | ✓ همه | ✓ فقط پروژه‌های خودش |
| `POST /contracts`، `POST /contracts/{id}`، `/amendments`، `/guarantees`، `/advance`، `POST /contract-guarantees/{id}` | `akph_contracts_manage` | ✓ | — |
| `POST /contracts/{id}/approve`، `/reject`، `POST /contract-amendments/{id}/approve`، `/reject` | `akph_contracts_approve` + نقش مرحله | — | ✓ مرحله «مدیر پروژه» قرارداد جزء پروژه خودش |
| `POST /client-statements`، `POST /subcontractor-statements`، `POST /statements/{id}` | `akph_statements_prepare` | — | ✓ پروژه خودش |
| `POST /statements/{id}/approve`، `/return`، `/reject` | مرحله تهیه: `akph_statements_prepare`؛ مرحله تأیید: `akph_contracts_approve` + نقش مرحله | ✓ مرحله «حسابدار» | ✓ مراحل «مدیر پروژه» پروژه خودش |
| `POST /statements/{id}/void` | مدیر ارشد یا مدیر سیستم | — | — |
| `GET /procurement`، `GET /inventory`، `GET /inventory/kardex?material_id=&warehouse_id=` | `akph_access` | ✓ همه | ✓ فقط پروژه‌ها و انبارهای پروژه‌های خودش؛ بدون ارزش ریالی کالا |
| `POST /requisitions`، `POST /requisitions/{id}/cancel` | `akph_procurement_request` | — | ✓ پروژه خودش |
| `POST /requisitions/{id}/approve`، `/reject`، `POST /purchase-orders/{id}/approve`، `/reject`، `POST /vendor-invoices/{id}/approve`، `/reject` | `akph_procurement_approve` + نقش مرحله | ✓ مرحله «حسابدار» (درخواست) و فاکتور | ✓ مرحله «مدیر پروژه» درخواست پروژه خودش |
| `POST /requisitions/{id}/rfqs`، `POST /rfqs/{id}/quotes`، `/award`، `POST /purchase-orders`، `POST /goods-receipts/{id}/invoices`، `POST /vendor-invoices/{id}` | `akph_procurement_manage` | ✓ | — |
| `POST /purchase-orders/{id}/receipts`، `POST /goods-receipts/{id}/returns` | `akph_inventory_receive` | ✓ | ✓ پروژه خودش |
| `POST /store-issues`، `/confirm`، `/cancel`، `/returns`، `POST /stock-transfers`، `/deliver`، `/cancel` | `akph_inventory_issue` | — | ✓ انبارهای پروژه خودش |
| `POST /materials`، `POST /materials/{id}`، `POST /warehouses`، `POST /warehouses/{id}`، `POST /stocktakes`، `/approve`، `/reject` | `akph_inventory_manage` | ✓ | — |
| `GET /payroll`، `POST /employees`، `POST /employees/{id}`، `POST /payroll/periods`، `/timesheets`، `/calculate`، `/approve`، `/reject` | `akph_payroll_manage` (اطلاعات شخصی) | ✓ | — هرگز |
| `POST /procurement/settings`، `POST /payroll/settings` | `akph_settings` | — | — |
| `GET /` (فهرست فضای نام) | `akph_access` | ✓ | ✓ |

## ۴. جزئیات مسیرها

### GET /me

```json
{
  "id": "7", "display_name": "حسابدار", "role": "حسابدار", "role_slug": "paydar_accountant",
  "avatar_url": null, "view_all": true, "project_ids": [],
  "currency": "toman", "site_currency": "toman",
  "preferences": { "currency": "site", "rows_per_page": 25, "start_page": "/" },
  "fiscal_year": 1405, "closed_fiscal_years": [], "today": "2026-09-25",
  "caps": { "akph_access": true, "akph_assistant_use": true, "…": false }, "server_version": "0.6.0"
}
```

برای مدیر پروژه `view_all: false` و `project_ids` فهرست شناسه پروژه‌هایی است که `manager_user_id` آن‌ها کاربر است.
`currency` واحد نمایش همین کاربر است (ترجیح شخصی در «حساب کاربری من»، وگرنه `site_currency` از تنظیمات افزونه)؛ مبالغ
همیشه ریال‌اند. `avatar_url` تصویر پروفایل بارگذاری‌شده یا `null` (اپ حروف اول نام را نشان می‌دهد؛ سرویس آواتار بیرونی
به کار نمی‌رود).

### پروژه‌ها

`GET /projects` ← `{ "projects": [Project] }`

```json
{
  "id": "5", "code": "PRJ-1405-00001", "name": "برج نمونه", "client_id": null, "client_name": "کارفرما",
  "consultant_name": "", "manager_user_id": "21", "manager_name": "مدیر پروژه", "site_supervisor": "",
  "location": "", "contract_ref": "", "description": "", "status": "active", "physical_progress": 40,
  "start_date": "2026-04-04", "end_date": null, "budget": 125000000000, "contract_amount": 200000000000,
  "manual_summary": { "revenue": 32500000000, "cost": 21000000000, "cash": 0, "receivable": 0, "payable": 0, "note": "…" },
  "legacy_id": "PRJ-24-AAA111", "version": 3, "editable": ["exec"],
  "created_at": "2026-09-25T01:50:00Z", "updated_at": "2026-09-25T01:52:00Z"
}
```

- `status`: `active`، `mobilizing`، `provisional_handover`، `suspended`، `closed`.
- `manual_summary` رقم دستی (یا منتقل‌شده) است و **هیچ سند حسابداری نمی‌سازد**؛ ارقام دفتری پروژه از اسناد قطعی محاسبه می‌شود.
- `editable` گروه‌هایی است که کاربر جاری می‌تواند بنویسد.

`POST /projects` (ایجاد) — بدنه فقط فیلدهای گروه‌های مجاز؛ `name` و `client_name` (یا `client_id` کارفرمای ثبت‌شده) الزامی:

```json
{ "name": "برج تازه", "client_name": "کارفرما", "budget": 5000000, "manager_user_id": "21", "start_date": "2026-04-01" }
```

پاسخ `201` با `records.projects[0]`؛ کد `PRJ-{سال}-{ترتیب}` را سرور می‌دهد.

`POST /projects/{id}` (ویرایش جزئی) — فقط فیلدهای تغییرکرده + `version`:

| گروه | فیلدها | قابلیت |
|---|---|---|
| `base` | `name`، `client_id`، `client_name`، `location`، `contract_ref`، `description` | `akph_projects_edit_base` |
| `budget` | `budget`، `contract_amount` | `akph_projects_edit_budget` |
| `assign` | `manager_user_id` (فقط کاربر با نقش مدیر پروژه یا خالی) | `akph_projects_assign` |
| `exec` | `status`، `physical_progress` (۰–۱۰۰)، `site_supervisor`، `consultant_name`، `start_date`، `end_date` | `akph_projects_edit_exec_all` یا `…_own` برای پروژه خودش |
| `financial` | `manual_revenue`، `manual_cost`، `manual_cash`، `manual_receivable`، `manual_payable`، `manual_summary_note` | `akph_projects_edit_financial` |

کلید ناشناخته ← `400`؛ فیلد بیرون از گروه‌های مجاز ← `403 akph_field_forbidden` با `data.fields`؛ `id`، `code`، `version`،
`editable` نادیده گرفته می‌شوند.

### مراکز هزینه

`GET /cost-centers` ← `{ "cost_centers": [{ "id", "code", "name", "project_id", "type", "manager_name", "budget", "active", "version" }] }`

`POST /cost-centers`:

```json
{ "name": "کارگاه سازه", "project_id": "5", "type": "project_site", "manager_name": "", "budget": 0, "code": "" }
```

`type`: `project_site`، `headquarters`، `central_warehouse`، `machinery`، `technical_office`، `other`. کد خالی ← `CC-{سال}-{ترتیب}`.
کد دستی به شکل شماره خودکار (`^[A-Z]+-\d{4}-\d+$`، بدون توجه به کوچکی و بزرگی حروف، مثل `CC-1405-00001`) ← `400` با
`data.field = "code"`؛ رکورد موجود کد خودش را نگه می‌دارد. کد تکراری ← `409`؛ کد مرکزی که در سند استفاده شده عوض نمی‌شود (`422`).

### طرف‌های حساب

`POST /counterparties`:

```json
{ "kind": "supplier", "name": "تأمین‌کننده", "national_id": "", "economic_code": "", "phone": "", "email": "", "address": "", "sheba": "IR…", "bank_name": "", "trade_type": "" }
```

`kind`: `client`، `supplier`، `subcontractor`، `consultant`، `employee`، `bank`، `other`. شبا: `IR` + ۲۴ رقم با رقم کنترل درست (ISO 13616).
تغییر نام کارفرما، نام کارفرمای پروژه‌های متصل را در همان تراکنش عوض می‌کند (هر دو در `records`).

### کدینگ حساب‌ها

`GET /accounts` ← فهرست تخت: `{ "code", "title", "level", "nature", "parent_code", "active", "postable", "version" }`.
`level`: `group` › `general` (کل) › `subsidiary` (معین) › `detail` (تفصیلی)؛ `nature`: `debit`، `credit`، `both`.

`POST /accounts`: `{ "code": "11109", "title": "بانک …", "level": "detail", "nature": "debit", "parent_code": "111" }` — سطح باید
دقیقاً یکی پایین‌تر از والد و کد با کد والد شروع شود. حسابی که در سند استفاده شده کد، سطح و والدش عوض نمی‌شود؛ والدی که ردیف سند
دارد زیرحساب نمی‌گیرد. `postable` = فعال، معین/تفصیلی و بدون زیرحساب فعال.

### سند حسابداری دستی

```
ایجاد (pending، شماره موقت DRF-YYYY-NNNNN)
  ├─ ویرایش: فقط ثبت‌کننده، فقط pending ─┐
  ├─ رد (reject): کاربر دیگر → rejected    │
  └─ تأیید (post): کاربر دیگر → posted، شماره قطعی ACC-YYYY-NNNNN
          └─ معکوس (reverse): سند تازه pending (DRF) با بدهکار/بستانکار جابه‌جا؛ سند اصلی هرگز ویرایش یا حذف نمی‌شود
                ├─ تأیید (post): کاربر دیگری جز درخواست‌کننده → posted با شماره ACC؛ از این لحظه سند اصلی معکوس‌شده است
                └─ رد (reject): کاربر دیگر → rejected؛ سند اصلی برای درخواست تازه آزاد می‌شود
```

`POST /journal-entries`:

```json
{
  "date": "2026-09-23",
  "description": "سند اصلاحی",
  "entry_type": "general",
  "project_id": "5",
  "lines": [
    { "account_code": "11101", "debit": 10000, "credit": 0, "description": "واریز", "project_id": "5", "cost_center_id": "8", "counterparty_id": null },
    { "account_code": "41302", "debit": 0, "credit": 10000, "description": "درآمد متفرقه" }
  ]
}
```

- `entry_type`: `general`، `opening`، `adjustment`، `receipt`، `payment`، `purchase`، `petty_cash`، `statement`، `payroll`، `inventory`، `sales`.
- دست‌کم ۲ و حداکثر ۲۰۰ ردیف؛ هر ردیف فقط یک مبلغ مثبت؛ Σ بدهکار = Σ بستانکار > ۰ (وگرنه `422`).
- فقط حساب قابل ثبت (`postable`)؛ حساب گروه یا کل یا دارای زیرحساب ← `422`.
- سال مالی بسته ← `422`. شماره `DRF` همان لحظه صادر می‌شود.

`POST /journal-entries/{id}` (ویرایش پیش‌نویس): همان بدنه + `version`؛ فقط ثبت‌کننده و فقط `pending`؛ سند قطعی و سند معکوس ← `409`.

`POST /journal-entries/{id}/post`: `{ "version": 1 }`. کاربر دیگر (شناسه ≠ `created_by`، حتی برای مدیر ارشد و مدیر سیستم).
ردیف‌ها دوباره اعتبارسنجی می‌شوند؛ تاریخ نه بعد از امروز و نه قبل از آخرین سند قطعی همان سال (شماره‌ها به ترتیب تاریخ‌اند).
شماره `ACC-{سال شمسی}-{ترتیب ۵ رقمی}` داخل همان تراکنش با کلید یکتای `(prefix, fiscal_year, seq)`؛ شمارنده هر سال از ۱.

`POST /journal-entries/{id}/reject`: `{ "version": 1, "reason": "…" }`.

`POST /journal-entries/{id}/reverse`: `{ "version": 2, "reason": "ثبت اشتباه", "date": "2026-09-25" }` (تاریخ اختیاری،
پیش‌فرض امروز، نه بعد از امروز). پاسخ `201` با سند اصلی (`reversed_by` با `status: "pending"`) و سند معکوس در انتظار تأیید
(`status: "pending"`، `draft_number` از سری `DRF`، `doc_number: null`، `reversal_of`). سند معکوس **تا تأیید کاربر دوم در دفاتر
نیست**: همان `POST /journal-entries/{id}/post` با شناسه سند معکوس و کاربری غیر از درخواست‌کننده (وگرنه
`403 akph_segregation_of_duties`) آن را قطعی می‌کند و شماره `ACC` می‌دهد؛ پاسخ آن هر دو سند را دارد. رد آن
(`/reject`) سند اصلی را برای درخواست تازه آزاد می‌کند (`reversed_by: null`) و سند ردشده همچنان `reversal_of` را نشان می‌دهد.
درخواست دوم در حالی که یکی در انتظار است، معکوس دوباره سند معکوس‌شده و معکوسِ معکوس ← `409`. ممیزی:
`entry_reversal_requested` هنگام درخواست و `entry_reversed` هنگام تأیید.

شکل سند در پاسخ:

```json
{
  "id": "12", "doc_number": "ACC-1405-00001", "draft_number": "DRF-1405-00001", "fiscal_year": 1405, "date": "2026-09-23",
  "description": "…", "entry_type": "general", "source_type": "manual", "project_id": "5", "status": "posted", "total": 10000,
  "lines": [{ "line_no": 1, "account_code": "11101", "project_id": "5", "cost_center_id": "8", "counterparty_id": null, "description": "…", "debit": 10000, "credit": 0 }],
  "reversal_of": null, "reversed_by": null,
  "…": "reversed_by وقتی سند معکوس دارد: { \"id\", \"doc_number\", \"draft_number\", \"status\" } (pending یا posted)",
  "created_by": "3", "created_by_name": "…", "created_at": "…Z", "approved_by": "4", "approved_by_name": "…", "approved_at": "…Z",
  "rejected_by": null, "rejected_at": null, "status_note": "", "version": 2
}
```

`GET /journal-entries` پارامترها: `status` (`pending|posted|rejected`)، `from`، `to`، `fiscal_year`، `page`، `per_page` (≤ ۵۰۰).

### گزارش‌ها

`GET /reports/trial-balance&from=2026-03-21&to=2026-09-25&project_id=5` (همه اختیاری):

```json
{ "rows": [{ "account_code": "11101", "title": "…", "nature": "debit", "opening": 0, "debit": 10000, "credit": 0, "closing": 10000, "closing_debit": 10000, "closing_credit": 0 }],
  "totals": { "opening": 0, "debit": 10000, "credit": 10000, "closing": 0 }, "balanced": true, "from": "…", "to": "…", "project_id": null, "partial": false }
```

`GET /reports/ledger&account_code=11101&from=…&to=…&project_id=…&page=1&per_page=200`: `opening`، `carried` (مانده منتقل به این
صفحه) و `rows[]` با `balance` جاری. فقط اسناد قطعی. برای کاربر بدون `akph_view_all` (مدیر پروژه) `entry_description` (شرح کل سند)
همیشه `null` است؛ شرح ردیف خودش (`description`) می‌ماند.

### ممیزی

`GET /audit&object_type=entry&object_id=12&page=1` ← `{ "events": [{ "id", "user_id", "user_name", "user_role", "action", "object_type", "object_id", "object_ref", "before", "after", "created_at" }], "page", "total" }`.
هر فرمان موفق ممیزی با **شناسه کاربر**، رکورد قبل و بعد و `Idempotency-Key` ثبت می‌کند (داخل همان تراکنش).

### حساب کاربری من

همه مسیرها فقط روی **کاربر جاری** کار می‌کنند و هیچ‌کدام شناسه کاربر نمی‌گیرند. `role`، `roles`، `capabilities`، `caps`،
`user_login`، `user_id`، `id`، `user_pass` و فیلدهای مشابه در بدنه یا رشته پرسش ← `400 akph_forbidden_field`؛ هر فیلد
ناشناخته دیگر ← `400 akph_unknown_field`. هر تغییر با شناسه کاربر در ممیزی (`object_type: "user"`) ثبت می‌شود؛ رمز عبور
هرگز (در ممیزی، کلید idempotency فقط HMAC آن با کلید سایت می‌ماند).

`GET /account` ← `{ "account": Account }`:

```json
{ "id": "7", "user_login": "acc1", "display_name": "حسابدار", "first_name": "", "last_name": "", "email": "…",
  "mobile": "09121234567", "role": "حسابدار", "role_slug": "paydar_accountant", "avatar_url": null,
  "preferences": { "currency": "site", "rows_per_page": 25, "start_page": "/" }, "site_currency": "toman",
  "registered_at": "2025-01-01T08:00:00Z", "version": 3, "password_min_length": 12, "avatar_max_bytes": 2097152 }
```

| مسیر | بدنه | قاعده |
|---|---|---|
| `POST /account/profile` | `display_name`، `first_name`، `last_name`، `mobile`، `preferences`، `version` | فرمان (Idempotency-Key) با نسخه حساب؛ فقط فیلدهای فرستاده‌شده تغییر می‌کنند. موبایل: ارقام فارسی و فاصله و پیشوند `+98`/`0098`/`98` پذیرفته و به `09XXXXXXXXX` تبدیل می‌شود؛ `""` پاک می‌کند. `preferences`: `currency` (`site`، `toman`، `rial`)، `rows_per_page` (۱۰، ۲۵، ۵۰، ۱۰۰)، `start_page` (از فهرست صفحه‌های اپ) |
| `POST /account/email` | `email`، `current_password` | رمز فعلی با `wp_check_password`؛ نشانی آزاد (ایمیل حساب دیگر ← `409`)؛ اول رمز بررسی می‌شود |
| `POST /account/password` | `current_password`، `new_password` | دست‌کم ۱۲ نویسه و متفاوت با رمز فعلی؛ `wp_set_password`، همه نشست‌های دیگر با `WP_Session_Tokens::destroy_others` بسته و کوکی همین نشست دوباره صادر می‌شود |
| `POST /account/avatar` | multipart، فایل `avatar` | JPG/PNG/WebP تا ۲ مگابایت، بررسی با `wp_check_filetype_and_ext` و `getimagesize`؛ `WP_Image_Editor` مربع وسط را به ۲۵۶×۲۵۶ برش می‌دهد و در کتابخانه رسانه با مالکیت همان کاربر ذخیره می‌کند؛ تصویر قبلی حذف می‌شود؛ `get_avatar` با `pre_get_avatar_data` همین تصویر را نشان می‌دهد |
| `DELETE /account/avatar` | — | تصویر بارگذاری‌شده و پیوست آن حذف می‌شود |
| `GET /account/sessions` | — | `{ "sessions": [{ "current", "login_at", "expires_at", "ip", "device" }] }` (`device` مثل «Chrome روی Windows»؛ رشته خام مرورگر برنمی‌گردد) |
| `POST /account/sessions/logout-others` | `{}` | همه نشست‌ها جز نشست جاری بسته می‌شوند |

تغییر ایمیل و رمز پس از **۵ رمز نادرست در ۱۵ دقیقه** تا پایان بازه ← `429 akph_too_many_attempts` (حتی با رمز درست).

### ورود و خروج (صفحه پرتال، نه REST)

- مهمانی که `/?akph_portal=1` را باز کند صفحه ورود پرتال را می‌گیرد (HTML، بدون کش، `X-Frame-Options: SAMEORIGIN` و
  `frame-ancestors 'self'`). فرم با `POST` به همان نشانی و فیلدهای `log`، `pwd`، `rememberme`، `_akph_nonce` و `akph_login`
  فرستاده و روی `init` پردازش می‌شود: بررسی nonce ← قفل IP (transient، ۵ شکست در ۹۰۰ ثانیه) ← `wp_signon(…, is_ssl())` ← کاربر بدون
  نقش پرتال: نشست تازه‌اش نابود و خارج می‌شود. نتیجه با `wp_safe_redirect` به اپ (صفحه شروع کاربر، `#/…`) یا به صفحه ورود با
  پارامتر `login=failed|empty|locked|expired|noaccess` که پیام فارسی ثابت نشان می‌دهد (پیام شکست برای کاربر ناموجود و رمز نادرست یکی است).
- `wp-login.php`: برای مدیر سیستم بدون تغییر؛ مدیر ارشد، مدیر پروژه و حسابدار (یا مرورگری با کوکی `akph_portal_member`) در
  `action=login` به صفحه ورود پرتال هدایت می‌شوند؛ `logout`، `lostpassword`، `rp` و `resetpass` دست‌نخورده‌اند. `login_redirect`
  این نقش‌ها را به اپ می‌برد.
- خروج: اپ به `logoutUrl` (همان `wp_logout_url()` با nonce، از `window.AkphPortal`) می‌رود؛ `logout_redirect` با اولویت ۹۹ (بعد از
  paydar-portal) درخواستی را که از پرتال آمده به صفحه ورود پرتال با `login=out` برمی‌گرداند (بازنشانی رمز: `login=checkemail` و `login=reset`).

### اسناد و پیوست‌ها

فایل‌ها در `wp-content/uploads/akph-private/{سال}/{ماه}/` با نام تصادفی ۳۲ نویسه هگز (بدون پسوند) ذخیره می‌شوند؛ پوشه
`.htaccess` (`Require all denied` / `Deny from all`)، `web.config` و `index.php` خالی دارد و هرگز مستقیم سرو نمی‌شود.

- `POST /documents` (فرمان، `multipart/form-data`، `Idempotency-Key`): فایل `file` و فیلدهای `title`، `doc_type`، `description`،
  `project_id`، `cost_center_id`، `counterparty_id`، `entity_type` و `entity_id` (فیلد دیگر ← `400`). پسوندهای مجاز: pdf، jpg، jpeg،
  png، webp، heic، xlsx، xls، docx، doc، csv، txt، zip، dwg، dxf؛ نوع واقعی با finfo و `wp_check_filetype_and_ext`؛ پسوند دوگانه
  ← `400 akph_file_name`؛ سقف حجم ← `413`؛ نوع غیرمجاز ← `415`. شماره `DOC-{سال مالی}-00001` در سرور. SHA-256 نگه داشته می‌شود و
  اگر همان فایل قبلاً برای همان رکورد بارگذاری شده باشد، سند باز هم ذخیره می‌شود و پاسخ `duplicate_of` (شماره‌های قبلی) و هشدار
  در `message` دارد. اثر انگشت Idempotency شامل SHA-256 فایل و فیلدهاست. پاسخ `201` با `records.documents`.
  `doc_type`: `client_contract`، `subcontract`، `amendment`، `client_statement`، `subcontractor_statement`، `measurement`،
  `supplier_invoice`، `petty_invoice`، `letter`، `minutes`، `drawing`، `qc_report`، `guarantee`، `financial`، `photo`، `other`.
  `entity_type`: `project`، `contract`، `counterparty`، `journal_entry`، `invoice`، `statement`، `petty_expense`، `payment`،
  `payroll`، `inventory_doc`، `other`. پروژه و طرف حساب هم خودکار پیوند می‌شوند.
- `GET /documents` با `status=active|archived|all` (پیش‌فرض active)، `project_id`، `doc_type`، `entity_type` + `entity_id`، `q`
  (جستجوی عنوان، شماره یا نام فایل)، `page`، `per_page` (تا ۲۰۰) ← `{ "documents": [...], "page", "total" }`.
- `GET /documents/{id}` ← `{ "document": { "id", "doc_number", "title", "doc_type", "description", "project_id", "cost_center_id",
  "counterparty_id", "file_name", "mime", "size", "sha256", "version", "uploaded_by", "uploaded_by_name", "uploaded_at", "status",
  "archived_at", "links": [{ "entity_type", "entity_id" }], "preview", "can_archive" } }`.
- `GET /documents/{id}/download` (با `inline=1` برای پیش‌نمایش): فایل از طریق PHP با `Content-Disposition: attachment`،
  `X-Content-Type-Options: nosniff`، `Content-Security-Policy` محدود و `Cache-Control: no-store`؛ `inline` فقط برای PDF و تصویر
  (JPG، PNG، WebP)، بقیه همیشه `application/octet-stream` پیوست. هر دانلود در ممیزی ثبت می‌شود.
- `POST /documents/{id}/links` (فرمان) با `{ "entity_type", "entity_id" }`؛ پیوند تکراری بی‌اثر است.
- `POST /documents/{id}/archive` (فرمان، `version`): بایگانی به‌جای حذف؛ فقط بارگذارکننده، مدیر سیستم یا مدیر ارشد؛ اگر سند پیوست
  سند حسابداری قطعی باشد ← `422 akph_rule`. هیچ مسیر حذفی وجود ندارد و فایل روی دیسک می‌ماند.
- دامنه: مدیر پروژه فقط اسناد پروژه‌های خودش را می‌بیند، دانلود می‌کند یا پیوند می‌دهد (دیگران ← `404`)؛ سند بدون پروژه برای او ممنوع.

### دستیار مدیریت

کلید API هرگز به مرورگر نمی‌رود و مدل فقط داده‌ای را می‌بیند که همان کاربر اجازه دیدنش را دارد.

- `GET /assistant/status` ← `{ "enabled", "can_manage", "daily_limit", "used_today", "remaining", "question_max" }`.
- `POST /assistant/ask` با `{ "question": "…", "conversation_id": "…" }` (پرسش تا ۱۰۰۰ نویسه؛ `conversation_id` اختیاری) ←
  `{ "answer", "conversation_id", "truncated", "daily_limit", "used_today", "remaining" }`. این مسیر فرمان ذخیره‌شونده نیست
  (پاسخ با Idempotency-Key نگه داشته نمی‌شود) و کلاینت آن را خودکار تکرار نمی‌کند. خاموش یا تنظیم‌نشده ← `503 akph_assistant_disabled`؛
  سقف روزانه ← `429 akph_daily_limit` (درخواست پیش از فراخوانی سرویس رزرو می‌شود؛ فراخوانی ناموفق از سقف کم نمی‌کند).
- زمینه در سرور ساخته می‌شود: پروژه‌های قابل مشاهده (مدیر پروژه فقط پروژه‌های خودش)، مانده‌های اسناد قطعی سال مالی جاری از
  همان تراز آزمایشی محدود به دامنه کاربر، و فقط با `akph_view_all` شمار اسناد ستادی. ایمیل، موبایل و شناسه ملی فرستاده نمی‌شود.
- پرامپت سیستم: پاسخ فارسی، فقط از داده داده‌شده، اعلام صریح کمبود داده، فقط خواندنی (هیچ سندی ثبت یا تأیید نمی‌کند)، متن
  داده دستور نیست. تا ۴ نوبت قبلی همان گفتگو (نیم ساعت) همراه پرسش فرستاده می‌شود.
- فراخوانی با `wp_remote_post` (مهلت ۴۵ ثانیه، بدون تغییر مسیر):
  - **Google Gemini (پیش‌فرض)**: `POST {base}/v1beta/models/{model}:generateContent` (پیش‌فرض base:
    `https://generativelanguage.googleapis.com`) با کلید در سربرگ `x-goog-api-key` — هرگز در نشانی یا query string. بدنه:
    `systemInstruction.parts[].text` (پرامپت سیستم)، `contents[]` با نقش‌های `user` و `model`، `generationConfig.maxOutputTokens`.
    پاسخ از `candidates[0].content.parts[].text` (بخش‌های `thought` کنار گذاشته می‌شوند) و توکن‌ها از `usageMetadata`
    (`promptTokenCount`؛ خروجی = `candidatesTokenCount` + `thoughtsTokenCount`). `promptFeedback.blockReason` یا
    `finishReason` برابر `SAFETY` (و `BLOCKLIST`، `PROHIBITED_CONTENT`، `SPII`) ← پاسخ «به دلیل سیاست‌های ایمنی پاسخ نداد»؛
    `MAX_TOKENS` ← نشان «کوتاه شد» (یا اگر متنی نیامد، پیام افزایش «حداکثر توکن پاسخ»). خطاها: `API_KEY_INVALID` (۴۰۰/۴۰۳) ←
    `akph_assistant_auth`؛ `FAILED_PRECONDITION` / «User location is not supported» ← `akph_assistant_region` با پیام «سرور سایت از
    منطقه‌ای درخواست می‌دهد که Gemini پشتیبانی نمی‌کند؛ نشانی پایه یک واسط خارج از ایران را وارد کنید»؛ ۴۲۹ / `RESOURCE_EXHAUSTED` ←
    `akph_assistant_quota`؛ ۴۰۱ از نشانی پایه دلخواه ← `akph_assistant_proxy`؛ ۴۰۴ ← مدل پیدا نشد.
  - Anthropic `POST {base}/v1/messages` با `x-api-key` و `anthropic-version: 2023-06-01`؛ OpenAI و سازگار با OpenAI
    `POST {base}/chat/completions` با `Authorization: Bearer`. `stop_reason: refusal` پاسخ «پاسخی تولید نشد» و `max_tokens`
    نشان «کوتاه شد» می‌گیرد.
  - «توکن واسط» (اختیاری) فقط وقتی نشانی پایه دلخواه تنظیم شده، در سربرگ `X-Akph-Proxy-Token` فرستاده می‌شود.
- ثبت: جدول `{prefix}akph_ai_requests` (کاربر، زمان، توکن ورودی و خروجی، نتیجه)؛ متن پرسش و پاسخ فقط وقتی مدیر سیستم
  «ثبت متن» را روشن کرده باشد.

تنظیمات (`akph_ai_manage`):

- `GET /assistant/settings` ← `{ "settings": { "enabled", "provider", "base_url", "model", "max_tokens", "daily_limit", "log_content", "key": { "source": "constant|settings|unreadable|none", "hint": "•••• 1234" }, "proxy_token": { "source": "settings|unreadable|none", "hint": "•••• 9876" }, "encryption_ready", "configured" } }`.
- `POST /assistant/settings` (فرمان): همان فیلدها به‌علاوه `api_key` (کلید تازه)، `clear_key`، `proxy_token` (توکن واسط تازه؛
  ۱۶ تا ۵۰۰ نویسه ASCII بدون فاصله) و `clear_proxy_token`. `provider`: `gemini` (پیش‌فرض، مدل پیش‌فرض `gemini-3.8-flash`)،
  `anthropic`، `openai`، `compatible` (برای `compatible` نشانی پایه `https://…/v1` لازم است). کلید و توکن واسط با
  `sodium_crypto_secretbox` و کلید مشتق از `AUTH_KEY` و `SECURE_AUTH_SALT` رمز می‌شوند؛ ثابت `AKPH_AI_API_KEY` در wp-config.php
  اولویت دارد.
- `POST /assistant/test` ← `{ "ok": true|false, "message": "…" }` (فقط موفق/ناموفق و پیام عمومی).

هیچ پاسخ REST، ردیف ممیزی، کلید ذخیره‌شده فرمان، ردیف ثبت درخواست، پیام خطا یا خط لاگ شامل کلید API یا توکن واسط نیست.

### موتور ثبت رویدادها (مشترک تنخواه و خزانه)

- هر رویداد مالی (تأیید نهایی هزینه تنخواه، پرداخت، تأیید دریافت، انتقال، وصول/برگشت چک، تعدیل شمارش، سند مغایرت بانکی)
  **یک** سند در همان جدول‌های `akph_ledger_*` می‌سازد؛ کلید `(source, source_id, event_type)` در `akph_ledger_events` یکتاست و
  تکرار همان رویداد سند دوم نمی‌سازد (همان سند اول برمی‌گردد).
- حساب‌ها با کد از کدینگ خوانده می‌شوند؛ حساب تعریف‌نشده یا گروهی/غیرفعال: `422 akph_rule` با پیام «حساب «کد - عنوان» در کدینگ
  تعریف نشده است…هیچ سندی ثبت نشد.» و هیچ چیزی نوشته نمی‌شود.
- سند قطعی همان لحظه شماره `ACC` می‌گیرد (ترتیب تاریخ حفظ می‌شود)؛ سند تعدیل شمارش تنخواه و سند مغایرت بانکی «در انتظار» با شماره
  `DRF` ثبت می‌شوند و کاربر دیگری آن را از `POST /journal-entries/{id}/post` قطعی یا از `/reject` رد می‌کند. رد آن رویداد را آزاد
  می‌کند (ردیف صورت‌حساب دوباره «تطبیق‌نشده» می‌شود).
- سند خودکار (`source_type: event`) از دفتر ویرایش یا معکوس نمی‌شود؛ اصلاح از ماژول مبدأ است.
- موجودی بانک، صندوق و تنخواه هرگز ذخیره نمی‌شود: Σ(بدهکار − بستانکار) ردیف‌های قطعی با `cash_ref` همان حساب (`tre:ID` بانک/صندوق،
  `pcf:ID` تنخواه). هیچ برداشتی موجودی را منفی نمی‌کند («موجودی منفی مجاز نیست»).
- ترتیب قفل: لنگر شماره‌گذاری سال (`ACC`، و `DRF` برای سند در انتظار) ← لنگر شماره رکورد (`EXP`، `PCR`، `PAY`، `REC`، `TRF`، `RCN`، …) ← ردیف‌ها.

### تنخواه

`GET /petty-cash` → `{ "funds": [...], "categories": [...], "settings": {...}, "expenses": [...], "requests": [...], "counts": [...], "replenishments": [...] }`
(در محدوده پروژه‌های کاربر).

```json
{ "id": "41", "code": "PCF-1405-00001", "title": "تنخواه کارگاه", "fund_type": "site_supervisor", "project_id": "5", "cost_center_id": "8",
  "holder_user_id": "21", "holder_name": "…", "account_code": "11103", "ceiling": 3000000000, "max_single_expense": 1000000000,
  "min_balance_warning": 500000000, "source_account_id": "61", "active": true, "period_start": "2026-09-01",
  "balance": 1850000000, "pending_expenses": 600000000, "usable_balance": 1250000000, "open_requests": 0, "period_spent": 150000000,
  "last_replenishment_amount": 2000000000, "last_replenishment_date": "2026-09-10", "version": 4 }
```

| فرمان | بدنه | قاعده |
|---|---|---|
| `POST /petty-cash/funds` | `title`، `fund_type` (`project_manager`\|`site_supervisor`\|`procurement`\|`headquarters`)، `project_id` (خالی = ستاد)، `cost_center_id`، `holder_user_id`، `holder_name`، `holder_phone`، `account_code` (پیش‌فرض `11103`)، `ceiling`، `max_single_expense`، `min_balance_warning`، `source_account_id`، `notes` | سقف‌ها پیش‌فرض از تنظیمات؛ حساب باید قابل ثبت باشد |
| `PATCH /petty-cash/funds/{id}` | همان فیلدها + `active` + `version` | حساب وجه صندوقی که مانده دارد تغییر نمی‌کند |
| `POST /petty-cash/expenses` | `fund_id`، `amount`، `date`، `category_id` یا `category_name`، `sub_category`، `vendor`، `vendor_national_id`، `counterparty_id`، `invoice_number`، `invoice_date`، `description`، `payment_method` (`card`\|`cash`\|`transfer`\|`other`) | متصدی یا مدیر پروژه؛ سقف هر هزینه؛ مبلغ ≤ موجودی قابل مصرف (موجودی − هزینه‌های در انتظار)؛ سطح و زنجیره از تنظیمات |
| `POST /petty-cash/expenses/{id}/approve` | `comment`، `version` | کاربر مرحله جاری، نه ثبت‌کننده و نه تأییدکننده مرحله قبل؛ مرحله آخر سند «بدهکار هزینه سرفصل (پروژه، مرکز هزینه) / بستانکار تنخواه» |
| `POST /petty-cash/expenses/{id}/reject` | `reason` (الزامی)، `return_to_user`، `version` | در هر مرحله |
| `POST /petty-cash/requests` | `fund_id`، `amount`، `reason` | یک درخواست باز برای هر صندوق؛ موجودی + درخواست‌های باز + مبلغ ≤ سقف |
| `POST /petty-cash/requests/{id}/approve`، `/reject` | `comment` یا `reason`، `version` | مدیر پروژه ← حسابدار ← مدیر ارشد (بالای آستانه)؛ مرحله آخر درخواست پرداخت تأییدشده در خزانه می‌سازد |
| `POST /petty-cash/funds/{id}/count` | `counted_cash`، `reason` (با مغایرت الزامی)، `notes`، `period_start`، `period_end` | مانده دفتری، هزینه‌های در انتظار، مانده مورد انتظار؛ مغایرت → سند تعدیل در انتظار (کسری ۶۲۴۰۲، مازاد ۴۱۳۰۲) |
| `POST /petty-cash/funds/{id}/close-period` | `period_end`، `version` | فقط وقتی هیچ هزینه یا سند تعدیل صندوق باز نیست |
| `POST /petty-cash/settings` | `site_level_max`، `project_level_max`، `approval_chains`، `fund_limits`، `low_balance_percent`، `replenishment_senior_threshold`، `default_expense_account` | فقط مجوز تنظیمات |
| `POST /petty-cash/categories` | `categories: [{ id?, name, subcategories, account_code? }]` | حساب هزینه قابل ثبت گروه ۵ یا ۶ (پیش‌فرض ۵۱۱۰۱)؛ سرفصل حذف‌شده غیرفعال می‌شود |

`GET /petty-cash/funds/{id}` → `{ fund, movements (با مانده جاری از دفتر), expenses, requests, counts, history }`.

### خزانه

`GET /treasury` → `{ accounts, payment_requests (با payments), receipts, cheques, transfers, statement_lines, settings }`.
حساب: `{ id, kind: bank|cash, code, title, bank_name, branch, account_number, sheba, holder_name, location, project_id, account_code, active, balance, total_in, total_out, version }`.

| فرمان | بدنه | قاعده |
|---|---|---|
| `POST /treasury/accounts`، `PATCH /treasury/accounts/{id}` | `kind`، `title`، `bank_name`، `branch`، `account_number`، `sheba`، `holder_name`، `keeper_user_id`، `location`، `project_id`، `account_code` (پیش‌فرض بانک `11101`، صندوق `11102`)، `active` | حسابِ کدینگِ حسابی که مانده دارد تغییر نمی‌کند |
| `POST /payment-requests` | `amount`، `beneficiary_name`، `payable_type` (`supplier`، `subcontractor`، `payroll`، `insurance`، `tax_vat`، `tax_payroll`، `tax_withholding`، `advance`، `subcontractor_advance`، `general_expense`) یا `debit_account_code`، `project_id`، `cost_center_id`، `counterparty_id`، `due_date`، `priority`، `description` | ثبت دستی؛ درخواست‌های منبع‌دار (شارژ تنخواه) را ماژول مبدأ می‌سازد |
| `POST /payment-requests/{id}/approve`، `/reject` | `version`؛ رد: `reason` | نه درخواست‌کننده؛ حسابدار تا آستانه `payment_senior_threshold` (پیش‌فرض ۱٬۰۰۰٬۰۰۰٬۰۰۰ ریال)، بالاتر مدیر ارشد |
| `POST /payment-requests/{id}/pay` | `amount`، `account_id`، `method` (`satna`\|`paya`\|`transfer`\|`card`\|`cash`\|`cheque`)، `tracking`، `date`، `cheque_number`، `cheque_due_date`، `version` | پرداخت‌کننده ≠ تأییدکننده؛ پرداخت جزئی مجاز و مانده به‌روز می‌شود؛ مبدأ منفی نمی‌شود؛ چک: بستانکار اسناد پرداختنی ۲۱۱۰۳ |
| `POST /receipts`، `/{id}/approve`، `/{id}/reject` | `amount`، `receipt_type` (`statement` ۱۱۲۰۱ با `statement_id` صورت‌وضعیت مصوب و حداکثر تا مانده آن، `advance` ۲۱۳۰۱ با `contract_id` قرارداد کارفرمای فعال، `other_income` ۴۱۳۰۲، `custom` + `credit_account_code`)، `account_id`، `counterparty_id` یا `payer_name`، `project_id`، `method`، `tracking`، `cheque_number`، `cheque_bank`، `cheque_due_date`، `date`، `description` | تأیید با کاربر دیگر؛ چک دریافتی: بدهکار اسناد دریافتنی ۱۱۲۰۲ |
| `POST /treasury/transfers` | `from_account_id`، `to_account_id`، `amount`، `date`، `tracking`، `description` | سند همان لحظه؛ مبدأ منفی نمی‌شود |
| `POST /cheques/{id}/status` | `status` (`cleared`\|`bounced`)، `note` (برگشت: الزامی)، `date`، `account_id`، `version` | هر تغییر یک سند؛ برگشت چک پرداختنی درخواست پرداخت را دوباره باز می‌کند |
| `POST /treasury/accounts/{id}/statement` | `lines: [{ date, description, deposit, withdrawal, reference }]` یا `csv` (همان ستون‌ها؛ تاریخ شمسی یا میلادی) | حداکثر ۱۰۰۰ ردیف |
| `POST /bank-statement-lines/{id}/match` | `ledger_line_id`، `version` | ردیف قطعی همان حساب، همان جهت و مبلغ؛ هر ردیف فقط یک بار |
| `POST /bank-statement-lines/{id}/voucher` | `version` | سند در انتظار (واریز: بانک/۲۱۷۰۱، برداشت: کارمزد ۶۲۱۰۱/بانک) برای تأیید کاربر دوم |

`GET /treasury/schedule` → درخواست‌های تأییدشده با مانده و چک‌های در جریان به ترتیب سررسید، با `cumulative_out` و `covered` نسبت به نقدینگی.

### کارتابل تأییدات

`GET /approvals` → `{ "items": [...], "total": 2 }`؛ فقط مواردی که مرحله جاری‌شان با نقش (و پروژه) همین کاربر است و کاربر ثبت‌کننده یا
تأییدکننده مرحله قبل نیست و مبلغ در آستانه اوست: سند دستی، سند معکوس، سند تعدیل شمارش، سند مغایرت بانکی، هزینه تنخواه، درخواست شارژ،
درخواست پرداخت و دریافت؛ از ۰٫۷ قرارداد (`contract`)، الحاقیه (`contract_amendment`) و صورت‌وضعیت‌ها (`client_statement`،
`subcontractor_statement`). مورد صورت‌وضعیت `approval` (مرحله تأیید یا تهیه) و `requires` (در تأیید کارفرما
`["employer_ref", "employer_date"]`) هم دارد.

```json
{ "id": "petty_cash_expense:51", "module": "petty_cash_expense", "module_label": "هزینه تنخواه", "record_id": "51", "doc_number": "EXP-1405-00002",
  "title": "…", "amount": 600000000, "requester_id": "1", "requester": "…", "previous_approver_id": "21", "project_id": "5", "project_name": "…",
  "date": "2026-09-20", "stage": "تأیید حسابدار", "approver_role": "حسابدار", "version": 2,
  "approve_path": "/petty-cash/expenses/51/approve", "reject_path": "/petty-cash/expenses/51/reject", "entity_type": "petty_expense" }
```

تأیید و رد همیشه فرمان ماژول مالک (`approve_path` / `reject_path`) است؛ کپی رکوردی در کارتابل نیست.

### قراردادها و صورت‌وضعیت‌ها (۰٫۷٫۰)

مقدار رشته اعشاری با حداکثر سه رقم (`"120.5"`) و مبلغ ریال صحیح است؛ درصد رشته یا عدد با حداکثر دو رقم اعشار. مبلغ ردیف،
مبلغ قرارداد و الحاقیه، مقدار قبلی، کسورات، ارزش افزوده، خالص و شماره‌ها را سرور تعیین می‌کند و از کلاینت پذیرفته نمی‌شود.

`GET /contracts[?kind=client|subcontract]` → `{ contracts: [...] }`:

```json
{ "id": "201", "number": "CNT-1405-00001", "kind": "client", "contract_no": "ق-۱۰۰", "title": "…", "project_id": "5", "cost_center_id": "8",
  "counterparty_id": "3", "counterparty_name": "…", "trade_type": "", "amount": 200000000, "contract_date": "2026-03-25", "start_date": "…", "end_date": "…",
  "duration_days": 360, "advance_pct": "10", "retention_pct": "5", "insurance_pct": "5", "tax_pct": "3", "other_pct": "0",
  "adjustment_base_index": "100", "adjustment_factor_pct": "95", "status": "pending|active|rejected|closed", "chain": ["مدیر ارشد"], "step_index": 0,
  "current_step": "مدیر ارشد", "history": [...], "created_by": "7", "last_approved_by": null, "reject_reason": "",
  "lines": [{ "id": "301", "row_no": 1, "code": "010101", "description": "…", "unit": "m3", "base_quantity": "100", "quantity": "120.5", "rate": 2000000,
              "amount": 241000000, "approved_quantity": "40", "pending_quantity": "10.25", "amendment_id": null }],
  "amendments": [...], "guarantees": [{ "id": "501", "kind": "performance", "guarantee_no": "…", "bank": "…", "amount": 10000000, "issue_date": "…",
  "due_date": "…", "status": "active", "days_to_due": 10, "due_soon": true, "version": 1 }],
  "amendments_total": 41000000, "extend_days": 30, "current_amount": 241000000, "measured_amount": 100500000, "approved_amount": 80000000,
  "approved_gross": 87200000, "approved_net": 70000000, "remaining_amount": 161000000, "settled_amount": 30000000, "balance_due": 40000000,
  "advance_amount": 20000000, "advance_expected": 24100000, "advance_remaining": 12000000, "deductions": { "retention": 4000000 }, "version": 5 }
```

| فرمان | بدنه | قاعده |
|---|---|---|
| `POST /contracts` | `kind`، `contract_no`، `title`، `project_id`، `cost_center_id` (جزء: الزامی)، `counterparty_id` (کارفرما یا پیمانکار جزء)، `trade_type` (جزء)، `contract_date`، `start_date`، `end_date`، `duration_days`، `advance_pct`، `retention_pct`، `insurance_pct`، `tax_pct`، `other_pct`، `adjustment_base_index`، `adjustment_factor_pct`، `description`، `lines: [{ code, description, unit, quantity, rate }]` | شماره CNT/SCN؛ وضعیت `pending`؛ زنجیره کارفرما [مدیر ارشد]، جزء [مدیر پروژه، مدیر ارشد] |
| `POST /contracts/{id}` | همان فیلدها + `version` | فقط `pending` یا `rejected` (ارسال دوباره از ابتدای زنجیره) |
| `POST /contracts/{id}/approve`، `/reject` | `comment` / `reason`، `version` | ثبت‌کننده و تأییدکننده مرحله قبل تأیید نمی‌کنند |
| `POST /contracts/{id}/amendments` | `amendment_no`، `date`، `extend_days`، `description`، `lines: [{ contract_line_id, quantity_delta }` یا `{ description, unit, rate, quantity_delta }]` | فقط قرارداد فعال؛ شماره AMD؛ کاهش کمتر از مقدار اندازه‌گیری‌شده ممنوع |
| `POST /contract-amendments/{id}/approve`، `/reject` | `comment` / `reason`، `version` | مدیر ارشد، نه ثبت‌کننده؛ ردیف جدید و تغییر مقدار فقط پس از تأیید |
| `POST /contracts/{id}/guarantees` | `kind` (`performance`\|`advance`\|`retention`\|`bid`\|`other`)، `guarantee_no`، `bank`، `amount`، `issue_date`، `due_date`، `notes` | |
| `POST /contract-guarantees/{id}` | `status` (`active`\|`released`\|`expired`)، `due_date`، `notes`، `version` | |
| `POST /contracts/{id}/advance` | `amount`، `due_date` | فقط قرارداد جزء فعال؛ درخواست پرداخت خزانه (`subcontractor_advance`، ۱۱۴۰۲) تا سقف درصد پیش‌پرداخت |

`GET /contracts/guarantees-due` → `{ guarantees }` ضمانت‌نامه‌های فعال با سررسید تا ۳۰ روز آینده یا گذشته.
`GET /reports/contracts?project_id=&counterparty_id=` → `{ summary: { client: {...}, subcontract: {...} } }` جمع مبالغ بالا برای صفحه پروژه و طرف حساب.

`GET /statements[?kind=]` → `{ statements: [...] }`؛ هر صورت‌وضعیت: `number` (STC/STS)، `kind`، `title`، `contract_id`، `period_start`، `period_end`،
`status`، `current_step: { label, role, approval, next_status, requires }`، `lines: [{ contract_line_id, contract_quantity, previous_quantity, quantity,
cumulative_quantity, rate, amount, cumulative_amount }]`، `work_amount`، `adjustment_index`، `adjustment_amount`، `vat_rate`، `vat_amount`، `gross_amount`،
`fixed_deduction`، `deductions: [{ type, title, rate, amount }]`، `total_deductions`، `net_amount`، `settled_amount`، `pending_receipts`، `balance_due`،
`payment_request`، `employer_ref`، `employer_date`، `history` (هر ردیف با `from` و `to`)، `entry`، `void_entry`، `version`.

| فرمان | بدنه | قاعده |
|---|---|---|
| `POST /client-statements` | `contract_id`، `title`، `period_start`، `period_end`، `lines: [{ contract_line_id, quantity }]`، `include_vat`، `adjustment_index`، `fixed_deduction` (مصالح تحویلی کارفرما)، `description`، `submit` | قرارداد فعال؛ قبلی + در جریان + این دوره ≤ مقدار قرارداد |
| `POST /subcontractor-statements` | همان، بدون `include_vat` و `submit`؛ `fixed_deduction` = جریمه و سایر | |
| `POST /statements/{id}` | فیلدهای بالا + `version` | فقط پیش‌نویس و اندازه‌گیری‌شده (کارفرما، پیش از ارسال به مشاور)، ثبت‌شده (جزء، پیش از اندازه‌گیری) یا برگشتی |
| `POST /statements/{id}/approve` | `comment`، `version`؛ تأیید کارفرما: `employer_ref`، `employer_date` | مرحله بعد؛ مرحله نهایی سند `CLIENT_STATEMENT_APPROVED` / `SUBCONTRACTOR_STATEMENT_APPROVED` و (جزء) درخواست پرداخت خالص |
| `POST /statements/{id}/return`، `/reject` | `reason`، `version` | برگشت به تهیه (زنجیره از نو) یا رد |
| `POST /statements/{id}/void` | `reason`، `version` | مدیر ارشد/مدیر سیستم؛ بدون دریافت یا پرداخت؛ سند برگشتی `STATEMENT_VOIDED` و لغو درخواست پرداخت پرداخت‌نشده |

### خرید، انبار و حقوق (۰٫۸٫۰)

مقدارها رشته اعشاری با حداکثر سه رقم (`"1200.75"`) و مبالغ ریال صحیح‌اند. مبلغ ردیف، جمع‌ها، ارزش افزوده، بهای میانگین موزون،
ارزش رسید، اختلاف قیمت، فیش حقوق، شماره‌ها و تأییدکننده را سرور تعیین می‌کند؛ فیلد اضافه در بدنه یا ردیف ← `akph_unknown_field`.
همه فرمان‌ها Idempotency-Key می‌خواهند و فرمان روی رکورد موجود `version` (یا `If-Match`) را؛ تعارض ← 409.

`GET /procurement` → `{ requisitions, rfqs, purchase_orders, goods_receipts, vendor_invoices, supplier_returns, settings }`؛
`GET /inventory` → `{ materials, warehouses, balances, issues, returns, transfers, stocktakes, kardex }` (کاردکس ۳۰۰۰ ردیف آخر؛ برای
یک کالا `GET /inventory/kardex?material_id=&warehouse_id=` با مانده هر انبار)؛ `GET /payroll` → `{ employees, periods, timesheets,
payslips, settings }`. نمونه کامل پاسخ‌ها (از جریان آزمون‌های PHP) در `tests/fixtures/akph-080.json`.

| فرمان | بدنه | قاعده |
|---|---|---|
| `POST /requisitions` | `project_id`، `cost_center_id`، `priority` (`normal`\|`urgent`\|`critical`)، `needed_date`، `justification`، `lines: [{ kind: goods, material_id, quantity, estimated_rate }` یا `{ kind: service, description, unit, quantity, estimated_rate, account_code }]` | شماره REQ؛ زنجیره [مدیر پروژه، حسابدار]؛ حساب خدمت از گروه ۵ یا ۶ |
| `POST /requisitions/{id}/approve`، `/reject`، `/cancel` | `comment` / `reason`، `version` | ثبت‌کننده و تأییدکننده مرحله قبل تأیید نمی‌کنند |
| `POST /requisitions/{id}/rfqs` | `title`، `deadline` | فقط درخواست تأییدشده؛ شماره RFQ |
| `POST /rfqs/{id}/quotes` | `counterparty_id` (تأمین‌کننده)، `reference`، `prices: [{ line_id, rate }]` (برای همه ردیف‌ها)، `vat_included`، `freight`، `delivery_days`، `payment_terms`، `notes` | |
| `POST /rfqs/{id}/award` | `quote_id`، `version` | |
| `POST /purchase-orders` | `rfq_id` (+ `warehouse_id`) یا `requisition_id`، `counterparty_id`، `lines: [{ requisition_line_id, rate }]`، `freight`، `vat_applies`؛ `payment_terms`، `due_date`، `notes` | شماره PO؛ ارزش افزوده به نرخ تنظیمات؛ کالا انبار لازم دارد؛ تأیید مدیر ارشد (نه ثبت‌کننده) |
| `POST /purchase-orders/{id}/approve`، `/reject` | `comment` / `reason`، `version` | رد: سفارش در انتظار یا لغو سفارش تأییدشده بدون رسید |
| `POST /purchase-orders/{id}/receipts` | `warehouse_id`، `date`، `waybill`، `qc_status`، `notes`، `lines: [{ po_line_id, delivered_qty, rejected_qty }]` | ≤ مانده سفارش؛ سند `GOODS_RECEIPT` |
| `POST /goods-receipts/{id}/invoices` | `invoice_no`، `invoice_date`، `due_date`، `subtotal`، `freight`، `vat_amount`، `notes` | تطبیق سه‌جانبه: `pending` یا `stopped` (`match_status: mismatch`) |
| `POST /vendor-invoices/{id}` | `subtotal`، `freight`، `vat_amount`، تاریخ‌ها، `version` | اصلاح و تطبیق دوباره |
| `POST /vendor-invoices/{id}/approve`، `/reject` | `comment` / `reason`، `version` | فاکتور متوقف قابل تأیید نیست؛ سند `VENDOR_INVOICE` و درخواست پرداخت خزانه |
| `POST /goods-receipts/{id}/returns` | `line_id`، `quantity`، `reason` | سند `PURCHASE_RETURN`؛ کاهش درخواست پرداخت باز |
| `POST /materials`، `POST /materials/{id}` | `code` (اختیاری؛ وگرنه MAT)، `name`، `category`، `unit`، `specification`، `reorder_level`، `min_stock`، `max_stock`؛ ویرایش + `active`، `version` | |
| `POST /warehouses`، `POST /warehouses/{id}` | `name`، `kind` (`central`\|`project`\|`temporary`)، `project_id` (انبار پروژه الزامی، مرکزی ممنوع)، `location`، `keeper_name` | شماره WH |
| `POST /store-issues` | `warehouse_id`، `project_id` (فقط انبار مرکزی/موقت)، `cost_center_id`، `counterparty_id`، `date`، `notes`، `lines: [{ material_id, quantity }]` | شماره SIV؛ رزرو؛ ردیف‌های یک کالا جمع می‌شوند |
| `POST /store-issues/{id}/confirm`، `/cancel` | `comment` / `reason`، `version` | تأیید نه درخواست‌کننده؛ سند `STORE_ISSUE`؛ لغو رزرو را آزاد می‌کند |
| `POST /store-issues/{id}/returns` | `line_id`، `quantity`، `reason` | شماره RTN؛ سند `STORE_RETURN` |
| `POST /stock-transfers`، `/{id}/deliver`، `/{id}/cancel` | `source_warehouse_id`، `target_warehouse_id`، `date`، `waybill`، `driver_name`، `notes`، `lines` | شماره STR؛ سند `INVENTORY_TRANSFER` |
| `POST /stocktakes` | `warehouse_id`، `date`، `notes`، `lines: [{ material_id, quantity }]` (شمارش) | شماره STK؛ در انتظار تأیید کاربر دوم |
| `POST /stocktakes/{id}/approve`، `/reject` | `comment` / `reason`، `version` | نه ثبت‌کننده؛ سند `STOCKTAKE_ADJUSTMENT` با ردیف جدای کسری و اضافه |
| `POST /employees`، `POST /employees/{id}` | `full_name`، `user_id`، `national_id`، `insurance_no`، `bank_name`، `sheba`، `account_number`، `job_title`، `contract_type`، `hire_date`، `cost_center_id`، `base_salary`، `housing_allowance`، `food_allowance`، `child_allowance`، `other_benefits`، `loan_installment`، `other_deduction`، `insured`؛ ویرایش + `active`، `version` | |
| `POST /payroll/periods` | `fiscal_year`، `month` | یک دوره برای هر ماه (409)؛ شماره PRL |
| `POST /payroll/periods/{id}/timesheets` | `timesheets: [{ employee_id, work_days, absent_days, overtime_hours, mission_days }]`، `version` | دوره محاسبه‌شده به پیش‌نویس برمی‌گردد |
| `POST /payroll/periods/{id}/calculate` | `version` | فیش‌ها (PSL) روی سرور |
| `POST /payroll/periods/{id}/approve`، `/reject` | `comment` / `reason`، `version` | حسابدار ← مدیر ارشد؛ نهایی: سند `PAYROLL_APPROVED` و سه درخواست پرداخت |
| `POST /procurement/settings` | `price_tolerance_pct` | |
| `POST /payroll/settings` | `worker_insurance_pct`، `employer_insurance_pct`، `insurance_ceiling`، `month_days`، `month_hours`، `overtime_factor_pct`، `mission_factor_pct`، `tax_table: { fiscal_year, brackets: [{ upto, rate_pct }] }` | |

کارتابل تأییدات موارد تازه را هم برمی‌گرداند: `purchase_requisition`، `purchase_order`، `vendor_invoice`، `store_issue`، `stocktake` و
`payroll` (برای مرحله و دامنه کاربر).

### گزارش و چاپ (۰٫۶٫۱)

`GET /report-settings` → `{ settings: { company, signatories, report_types, version, updated_at } }`:

```json
{ "company": { "legal_name": "آریا کاوش پی هامون", "national_id": "", "registration_number": "", "economic_code": "", "address": "", "phone": "", "logo_url": null },
  "signatories": { "projects": [{ "title": "تهیه‌کننده", "user_id": null, "name": "" }, …], "journal_entry": [], … },
  "report_types": [{ "key": "projects", "label": "گزارش پروژه‌ها", "workflow": false }, …], "version": 1 }
```

- پیش‌فرض: نام رسمی «آریا کاوش پی هامون» و برای هر گزارش فقط عنوان جایگاه‌ها («تهیه‌کننده»، «حسابدار»، «مدیر مالی»، «مدیرعامل») بدون نام؛
  برای انواع دارای گردش تأیید (`workflow: true`) جایگاه اضافه‌ای تعریف نشده است.
- `name` جایگاهی که `user_id` دارد نام نمایشی همان کاربر است (هیچ اطلاعات دیگری از کاربر برگردانده نمی‌شود).

| فرمان | بدنه | قاعده |
|---|---|---|
| `POST /report-settings` | `company: { legal_name, national_id, registration_number, economic_code, address, phone }`، `signatories: { <report_type>: [{ title, user_id? , name? }] }`، `version` (یا `If-Match`) | فقط مدیر سیستم؛ نام رسمی الزامی؛ شناسه ملی ۱۰ یا ۱۱ رقم؛ حداکثر ۶ جایگاه؛ `user_id` باید کاربر پرتال باشد؛ نسخه کهنه ← ۴۰۹؛ ممیزی `report_settings` |
| `POST /report-settings/logo` | multipart، فایل `logo`؛ نسخه در `If-Match` | JPG/PNG/WebP تا ۲ مگابایت، بررسی محتوا، بازنویسی با ضلع بزرگ حداکثر ۶۰۰ پیکسل بدون برش؛ لوگوی قبلی حذف می‌شود |
| `DELETE /report-settings/logo` | `version` | |

`GET /report-settings/users` → `{ users: [{ id, name, role }] }` کاربران چهار نقش پرتال برای انتخاب امضاکننده.

`GET /print/signatures?entity_type=&entity_id=` → `{ entity_type, entity_id, report_type, number, slots: [{ title, user_id, name, role, at, signed, source }] }`.
جایگاه‌ها از سابقه تأیید سرور ساخته می‌شوند و جایگاه‌های «تنظیمات گزارش و چاپ» همان نوع (`source: "settings"`) پس از آن‌ها می‌آیند؛
مرحله تأییدنشده `signed: false` و بدون نام و تاریخ است.

| `entity_type` | جایگاه‌ها |
|---|---|
| `journal_entry` | تهیه‌کننده، تأییدکننده (فقط سند قطعی) |
| `petty_expense` | تنخواه‌دار (ثبت‌کننده)، سپس یک جایگاه برای هر مرحله زنجیره («تأیید مدیر پروژه»، …) از تأییدهای دور جاری |
| `petty_request` | درخواست‌کننده و مراحل زنجیره |
| `payment_request` | درخواست‌کننده، تأییدکننده، پرداخت‌کننده |
| `receipt` | ثبت‌کننده، تأییدکننده |
| `client_statement` | تهیه‌کننده، تأیید مشاور، تأیید کارفرما (۰٫۷) |
| `subcontractor_statement` | ثبت کارکرد، اندازه‌گیری، تأیید کارگاه، تأیید مدیر پروژه، تأیید مالی، تأیید مدیر ارشد (۰٫۷) |

`GET /treasury/settings` و `POST /treasury/settings` از ۰٫۶٫۱ `vat_rate_percent` (عدد صحیح ۰ تا ۱۰۰، پیش‌فرض ۱۰) هم دارند؛ صفحه تنظیمات اپ آن را می‌خواند و می‌نویسد.

## ۵. کلاینت

- `src/api/akph`: خواندن همه مسیرهای بالا، تبدیل ISO ↔ شمسی (`src/utils/jalali.ts`، همان الگوریتم سرور) و ارسال فرمان‌ها.
- `src/store/useWorkflows.ts`: در حالت واقعی، گردش‌کار مرجع فقط روی یک کپی دورریختنی اجرا می‌شود تا ورودی اعتبارسنجی شود؛
  سپس فرمان به سرور می‌رود و `records` پاسخ با `MERGE_SERVER_RECORDS` ادغام می‌شود. عملیاتی که فرمان سرور ندارد
  «فقط خواندنی — به‌زودی» است و بخش‌های بدون فرمان سرور همین پیام را بالای صفحه نشان می‌دهند.
- `src/store/commandKeys.ts`: یک `Idempotency-Key` برای هر ارسال فرم (اثر انگشت: نام اقدام + ورودی کاربر). همان ارسال تا
  رسیدن پاسخ دوباره فرستاده نمی‌شود؛ پس از موفقیت ۱۵ ثانیه و پس از پاسخ گم‌شده ۱۰ دقیقه همان کلید را می‌گیرد؛ پس از رد قطعی
  کلید کنار می‌رود.
- `src/api/client.ts`: `X-WP-Nonce` روی همه درخواست‌ها؛ تکرار خودکار یک‌باره با **همان کلید** برای خطای شبکه و برای
  `409 akph_retry`؛ `If-Match` برای فرمان روی رکورد موجود؛ `data.field` خطا برای پیام کنار همان فیلد.
- `src/api/akph/account.ts` و `src/store/useAccount.ts`: صفحه «حساب کاربری من» (`#/account`)؛ اعتبارسنجی همان قواعد سرور در
  مرورگر (`src/utils/accountRules.ts`)، برش مربع تصویر پیش از بارگذاری (`src/store/useAvatarCrop.ts`).
- `src/api/akph/assistant.ts` و `src/store/useAssistant.ts`: دستیار از سرور؛ با داده نمایشی پاسخ‌های قاعده‌محور با برچسب «نمایشی».
- `src/api/akph/documents.ts`، `src/store/documents.ts` و `src/store/useDocuments.ts`: بارگذاری multipart با `XMLHttpRequest` برای
  نوار پیشرفت (یک `Idempotency-Key` برای هر فایل در هر ارسال)، دریافت فایل به‌صورت Blob با `X-WP-Nonce` برای دانلود و پیش‌نمایش،
  پیوند و بایگانی با فرمان؛ نگاشت دسته‌های اپ به `doc_type` و نوع رکوردهای اپ به `entity_type`. با داده نمایشی فایل فقط در همان
  برگه مرورگر می‌ماند (`src/api/mock/documents.ts`).
- `logoutUrl` در `window.AkphPortal` و `useLogout()` در `src/store/session.tsx` برای «خروج از حساب».
- `src/api/akph/finance.ts`: نگاشت تنخواه، خزانه و کارتابل. این فرمان‌ها بدون اجرای آزمایشی محلی مستقیم به سرور می‌روند
  (`serverValidated`)، چون مرحله، آستانه و موجودی را سرور تعیین می‌کند. پس از هر فرمان `GET /approvals` دوباره خوانده می‌شود
  (کارتابل، شمارنده منو و اعلان‌ها). بخش‌های تنخواه، خزانه و کارتابل در حالت واقعی فقط‌خواندنی نیستند (`WRITABLE_PATHS`).

- `src/api/akph/print.ts`، `src/store/usePrint.ts` و `src/components/common/OfficialPrint.tsx`: قالب چاپ رسمی همه گزارش‌ها (سربرگ و
  لوگو از «تنظیمات گزارش و چاپ»، شماره و تاریخ شمسی، فیلترها، جدول با ارقام فارسی و واحد یک بار در سرستون، جمع‌ها، امضاها، پاورقی
  «صفحه ۱ از ۳» با زمان تهیه و نام تهیه‌کننده، A4 عمودی/افقی، تکرار سرستون در هر صفحه). سند چاپی زیر `<body>` کپی می‌شود و فقط
  همان چاپ می‌شود. خروجی Excel (CSV با BOM) از همان ردیف‌های چاپ (`src/store/views/exports.ts`).
- `src/api/akph/contracts.ts` (۰٫۷): نگاشت قراردادها، فهرست بها، الحاقیه‌ها، ضمانت‌نامه‌ها و صورت‌وضعیت‌ها. فرمان‌های قرارداد و
  صورت‌وضعیت `serverValidated` هستند؛ بدنه فقط ورودی کاربر است (ردیف صورت‌وضعیت فقط `contract_line_id` و `quantity`).
  `/contracts` و `/statements` در `WRITABLE_PATHS` هستند. کنترل‌های سرور (`ContractServerPanel`: تأیید، الحاقیه، ضمانت‌نامه،
  پیش‌پرداخت؛ نامه کارفرما و ابطال در جزئیات صورت‌وضعیت) فقط برای رکوردهای سرور نمایش داده می‌شوند.

## ۶. خارج از دامنه (عمداً)

بستن سال مالی، تطبیق خودکار بانک و خروجی اکسل تعدیلات هنوز فرمان سرور ندارند و در اپ هم دکمه‌ای برای آن‌ها نیست (فهرست کامل در
[INSTALL-FA.md](./INSTALL-FA.md)). از ۰٫۸٫۰ هیچ مسیر اپ در حالت واقعی «فقط خواندنی — به‌زودی» نیست.
