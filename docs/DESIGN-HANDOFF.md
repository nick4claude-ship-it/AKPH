# تحویل طراحی ظاهر — مرز طراحی و منطق

این سند برای طراحی است که فقط **ظاهر** پرتال را تغییر می‌دهد و فایل‌ها را به‌صورت ZIP برمی‌گرداند
(بدون دسترسی به گیت‌هاب). همه منطق کسب‌وکار — محاسبه مبلغ، قاعده ثبت سند، کنترل دسترسی، مراحل
تأیید — در `src/store` و `src/utils` است و طراح آن را نمی‌بیند و تغییر نمی‌دهد. صفحه‌ها فقط داده
آماده را از hookها و selectorها می‌گیرند و نمایش می‌دهند، و هر تغییری را با یک فرمان `useWorkflows()`
انجام می‌دهند.

## ۱. روند کار

1. در مخزن: `npm run design:pack` ← فایل `design-handoff.zip` ساخته می‌شود (کد منبع اپ، همین سند،
   `package.json`). طراح با `npm install && npm run dev` اپ را با **داده نمایشی** اجرا می‌کند؛ هیچ
   سروری لازم نیست.
2. طراح فقط فایل‌های پوشه‌های مجاز (بخش ۲) را تغییر می‌دهد و ZIP را با **همان مسیرها** برمی‌گرداند
   (مثلاً `src/components/layout/Header.tsx`).
3. در مخزن، ZIP روی ریشه مخزن باز می‌شود (`unzip -o design.zip`) و بعد:

   ```bash
   npm run check:design                        # تغییرات commit‌نشده
   npm run check:design -- --base=origin/main  # یا همه تغییرات این شاخه
   npm run check:design -- --strict            # فایل بیرون از پوشه‌های مجاز = شکست
   ```

   این دستور فهرست فایل‌های تغییرکرده را نشان می‌دهد، `npm run lint`، `npm run build` و
   `npm test` را اجرا می‌کند (که بررسی مرز طراحی — `npm run test:boundary` — را هم دارد) و اگر
   فایلی بیرون از پوشه‌های مجاز تغییر کرده باشد، با علامت ⚠ هشدار می‌دهد.

## ۲. پوشه‌ها

| مسیر | طراح | محتوا |
|---|---|---|
| `src/components/**` | **قابل تغییر** | همه صفحه‌ها، فرم‌ها، جدول‌ها و پوسته (`layout/AppShell.tsx`: سایدبار، سربرگ، پانویس، مسیرها) |
| `src/pages/**` | **قابل تغییر** | داشبورد، اعلان‌ها، تنظیمات |
| `src/index.css` | **قابل تغییر** | Tailwind v4، فونت، رنگ‌ها، چاپ |
| `src/assets/**` | قابل تغییر (فقط تصویر/آیکون) | تصاویر و SVG |
| `src/store/**` | قفل | وضعیت، selectorها، view modelها (`store/views`)، فرمان‌ها (workflows)، مجوزها |
| `src/utils/**` | قفل | پول (ریال صحیح)، تاریخ شمسی، شماره سند، مجوزها، قالب‌بندی |
| `src/ui/**` | قفل | اجزای پایه دسترس‌پذیر: `Dialog`، `IntegerInput`، `MoneyInput`، `PercentInput` |
| `src/api/**`، `src/types/**`، `src/navigation/**` | قفل | منبع داده، نوع‌ها، منوی ناوبری |
| `src/App.tsx`، `src/main.tsx` | قفل | فقط پوسته را از `components/layout/AppShell` بارگذاری می‌کنند |
| `wordpress-plugin/**`، `scripts/**`، `docs/**`، `.github/**`، `reference/**` | قفل | سرور، ساخت، آزمون، مستندات |
| `package.json`، `vite.config.ts`، `tsconfig.json`، `index.html` | قفل | وابستگی جدید اضافه نشود |

اگر ظاهر به داده‌ای نیاز دارد که هیچ selector آن را نمی‌دهد (مثلاً یک جمع یا درصد جدید)، طراح آن را در
یادداشت تحویل بخواهد؛ آن را توسعه‌دهنده در `src/store/views` اضافه می‌کند. داخل کامپوننت محاسبه نشود.

## ۳. چیزهایی که یک صفحه می‌تواند import کند

`npm run test:boundary` (فایل `scripts/check-design-boundary.mjs`) همین فهرست را بررسی می‌کند:

