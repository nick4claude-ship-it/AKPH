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
| احراز هویت | کوکی ورود وردپرس **و** سربرگ `X-WP-Nonce` (از `window.AkphPortal.nonce`، عمل `wp_rest`) در **همه** مسیرها، حتی GET |
| نقش | فقط `administrator`، `paydar_senior_manager`، `paydar_accountant`، `paydar_project_manager`؛ هر مسیر یک قابلیت `akph_*` لازم دارد (جدول ۳) |
| مبلغ | عدد صحیح **ریال** (JSON integer یا رشته رقمی)، ≥ ۰، حداکثر ۹٬۰۰۷٬۱۹۹٬۲۵۴٬۷۴۰٬۹۹۱ (دقیق در مرورگر). اعشار، منفی و رقم جداشده (`1,000`) رد می‌شود. در پایگاه‌داده `BIGINT`. |
| تاریخ | میلادی ISO `YYYY-MM-DD` در درخواست و پاسخ؛ زمان‌ها UTC با `Z`. سال مالی = سال شمسی تاریخ (محاسبه در سرور، مستقل از WP-Parsidate). |
| Idempotency | هر `POST/PUT/PATCH` سربرگ `Idempotency-Key` (۸ تا ۱۰۰ نویسه `A-Za-z0-9_-`) دارد. تکرار همان کلید توسط همان کاربر، **همان پاسخ** را با سربرگ `Idempotency-Replayed: true` برمی‌گرداند و چیزی دوباره ساخته نمی‌شود. همان کلید با بدنه دیگر ← `422`. |
| نسخه | فرمان روی رکورد موجود `version` را در بدنه یا `If-Match: "3"` می‌فرستد. نسخه کهنه ← `409` با `data.current_version`؛ بدون نسخه ← `428`. |
| تراکنش | همه نوشتن‌های یک فرمان (رکورد، شماره، ممیزی، کلید idempotency) یک تراکنش InnoDB است؛ هر خطا ← ROLLBACK کامل. |
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

کلیدهای `records`: `projects`، `cost_centers`، `counterparties`، `accounts`، `journal_entries`.

### خطا

```json
{ "code": "akph_segregation_of_duties", "message": "تأیید یا رد سندی که خودتان ثبت کرده‌اید مجاز نیست (تفکیک وظایف).", "data": { "status": 403 } }
```

| وضعیت | کدها | معنا |
|---|---|---|
| 400 | `akph_invalid`، `akph_invalid_json`، `akph_idempotency_key_required`، `akph_invalid_date` | ورودی نامعتبر (فیلد در `data.field`) |
| 401 | `akph_unauthorized` | وارد نشده (مهمان) |
| 403 | `akph_invalid_nonce` | `X-WP-Nonce` نیست یا نامعتبر است |
| 403 | `akph_no_portal_role` | کاربر هیچ‌یک از چهار نقش پرتال را ندارد |
| 403 | `akph_role_forbidden` | نقش، قابلیت این مسیر را ندارد |
| 403 | `akph_forbidden`، `akph_field_forbidden` | دامنه پروژه یا گروه فیلد (`data.fields`) |
| 403 | `akph_segregation_of_duties` | ثبت‌کننده نمی‌تواند سند خودش را تأیید یا رد کند (مقایسه با شناسه کاربر) |
| 404 | `akph_not_found`، `rest_no_route` | رکورد نیست یا در دامنه کاربر نیست |
| 409 | `akph_conflict`، `akph_in_progress` | نسخه کهنه، مرحله نادرست (مثلاً سند قطعی)، کد تکراری، درخواست هم‌زمان با همان کلید |
| 422 | `akph_rule`، `akph_idempotency_mismatch` | نقض قاعده حسابداری (نامتوازن، حساب گروهی، سال بسته، ترتیب تاریخ)؛ کلید تکراری با بدنه دیگر |
| 428 | `akph_version_required` | نسخه رکورد فرستاده نشده |
| 500 | `akph_db_error`، `akph_server_error` | خطای پایگاه‌داده؛ هیچ تغییری ذخیره نشده |
| 503 | `akph_not_ready` | جدول‌ها روی InnoDB آماده نیست یا PHP ۶۴ بیتی نیست |

## ۳. مسیرها و دسترسی

✓ = مجاز. مدیر سیستم و مدیر ارشد همه‌جا مجازند (با تفکیک وظایف).

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
| `GET /` (فهرست فضای نام) | `akph_access` | ✓ | ✓ |

## ۴. جزئیات مسیرها

### GET /me

