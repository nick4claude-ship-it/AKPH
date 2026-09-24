const isDev = (): boolean => {
  try {
    return typeof import.meta !== 'undefined' && import.meta.env
      ? Boolean(import.meta.env.DEV)
      : true;
  } catch {
    return true;
  }
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type DocumentCategory =
  | 'قرارداد اصلی کارفرما'
  | 'قرارداد پیمانکار جزء'
  | 'صورت‌وضعیت کارفرما'
  | 'صورت‌وضعیت پیمانکار جزء'
  | 'فاکتور خرید تأمین‌کننده'
  | 'نامه و مکاتبات رسمی'
  | 'صورتجلسه کارگاهی'
  | 'نقشه اجرایی و ازبیلت'
  | 'گزارش کنترل کیفیت و آزمایشگاه'
  | 'ضمانت‌نامه بانکی'
  | 'رسید و سند مالی';

export interface SystemDocument {
  id: string;
  docNumber: string;
  title: string;
  category: DocumentCategory;
  date: string;
  projectId: string;
  projectName: string;
  contractId?: string;
  contractNumber?: string;
  costCenterId?: string;
  counterpartyId?: string;
  partnerId?: string;
  partnerName?: string;
  partnerType?: 'کارفرما' | 'پیمانکار جزء' | 'تأمین‌کننده' | 'بانک/بیمه';
  statementId?: string;
  statementNumber?: string;
  transactionId?: string;
  fileFormat: 'PDF' | 'DWG' | 'XLSX' | 'JPG' | 'DOCX';
  fileSize: string;
  status: 'معتبر و جاری' | 'نیازمند تمدید' | 'منقضی شده' | 'پیش‌نویس';
  confidentiality: 'عادی' | 'محرمانه مدیریت' | 'فنی کارگاهی';
  registeredBy: string;
  tags: string[];
  description: string;
}

const rawSystemDocuments: SystemDocument[] = [
  {
    id: 'doc-001',
    costCenterId: 'cc-prj101-01',
    counterpartyId: 'cp-cl-01',
    docNumber: 'CTR-DOC-1402-185',
    title: 'قرارداد اصلی پیمانکاری عمومی احداث برج تجاری رونیکا',
    category: 'قرارداد اصلی کارفرما',
    date: '۱۴۰۲/۰۳/۱۵',
    projectId: 'prj-101',
    projectName: 'برج تجاری-اداری رونیکا',
    contractId: 'cnt-01',
    contractNumber: '۹۸/۲۴۰۵/ص',
    partnerId: 'cp-cl-01',
    partnerName: 'شرکت سرمایه‌گذاری توسعه ساختمان تابان',
    partnerType: 'کارفرما',
    fileFormat: 'PDF',
    fileSize: '۱۴.۲ MB',
    status: 'معتبر و جاری',
    confidentiality: 'محرمانه مدیریت',
    registeredBy: 'دکتر هادی صمدیان',
    tags: ['قرارداد کارفرما', 'EPC', 'برج رونیکا', 'شرایط عمومی پیمان'],
    description: 'نسخه امضا شده کامل قرارداد ساخت برج رونیکا شامل شرایط عمومی و خصوصی پیمان، برنامه زمانبندی اولیه و جدول تعهدات طرفین.',
  },
  {
    id: 'doc-002',
    costCenterId: 'cc-prj101-01',
    counterpartyId: 'cp-bnk-01',
    docNumber: 'BG-DOC-MEL-8491',
    title: 'ضمانت‌نامه حسن انجام تعهدات قرارداد رونیکا (۵٪ مبلغ پیمان)',
    category: 'ضمانت‌نامه بانکی',
    date: '۱۴۰۲/۰۳/۱۰',
    projectId: 'prj-101',
    projectName: 'برج تجاری-اداری رونیکا',
    contractId: 'cnt-01',
    contractNumber: '۹۸/۲۴۰۵/ص',
    partnerId: 'cp-bnk-01',
    partnerName: 'بانک ملت - شعبه مرکزی',
    partnerType: 'بانک/بیمه',
    fileFormat: 'PDF',
    fileSize: '۲.۴ MB',
    status: 'معتبر و جاری',
    confidentiality: 'محرمانه مدیریت',
    registeredBy: 'دکتر هادی صمدیان',
    tags: ['ضمانت‌نامه', 'بانک ملت', 'حسن انجام تعهدات', '۹.۲۵ میلیارد تومان'],
    description: 'ضمانت‌نامه صادره توسط بانک ملت به نفع شرکت تابان به مبلغ ۹ میلیارد و ۲۵۰ میلیون تومان با سررسید ۱۴۰۴/۰۸/۳۰.',
  },
  {
    id: 'doc-003',
    costCenterId: 'cc-prj101-01',
    counterpartyId: 'cp-cl-01',
    contractId: 'cnt-01',
    docNumber: 'ST-DOC-RONIKA-08',
    title: 'صورت‌وضعیت موقت شماره ۸ برج رونیکا به همراه ریزمتره و مالی',
    category: 'صورت‌وضعیت کارفرما',
    date: '۱۴۰۳/۰۶/۲۵',
    projectId: 'prj-101',
    projectName: 'برج تجاری-اداری رونیکا',
    statementId: 'stm-04',
    statementNumber: 'صورت‌وضعیت ۸',
    partnerId: 'cp-cl-01',
    partnerName: 'شرکت سرمایه‌گذاری تابان',
    partnerType: 'کارفرما',
    fileFormat: 'XLSX',
    fileSize: '۸.۶ MB',
    status: 'معتبر و جاری',
    confidentiality: 'عادی',
    registeredBy: 'مهندس کیارش نادری',
    tags: ['صورت‌وضعیت', 'کارکرد موقت', 'تایید نظارت', 'رونیکا'],
    description: 'شامل دفترچه محاسبات احجام بتن‌ریزی سقف‌های ۲۲ الی ۲۵، تیغه‌چینی بلوک سبک لیکا و تاسیسات زیرسقف.',
  },
  {
    id: 'doc-004',
    costCenterId: 'cc-prj101-01',
    counterpartyId: 'cp-sub-02',
    contractId: 'cnt-01',
    docNumber: 'SUB-DOC-ARMAN-01',
    title: 'قرارداد دستمزدی اجرای آرماتوربندی و قالب‌بندی سازه رونیکا',
    category: 'قرارداد پیمانکار جزء',
    date: '۱۴۰۲/۰۴/۰۱',
    projectId: 'prj-101',
    projectName: 'برج تجاری-اداری رونیکا',
    partnerId: 'cp-sub-02',
    partnerName: 'شرکت آرمان بتن سازه',
    partnerType: 'پیمانکار جزء',
    fileFormat: 'PDF',
    fileSize: '۴.۸ MB',
    status: 'معتبر و جاری',
    confidentiality: 'عادی',
    registeredBy: 'مهندس کیارش نادری',
    tags: ['پیمانکار جزء', 'آرماتوربندی', 'قالب‌بندی', 'آرمان بتن'],
    description: 'قرارداد اجرای سازه بتنی با نرخ واحد هر کیلوگرم آرماتوربندی و هر مترمربع قالب‌بندی مدولار فلزی.',
  },
  {
    id: 'doc-005',
    costCenterId: 'cc-prj101-01',
    contractId: 'cnt-01',
    docNumber: 'DWG-RON-S-220',
    title: 'نقشه شاپ‌دراوینگ دیتیل اتصالات تیرهای بتنی طبقه ۲۴ برج',
    category: 'نقشه اجرایی و ازبیلت',
    date: '۱۴۰۳/۰۶/۱۵',
    projectId: 'prj-101',
    projectName: 'برج تجاری-اداری رونیکا',
    fileFormat: 'DWG',
    fileSize: '۲۸.۵ MB',
    status: 'معتبر و جاری',
    confidentiality: 'فنی کارگاهی',
    registeredBy: 'مهندس دفتر فنی کارگاه',
    tags: ['نقشه', 'شاپ دراوینگ', 'سازه', 'طبقه ۲۴'],
    description: 'دیتیل مورد تایید دستگاه نظارت مشاور سازه پایدار جهت اجرای آرماتورهای تقویتی در پیرامون داکت‌های تاسیساتی.',
  },
  {
    id: 'doc-006',
    costCenterId: 'cc-prj101-01',
    counterpartyId: 'cp-sup-01',
    contractId: 'cnt-01',
    docNumber: 'INV-DOC-ZOB-101',
    title: 'فاکتور رسمی الکترونیکی سامانه مودیان خرید میلگرد از ذوب‌آهن',
    category: 'فاکتور خرید تأمین‌کننده',
    date: '۱۴۰۳/۰۶/۲۸',
    projectId: 'prj-101',
    projectName: 'برج تجاری-اداری رونیکا',
    partnerId: 'cp-sup-01',
    partnerName: 'شرکت سهامی ذوب‌آهن اصفهان',
    partnerType: 'تأمین‌کننده',
    fileFormat: 'PDF',
    fileSize: '۱.۱ MB',
    status: 'معتبر و جاری',
    confidentiality: 'عادی',
    registeredBy: 'مدیر تدارکات',
    tags: ['فاکتور رسمی', 'سامانه مودیان', 'میلگرد', 'ذوب‌آهن', 'ارزش افزوده'],
    description: 'خرید ۳۵ تن میلگرد با کد مالیاتی یکتا و محاسبه ۱۰٪ مالیات بر ارزش افزوده قانونی.',
  },
  {
    id: 'doc-007',
    costCenterId: 'cc-prj102-01',
    counterpartyId: 'cp-cl-02',
    contractId: 'cnt-02',
    docNumber: 'QC-DOC-FAJR-391',
    title: 'نتایج آزمایش مقاومت فشاری نمونه‌های بتن ۲۸ روزه شمع‌های تقاطع فجر',
    category: 'گزارش کنترل کیفیت و آزمایشگاه',
    date: '۱۴۰۳/۰۶/۲۰',
    projectId: 'prj-102',
    projectName: 'تقاطع غیرهمسطح بزرگراه فجر',
    partnerId: 'cp-cl-02',
    partnerName: 'معاونت فنی و عمرانی شهرداری تهران',
    partnerType: 'کارفرما',
    fileFormat: 'PDF',
    fileSize: '۳.۲ MB',
    status: 'معتبر و جاری',
    confidentiality: 'فنی کارگاهی',
    registeredBy: 'مهندس کنترل کیفیت (QC)',
    tags: ['آزمایشگاه بتن', 'مقاومت ۲۸ روزه', 'شمع‌های پل', 'استاندارد'],
    description: 'تاییدیه آزمایشگاه مکانیک خاک و بتن دانشگاه تهران مبنی بر دستیابی به مقاومت مشخصه C40 برای شمع‌های شماره ۵ و ۶.',
  },
  {
    id: 'doc-008',
    costCenterId: 'cc-prj102-01',
    counterpartyId: 'cp-cl-02',
    contractId: 'cnt-02',
    docNumber: 'LET-DOC-FAJR-84',
    title: 'نامه اخطار تاخیر در پرداخت صورت‌وضعیت شماره ۸ به کارفرمای شهرداری',
    category: 'نامه و مکاتبات رسمی',
    date: '۱۴۰۳/۰۶/۱۸',
    projectId: 'prj-102',
    projectName: 'تقاطع غیرهمسطح بزرگراه فجر',
    partnerId: 'cp-cl-02',
    partnerName: 'معاونت فنی و عمرانی شهرداری تهران',
    partnerType: 'کارفرما',
    fileFormat: 'PDF',
    fileSize: '۰.۹ MB',
    status: 'معتبر و جاری',
    confidentiality: 'محرمانه مدیریت',
    registeredBy: 'مهندس محمدرضا رادمنش',
    tags: ['مکاتبات', 'شهرداری تهران', 'مطالبات معوق', 'ماده ۳۷'],
    description: 'ابلاغ رسمی تبعات مالی و توقف احتمالی به دلیل تعویق بیش از ۶۰ روزه در پرداخت مطالبات تایید شده تقاطع فجر.',
  },
  {
    id: 'doc-009',
    costCenterId: 'cc-prj104-01',
    counterpartyId: 'cp-cl-04',
    contractId: 'cnt-04',
    docNumber: 'MOM-DOC-NIL-12',
    title: 'صورتجلسه تحویل موقت اولیه تاسیسات مکانیکی مجتمع نیلوفر',
    category: 'صورتجلسه کارگاهی',
    date: '۱۴۰۳/۰۶/۲۹',
    projectId: 'prj-104',
    projectName: 'مجتمع مسکونی نیلوفر (۱۲۰ واحدی)',
    partnerId: 'cp-cl-04',
    partnerName: 'تعاونی مسکن کارکنان دانشگاه علوم پزشکی',
    partnerType: 'کارفرما',
    fileFormat: 'PDF',
    fileSize: '۲.۶ MB',
    status: 'معتبر و جاری',
    confidentiality: 'عادی',
    registeredBy: 'مهندس مهران پورحسینی',
    tags: ['صورتجلسه', 'تحویل موقت', 'تاسیسات', 'نیلوفر'],
    description: 'امضای کمیسیون تحویل موقت موتورخانه، چیلرها و پمپ‌های آبرسانی با درج رفع نواقص جزیی ظرف مدت ۱۵ روز.',
  },
];

export const mockSystemDocuments: SystemDocument[] = isDev() ? rawSystemDocuments : [];