| ماژول | نام‌های مجاز | کاربرد |
|---|---|---|
| `react`، `react-dom`، `react-router-dom`، `lucide-react` | همه | بسته دیگری مجاز نیست |
| `src/components/**`، `src/pages/**`، `src/assets/**` | همه | |
| `src/store/views/*` | همه | view modelهای هر ماژول: `contracts`، `procurement`، `inventory`، `pettyCash`، `accounting`، `treasury`، `dashboard`، `reports`، `people`، `approvals`، `exports` |
| `src/store/AppStore` | `useAppState`، `useSelector` | خواندن وضعیت؛ `useSelector(select, deps)` نتیجه را memo می‌کند |
| `src/store/session` | همه | `useSession`، `useCurrentUser`، `useCompany`، `usePermission`، `useDemoBanner`، `useReadOnlyNotice` |
| `src/store/useWorkflows` | همه | **تنها راه نوشتن**: `const wf = useWorkflows(); const r = wf.createPurchaseOrder(input); onToast(r.message)` |
| `src/store/useApprovalActions` | همه | تأیید/رد از کارتابل مرکزی |
| `src/store/useAssistant` | همه | دستیار هوشمند |
| `src/store/notifications` | `useDismissedNotifications` | |
| `src/store/toast` | همه | |
| `src/store/selectors`، `src/store/domainSelectors` | همه | selectorهای مشترک (پروژه، KPI، تأییدها، اسناد، انبار، …) |
| `src/utils/formatters` | همه | `formatMoney`، `formatMoneyCompact`، `formatCurrency`، `formatCurrencyCompact`، `formatInt`، `formatNumber`، `formatDecimal`، `formatPercent`، `barWidth`، `toPersianDigits` |
| `src/utils/money` | `formatMoney`، `formatMoneyCompact`، `formatRial`، `formatToman`، `formatInt`، `moneyUnitLabel` | |
| `src/utils/date` | `toPersianDate`، `toPersianTime`، `toPersianDateTime`، `getRelativePersianDate`، `getCurrentFiscalYear`، `getFormattedCurrentPersianDate`، `getCurrentPersianMonthName` | |
| `src/utils/export` | `downloadTable`، `CsvTable` | خروجی CSV (جدول را `store/views/exports` می‌سازد) |
| `src/navigation/navConfig` | همه | |
| `src/ui/Dialog`، `src/ui/NumberInput` | همه | |
| هر ماژول دیگر `src/` | فقط `import type` | مثلاً `import type { WorkflowResult } from '../../store/workflowKit'` |

هر فرمان `useWorkflows()` یک `WorkflowResult` برمی‌گرداند: `{ ok: boolean; message: string; ... }`.
صفحه فقط `message` را نشان می‌دهد و اگر `ok` بود فرم را می‌بندد. اعتبارسنجی، شماره سند، سند حسابداری و
کنترل دسترسی داخل فرمان (و در حالت واقعی داخل سرور) انجام می‌شود.

## ۴. صفحه‌ها: propها و hookها

مسیریابی Hash است (`#/projects`)؛ مسیرها در `src/navigation/navConfig.ts` و `components/layout/AppShell.tsx`
تعریف شده‌اند. پوسته این propها را به هر صفحه می‌دهد (`projects` همیشه خروجی `selectProjects(state)` است؛
`onToast(msg)` پیام را در بالای صفحه نشان می‌دهد):