```json
{
  "id": "7", "display_name": "حسابدار", "role": "حسابدار", "role_slug": "paydar_accountant",
  "view_all": true, "project_ids": [], "currency": "toman", "fiscal_year": 1405,
  "closed_fiscal_years": [], "today": "2026-09-25",
  "caps": { "akph_access": true, "akph_journal_approve": true, "…": false }, "server_version": "0.3.0"
}
```

برای مدیر پروژه `view_all: false` و `project_ids` فهرست شناسه پروژه‌هایی است که `manager_user_id` آن‌ها کاربر است.
`currency` واحد نمایش است (تنظیمات افزونه)؛ مبالغ همیشه ریال‌اند.

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
کد تکراری ← `409`؛ کد مرکزی که در سند استفاده شده عوض نمی‌شود (`422`).

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
          └─ معکوس (reverse): سند تازه posted با بدهکار/بستانکار جابه‌جا؛ سند اصلی هرگز ویرایش یا حذف نمی‌شود
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

`POST /journal-entries/{id}` (ویرایش پیش‌نویس): همان بدنه + `version`؛ فقط ثبت‌کننده و فقط `pending`؛ سند قطعی ← `409`.

`POST /journal-entries/{id}/post`: `{ "version": 1 }`. کاربر دیگر (شناسه ≠ `created_by`، حتی برای مدیر ارشد و مدیر سیستم).
ردیف‌ها دوباره اعتبارسنجی می‌شوند؛ تاریخ نه بعد از امروز و نه قبل از آخرین سند قطعی همان سال (شماره‌ها به ترتیب تاریخ‌اند).
شماره `ACC-{سال شمسی}-{ترتیب ۵ رقمی}` داخل همان تراکنش با کلید یکتای `(prefix, fiscal_year, seq)`؛ شمارنده هر سال از ۱.

`POST /journal-entries/{id}/reject`: `{ "version": 1, "reason": "…" }`.

`POST /journal-entries/{id}/reverse`: `{ "version": 2, "reason": "ثبت اشتباه", "date": "2026-09-25" }` (تاریخ اختیاری،
پیش‌فرض امروز). پاسخ `201` با سند اصلی (`reversed_by`) و سند معکوس (`reversal_of`). معکوسِ معکوس و معکوس دوباره ← `409`.

شکل سند در پاسخ:

```json
{
  "id": "12", "doc_number": "ACC-1405-00001", "draft_number": "DRF-1405-00001", "fiscal_year": 1405, "date": "2026-09-23",
  "description": "…", "entry_type": "general", "source_type": "manual", "project_id": "5", "status": "posted", "total": 10000,
  "lines": [{ "line_no": 1, "account_code": "11101", "project_id": "5", "cost_center_id": "8", "counterparty_id": null, "description": "…", "debit": 10000, "credit": 0 }],
  "reversal_of": null, "reversed_by": null,
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
صفحه) و `rows[]` با `balance` جاری. فقط اسناد قطعی.

### ممیزی

`GET /audit&object_type=entry&object_id=12&page=1` ← `{ "events": [{ "id", "user_id", "user_name", "user_role", "action", "object_type", "object_id", "object_ref", "before", "after", "created_at" }], "page", "total" }`.
هر فرمان موفق ممیزی با **شناسه کاربر**، رکورد قبل و بعد و `Idempotency-Key` ثبت می‌کند (داخل همان تراکنش).

## ۵. کلاینت

- `src/api/akph`: خواندن همه مسیرهای بالا، تبدیل ISO ↔ شمسی (`src/utils/jalali.ts`، همان الگوریتم سرور) و ارسال فرمان‌ها.
- `src/store/useWorkflows.ts`: در حالت واقعی، گردش‌کار مرجع فقط روی یک کپی دورریختنی اجرا می‌شود تا ورودی اعتبارسنجی شود؛
  سپس فرمان به سرور می‌رود و `records` پاسخ با `MERGE_SERVER_RECORDS` ادغام می‌شود. عملیاتی که فرمان سرور ندارد
  «فقط خواندنی — به‌زودی» است و بخش‌های بدون فرمان سرور همین پیام را بالای صفحه نشان می‌دهند.
- `src/api/client.ts`: `X-WP-Nonce` روی همه درخواست‌ها؛ `Idempotency-Key` تازه برای هر اقدام کاربر (تکرار خطای شبکه با همان کلید)؛
  `If-Match` برای فرمان روی رکورد موجود.

## ۶. فرمان‌های فاز بعد (هنوز فقط‌خواندنی)

صورت‌وضعیت‌ها، خزانه و پرداخت، تنخواه، خرید، انبار، حقوق، قراردادها، مغایرت بانکی و بستن سال. قواعد آن‌ها در
[SERVER-RULES.md](./SERVER-RULES.md) آمده و با همین چارچوب (Idempotency-Key، version، تراکنش، ممیزی) ساخته می‌شوند.
