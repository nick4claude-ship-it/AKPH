# قرارداد API پرتال پایدار (paydar/v1)

این سند قرارداد بین اپلیکیشن React و افزونه وردپرس `paydar-portal` است.

## اصل پایه: کلاینت فقط «فرمان» می‌فرستد

- مرورگر هرگز مانده، وضعیت تأیید، `approvedBy`، شماره سند، سال بسته، موجودی انبار، رویداد مالی یا سند قطعی **محاسبه‌شده در مرورگر** را برای ذخیره نمی‌فرستد.
- کلاینت فقط **ورودی کاربر** (مقادیر، شرح، ردیف‌های سند پیش‌نویس، انتخاب حساب مبدأ و …) و **نام فرمان** را می‌فرستد.
- سرور این کارها را انجام می‌دهد:
  - اجرای گردش‌کار و کنترل مرحله؛
  - کنترل دسترسی و تفکیک وظایف؛
  - اعمال قواعد ثبت؛
  - محاسبه مبالغ از ردیف‌ها؛
  - شماره‌گذاری.
- پاسخ هر فرمان، **رکوردهای تغییرکرده** با نسخه جدید است. کلاینت آن‌ها را به‌جای نسخه محلی می‌گذارد.
- مسیر عمومی نوشتن رکورد (مثل `PUT records/{slice}`) وجود ندارد و نباید ساخته شود.
- مشخصات مرجع قواعد سمت سرور در [SERVER-RULES.md](./SERVER-RULES.md) آمده است.

## قواعد مشترک

| موضوع | قاعده |
|---|---|
| احراز هویت | کوکی وردپرس + سربرگ `X-WP-Nonce` (از `window.PaydarPortal.nonce`) |
| مبالغ | همیشه **ریال صحیح** (`integer`)، هم در درخواست هم در پاسخ. تومان فقط در نمایش است. |
| تاریخ | شمسی `YYYY/MM/DD` با ارقام لاتین. سرور تاریخ نامعتبر یا خارج از سال باز را رد می‌کند. |
| تکرارناپذیری | هر فرمان سربرگ `Idempotency-Key` (UUID) دارد. تکرار همان کلید باید همان پاسخ اول را برگرداند و دوباره اجرا نشود. |
| هم‌زمانی | فرمان روی رکورد موجود سربرگ `If-Match: "<version>"` دارد و `version` در بدنه هم می‌آید. اگر نسخه کهنه باشد، پاسخ `409` است. |
| دسترسی | لیست‌ها به دسترسی کاربر محدودند: مدیر پروژه فقط پروژه‌های خودش را می‌بیند و رکورد بدون پروژه (ستادی) به او داده نمی‌شود. |
| خطا | `{ code, message }` با `message` فارسی. کدها: `400` ورودی نامعتبر، `403` دسترسی یا تفکیک وظایف، `404`، `409` نسخه یا مرحله، `422` نقض قاعده حسابداری. |
| پاسخ فرمان | `{ message, records: { [slice]: Record[] }, id?, doc_number? }` |

## فاز فعلی: مسیرهای موجود در افزونه نصب‌شده

اپ در حالت وردپرس فقط از این مسیرها استفاده می‌کند (`src/api/wordpress`):

| مسیر | کاربرد در اپ |
|---|---|
| `GET /me` | نشست: `id, display_name, email, avatar, role, project_ids, currency, fiscal_year` |
| `GET /projects` ، `GET /projects/{id}` | فهرست پروژه‌های قابل مشاهده. ارقام مالی پروژه از دفتر محاسبه می‌شود، نه از این پاسخ. |
| `GET /managers` | (فعلاً استفاده نمی‌شود) |
| `GET /accounting/settings` | `currency` (یک‌بار انتخاب‌شده)، `fiscal_year`، `closed_fiscal_years` |
| `GET /accounting/accounts` | کدینگ حساب‌ها: `code, title, parent_code, nature` |
| `GET /accounting/entries` | اسناد. ردیف‌ها در `lines[]` هستند با `account_code, debit, credit` به ریال. |
| `POST /accounting/entries` | ثبت **فقط پیش‌نویس** سند دستی. شماره، جمع‌ها و وضعیت را سرور تعیین می‌کند. |
| `POST /accounting/entries/{id}/post` | قطعی‌کردن پیش‌نویس (تأییدکننده ≠ ثبت‌کننده) |
| `POST /accounting/entries/{id}/reverse` | سند معکوس. سند قطعی هرگز ویرایش یا حذف نمی‌شود. |
| `GET /accounting/report` ، `/accounting/project-summary` | (فعلاً استفاده نمی‌شود؛ گزارش‌ها از اسناد ساخته می‌شوند) |
| `GET /accounting/audit` | سوابق ممیزی |