| مسیر | کامپوننت | props | hookها و view modelها |
|---|---|---|---|
| `/` | `pages/DashboardPage` | `projects`، `selectedProjectId`، `timeRange`، `onChangeTimeRange`، `onOpenProject(p)`، `onOpenReport()`، `onViewApproval(item)`، `onToast` | `useAppState`، `useCurrentUser`، `useApprovalActions`، `useDismissedNotifications`؛ `selectKpiItems`، `selectMonthlyFinancialTrend`، `selectExpenseCategoryTotals`، `selectApprovals`، `selectNotifications`، `selectPettyFunds`؛ `views/dashboard` |
| `/projects`، `/projects/:projectId` | `project/ProjectsModule` | `projects`، `projectId?`، `onOpenProject(id \| null)`، `onNavigate(path)` | `useAppState`؛ `selectProjectFinancials`، `selectProjectSuppliers`، `selectWarehouses`، `selectPettyFunds`، `selectDocumentsFor`؛ `views/reports.projectBudgetFigures` |
| `/contracts/client`، `/contracts/subcontract` | `contracts/ContractsModule` | `mode: 'client' \| 'subcontractor'`، `projects`، `currentUser`، `onPosted?(docNumber)`، `onToast?` | `useAppState`، `useSelector`، `useCompany`، `useWorkflows`؛ `views/contracts` |
| `/statements/client`، `/statements/subcontractor` | `statements/ProgressStatementsModule` | `projects`، `tab: 'client_statements' \| 'subcontractor_statements'`، `onToast` | `useAppState`، `useCurrentUser`، `useWorkflows`؛ `views/contracts` (`clientStatementActions`، `subcontractorStatementActions`، `statementBalances`، `clientStatementStage`، `CLIENT_FLOW_STEPS`، …) |
| `/procurement` | `procurement/ProcurementModule` | `projects`، `currentUser`، `onToast` | `useAppState`، `useWorkflows`؛ `views/procurement` |
| `/inventory` | `inventory/InventoryModule` | `projects`، `currentUser` | `useAppState`، `useWorkflows`؛ `views/inventory`، `selectStockByWarehouse`، … |
| `/petty-cash` | `petty_cash/PettyCashModule` | `projects`، `currentUser`، `onToast` | `useAppState`، `useWorkflows`؛ `views/pettyCash` |
| `/finance/accounting` | `accounting/AccountingModule` | `currentUser` | `useAppState`، `useSelector`، `usePermission`، `useWorkflows`؛ `views/accounting` |
| `/finance/payments`، `/finance/receipts`، `/finance/banks`، `/finance/cash` | `finance/PaymentsTreasuryModule` | `tab`، `projects`، `currentUser`، `onToast` | `useAppState`، `usePermission`، `useWorkflows`؛ `views/treasury` |
| `/partners/{clients,subcontractors,suppliers}[/:id]` | `partners/PartnersModule` | `projects`، `kind`، `counterpartyId?`، `onOpenProfile(id \| null)`، `onNavigate(path)` | `useAppState`؛ `domainSelectors` |
| `/payroll` | `hr_payroll/PayrollModule` | `projects`، `currentUser`، `onToast` | `useAppState`، `useCompany`، `usePermission`، `useWorkflows`؛ `views/people` |
| `/documents` | `documents/DocumentCenterModule` | `projects` | `useAppState`، `useCurrentUser`، `useWorkflows` |
| `/approvals` | `approvals/ApprovalCenterModule` | `onToast` | `useAppState`، `useCurrentUser`، `usePermission`، `useApprovalActions`؛ `selectApprovals`، `views/approvals` |
| `/notifications` | `pages/NotificationCenterPage` | — | `useAppState`، `useDismissedNotifications`؛ `selectNotifications` |
| `/reports` | `reports/ReportsBIModule` | `projects` | `useSelector`؛ `views/reports` |
| `/ai` | `dashboard/AiAgentWidget` | `isOpen?`، `onClose?`، `isFloating?` | `useCurrentUser`، `useAssistant` |
| `/settings` | `pages/SettingsPage` | `onToast` | `useAppState`، `usePermission`، `useWorkflows` |
| پوسته | `layout/AppShell` (+ `Sidebar`، `Header`) | — | `useSession`، `useCompany`، `useDemoBanner`، `useReadOnlyNotice`، `usePermission`، `useApprovalActions`، `useToastListener`، `selectSidebarCounts`، `navConfig` |

صفحه‌هایی که مجوز لازم دارند (حسابداری، خزانه، حقوق، تنظیمات) در پوسته با `guarded(...)` بسته می‌شوند؛
داخل صفحه، دکمه‌ها با `usePermission().can(action, context)` یا با فیلدهای view model (مثل
`clientStatementActions(user, s).advance.allowed`) پنهان یا غیرفعال می‌شوند. **تصمیم دسترسی را طراح
نمی‌گیرد**؛ فقط همان مقدار را نمایش می‌دهد.

## ۵. قواعدی که ظاهر باید رعایت کند

1. **RTL و فارسی.** `index.html` دارای `dir="rtl"` و `lang="fa"` است. چیدمان با کلاس‌های منطقی
   (`ms-*`/`me-*`، `start`/`end`) یا با در نظر گرفتن RTL؛ آیکون‌های جهت‌دار (فلش «بعدی») به چپ اشاره کنند.
   فونت Vazirmatn را پوسته بارگذاری می‌کند (`font-sans`)؛ فونت یا CDN خارجی جدیدی اضافه نشود.