> **هشدار:** در زمان نوشتن این سند کد افزونه در دسترس نبود. نام فیلدهای پاسخ در `src/api/wordpress/pluginMapping.ts` «قالب مورد انتظار» است، نه قالب تأییدشده. خوانش سخت‌گیرانه است: اگر قالب فرق کند، پیام خطایی با نام مسیر و فیلد نمایش داده می‌شود و داده غلط نمایش داده نمی‌شود. با در دست بودن کد افزونه فقط همین فایل باید تطبیق داده شود.

بقیه بخش‌ها در حالت وردپرس **فقط‌خواندنی** هستند. هر دکمه ثبت یا تأیید پیام «به‌زودی (نیازمند پیاده‌سازی در سرور)» می‌دهد و هیچ تغییری در مرورگر ثبت نمی‌شود. این بخش‌ها عبارت‌اند از:
- صورت‌وضعیت‌ها، خزانه، تنخواه، خرید، انبار، حقوق، قراردادها؛
- تنظیمات، بستن سال و مغایرت بانکی.

## فاز بعد: فرمان‌هایی که سرور باید بسازد

در همه فرمان‌ها بدنه فقط ورودی کاربر است. `version` برای فرمان روی رکورد موجود الزامی است.

### نشست و لیست‌ها

- `GET /me` → `{ id, display_name, role, project_ids, currency, fiscal_year }`
- لیست‌ها، همه محدود به دسترسی کاربر:
  - `GET /client-statements`
  - `GET /subcontractor-statements`
  - `GET /payment-requests`
  - `GET /petty/funds`
  - `GET /petty/expenses`
  - `GET /inventory/materials`
  - `GET /inventory/stock`
  - `GET /inventory/kardex`
  - `GET /purchase-orders`
  - `GET /vendor-invoices`
  - `GET /payroll/periods`
  - `GET /contracts`
  - `GET /documents`

### صورت‌وضعیت

| فرمان | بدنه | کار سرور |
|---|---|---|
| `POST /client-statements` | `contract_id, period_start, period_end, items[{boq_item_id, current_qty}], deductions[{type, amount}], description` | محاسبه مبالغ از مقدار × نرخ، ارزش افزوده با نرخ تنظیمات، سقف استهلاک پیش‌دریافت، شماره |
| `POST /client-statements/{id}/transition` | `action: prepare/submit/consultant_approve/employer_approve/return, comment, version` | کنترل مرحله و نقش. در `employer_approve` رویداد `CLIENT_STATEMENT_APPROVED` و سند. |
| `POST /subcontractor-statements` | `contract_id, lines[{line_key, current_qty}], advance_deduction, deductions[]` | مقدار قبلی از سوابق تأییدشده، سقف مقدار قرارداد، سقف پیش‌پرداخت |
| `POST /subcontractor-statements/{id}/transition` | `action: measure/site_approve/pm_approve/finance_approve/ceo_approve/return/reject, comment, version` | تأیید نهایی رویداد `SUBCONTRACTOR_STATEMENT_APPROVED` و درخواست پرداخت را می‌سازد. |

### خزانه

| فرمان | بدنه | کار سرور |
|---|---|---|
| `POST /payment-requests` | `source_type, beneficiary_id, project_id, amount, due_date, description` | ثبت در انتظار تأیید |
| `POST /payment-requests/{id}/approve` | `version` | تأییدکننده ≠ درخواست‌کننده |
| `POST /payment-requests/{id}/pay` | `source_account: {type: bank/cash_desk, id}, amount, reference, version` | پرداخت‌کننده ≠ تأییدکننده، مبلغ ≤ مانده، کنترل موجودی حساب، `TREASURY_PAYMENT` |
| `POST /receipts` | `statement_id, bank_account_id, amount, reference` | مبلغ ≤ مانده صورت‌وضعیت، `TREASURY_RECEIPT` |

### تنخواه

| فرمان | بدنه |
|---|---|
| `POST /petty/expenses` | `fund_id, date, category, amount, vendor, invoice_number, description, attachments[]` |
| `POST /petty/expenses/{id}/approve` | `comment, version` (زنجیره تأیید از تنظیمات، هر مرحله کاربر متفاوت) |
| `POST /petty/expenses/{id}/reject` | `reason, return_to_user, version` |
| `POST /petty/funds/{id}/replenish` | `amount, reason` (درخواست پرداخت شارژ) |
| `POST /petty/funds/{id}/reconcile` | `counted_cash, period_start, reason` (اختلاف ← سند تعدیل پیش‌نویس) |

### حقوق و خرید

| فرمان | بدنه |
|---|---|
| `POST /payroll/periods/{period}/approve` | `version` (`PAYROLL_APPROVED` + درخواست پرداخت خالص حقوق) |
| `POST /vendor-invoices/{id}/approve` | `version` (فاکتور متوقف یا مغایرت‌دار رد می‌شود؛ `VENDOR_INVOICE`) |
| `POST /purchase-requisitions` ، `/purchase-requisitions/{id}/approve` | ورودی فرم / `version` |
| `POST /purchase-orders` | `supplier_id, project_id, items[{material_id, qty, unit_price}], delivery_date` (ارزش افزوده و جمع‌ها در سرور) |

### انبار

| فرمان | بدنه |
|---|---|
| `POST /grn` | `purchase_order_id, warehouse_id, items[{po_item_id, accepted_qty}]` |
| `POST /store-issues` | `warehouse_id, project_id, cost_center_id, items[{material_id, qty}]` (شماره حواله را سرور می‌دهد) |
| `POST /store-issues/{id}/confirm` | `version` (تأییدکننده ≠ درخواست‌کننده، کنترل موجودی آزاد) |
| `POST /returns` | `kind: from_project/to_supplier, source_id, material_id, qty, reason` |
| `POST /transfers` ، `POST /transfers/{id}/deliver` | `source_warehouse_id, target_warehouse_id, items[]` / `version` |
| `POST /stocktakes/{id}/apply` | `counts[{material_id, counted_qty}], version` (مغایرت را سرور حساب می‌کند) |

### حسابداری

| فرمان | بدنه |
|---|---|
| `POST /accounting/entries` | فقط پیش‌نویس: `date, description, project_id, lines[{account_code, debit, credit, description, project_id, cost_center_id, subledger_code}]`. حساب گروه یا کل پذیرفته نمی‌شود. |
| `POST /accounting/entries/{id}/post` | `version` |
| `POST /accounting/entries/{id}/reverse` | `reason, version`. معکوسِ معکوس و معکوسِ سند اختتامیه ممنوع است. معکوس سند خودکار فقط از مسیر برگشت عملیات منبع مجاز است. |
| `POST /fiscal-years/{year}/close` | `version` (فقط سال گذشته و به ترتیب؛ تاریخ آخرین روز واقعی سال) |

## پیاده‌سازی در کلاینت

- **`src/api/types.ts`:** `DataSource` دو حالت دارد:
  - `mock` با `saveChanges`، که داده نمایشی را در حافظه نگه می‌دارد؛
  - `wordpress` با `commands` (`CommandGateway`).
- **`src/store/useWorkflows.ts`:** در حالت وردپرس گردش‌کار مرجع فقط روی یک کپی دورریختنی از state اجرا می‌شود تا ورودی اعتبارسنجی شود. سپس فرمان به سرور می‌رود و پاسخ سرور با اکشن `MERGE_SERVER_RECORDS` در store ادغام می‌شود. فرمانی که سرور ندارد، پیام «به‌زودی» می‌دهد.
- **`src/store/AppStore.tsx`:** در حالت وردپرس هر تغییر محلی در داده تجاری رد می‌شود. فقط وضعیت‌های صرفاً نمایشی مثل اعلان‌های بسته‌شده استثنا هستند.
- **`src/api/client.ts`:** تابع `sendCommand` سربرگ‌های `Idempotency-Key` و `If-Match` را می‌گذارد. خطای شبکه یک بار با همان کلید تکرار می‌شود.