2. **ارقام فارسی.** هیچ عددی خام در JSX نوشته نشود (`{items.length}` ✘). شمارش: `formatInt`؛ عدد اعشاری و
   مقدار: `formatDecimal`؛ درصد: `formatPercent` (علامت ٪ را خودش می‌گذارد)؛ تاریخ: `toPersianDate`.
   `toLocaleString` و `toFixed` در کامپوننت ممنوع است. شماره سند و کد (رشته) همان‌طور نمایش داده می‌شود.
3. **مبلغ فقط با formatRial/formatToman.** همه مبالغ در store عدد صحیح **ریال** است. نمایش فقط با
   `formatMoney(rial)` / `formatMoneyCompact(rial)` (یا نام‌های قدیمی `formatCurrency` / `formatCurrencyCompact`)
   که بر اساس تنظیم کاربر `formatRial` یا `formatToman` را صدا می‌زنند و واحد را خودشان می‌نویسند؛ برای
   ستون‌های جدول: `formatMoney(x, false)` و واحد در سرستون با `moneyUnitLabel()`. «تومان» یا «ریال» دستی
   پشت مبلغ نوشته نشود. ورود مبلغ فقط با `<MoneyInput>`، درصد با `<PercentInput>`، عدد صحیح با
   `<IntegerInput>` (از `src/ui/NumberInput`).
4. **مودال.** فقط `<Dialog>` از `src/ui/Dialog` — خودش `role="dialog"`، `aria-modal`، بستن با Esc، تله
   فوکوس و بازگرداندن فوکوس را دارد. عنوان را با `labelledBy="<id عنوان>"` یا `label="..."` بدهید. نوشتن
   `role="dialog"` دستی ممنوع است.
5. **برچسب فرم.** هر `<label>` یا `htmlFor` دارد (با `id` یکتا — در کامپوننت‌های تکرارشونده از `useId()`)
   یا کنترل را درون خودش دارد.
6. **بدون منطق کسب‌وکار.** در `src/components` و `src/pages` این‌ها ممنوع است (و آزمون مرز شکست می‌خورد):
   `.reduce(`، `Math.`، `.toFixed(`، `.toLocaleString(`، `useStoreSlice` / `useAppDispatch` / `useGetState` /
   `usePostFinancialEvent` / `useDataSource`، `generateUUID` / `nextDocNumber`، `fetch(` /
   `window.PaydarPortal`، `localStorage` / `sessionStorage`. عرض نوار پیشرفت: `barWidth(percent)`.
   فیلتر و مرتب‌سازی **نمایشی** (جست‌وجو، انتخاب پروژه، تب) مجاز است.
7. **حالت فقط‌خواندنی و نمایشی.** نوار `useDemoBanner()` («نسخه نمایشی — داده ساختگی») و پیام
   `useReadOnlyNotice(pathname)` باید در پوسته دیده شوند؛ حذف یا پنهان نشوند.
8. **دسترس‌پذیری.** دکمه‌های فقط-آیکون `aria-label` داشته باشند؛ رنگ تنها نشانه وضعیت نباشد (متن وضعیت
   هم نمایش داده شود)؛ کنتراست متن کوچک کافی باشد.
9. **چاپ.** کلاس `no-print` برای بخش‌هایی که در چاپ نباید باشند؛ قواعد چاپ در `src/index.css`.

## ۶. مشکلات شناخته‌شده ظاهر

- صفحه حسابداری (`#/finance/accounting`) در عرض ۱۴۴۰ پیکسل سرریز افقی دارد (جدول‌های پهن). جدول‌ها باید در
  ظرف `overflow-x-auto` خودشان اسکرول شوند، نه کل صفحه.
- در عرض موبایل، سایدبار ثابت (`mr-68`) بخشی از محتوا را می‌پوشاند؛ پوسته برای عرض کم حالت کشویی ندارد.

## ۷. فهرست بررسی پیش از تحویل ZIP

- [ ] فقط فایل‌های `src/components`، `src/pages`، `src/index.css` (و در صورت نیاز `src/assets`) تغییر کرده‌اند.
- [ ] هیچ import جدیدی از بسته یا ماژول خارج از جدول بخش ۳ اضافه نشده است.
- [ ] همه اعداد و مبالغ با توابع قالب‌بندی نمایش داده می‌شوند؛ هیچ رقم لاتین در متن فارسی نیست.
- [ ] همه مودال‌ها `<Dialog>` و همه برچسب‌ها `htmlFor` دارند.
- [ ] `npm run dev` اجرا شد و همه مسیرهای جدول بخش ۴ با داده نمایشی باز می‌شوند.
