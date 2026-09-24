import { demoDataEnabled } from '../demoFlag';

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ClientPartner {
  id: string;
  code: string;
  name: string;
  type: 'دولتی' | 'عمومی غیردولتی' | 'خصوصی';
  nationalId: string;
  economicCode: string;
  representative: string;
  phone: string;
  email: string;
  address: string;
  activeProjectsCount: number;
  totalContractValue: number;
  totalApprovedRevenue: number;
  totalCollected: number;
  currentReceivables: number;
  overdueReceivables: number;
  rating: number; // 1 to 5
  paymentPunctuality: 'عالی' | 'متوسط' | 'با تأخیر مداوم';
  projects: {
    id: string;
    name: string;
    contractNumber: string;
    contractAmount: number;
    approvedRevenue: number;
    receivables: number;
  }[];
}

const rawClients: ClientPartner[] = [
  {
    id: 'cli-01',
    code: 'CLI-101',
    name: 'معاونت فنی کارفرمای نمونه ۲',
    type: 'عمومی غیردولتی',
    nationalId: '10100000366',
    economicCode: '411100000023',
    representative: 'دکتر علیرضا صبوری (معاونت نظارت بر پروژه‌های بزرگ)',
    phone: '۰۲۱-۰۰۰۰۰۰۳۰',
    email: 'technical@example.com',
    address: 'تهران، خیابان نمونه ۱۲، پلاک ۱۲',
    activeProjectsCount: 1,
    totalContractValue: 94_000_000_000,
    totalApprovedRevenue: 68_000_000_000,
    totalCollected: 45_500_000_000,
    currentReceivables: 22_500_000_000,
    overdueReceivables: 4_200_000_000,
    rating: 4.1,
    paymentPunctuality: 'با تأخیر مداوم',
    projects: [
      {
        id: 'prj-102',
        name: 'تقاطع غیرهمسطح بزرگراه فجر',
        contractNumber: 'CTR-1402-094',
        contractAmount: 94_000_000_000,
        approvedRevenue: 68_000_000_000,
        receivables: 22_500_000_000,
      },
    ],
  },
  {
    id: 'cli-02',
    code: 'CLI-102',
    name: 'کارفرمای نمونه ۱ (سرمایه‌گذاری تابان)',
    type: 'خصوصی',
    nationalId: '10100000371',
    economicCode: '411100000024',
    representative: 'مهندس محمدرضا شریفی (مدیرعامل هلدینگ تابان)',
    phone: '۰۲۱-۰۰۰۰۰۰۳۱',
    email: 'info@example.com',
    address: 'تهران، خیابان نمونه ۱۳، پلاک ۱۳',
    activeProjectsCount: 1,
    totalContractValue: 185_000_000_000,
    totalApprovedRevenue: 124_000_000_000,
    totalCollected: 95_600_000_000,
    currentReceivables: 28_400_000_000,
    overdueReceivables: 0,
    rating: 4.8,
    paymentPunctuality: 'عالی',
    projects: [
      {
        id: 'prj-101',
        name: 'برج تجاری-اداری رونیکا',
        contractNumber: 'CTR-1402-185',
        contractAmount: 185_000_000_000,
        approvedRevenue: 124_000_000_000,
        receivables: 28_400_000_000,
      },
    ],
  },
  {
    id: 'cli-03',
    code: 'CLI-103',
    name: 'کارفرمای نمونه ۶ (شرکت گاز)',
    type: 'دولتی',
    nationalId: '10100000385',
    economicCode: '411100000025',
    representative: 'مهندس احمد کریمی (مجری خطوط انتقال گاز)',
    phone: '۰۲۱-۰۰۰۰۰۰۳۲',
    email: 'contracts@example.com',
    address: 'تهران، خیابان نمونه ۱۴، پلاک ۱۴',
    activeProjectsCount: 1,
    totalContractValue: 62_000_000_000,
    totalApprovedRevenue: 48_500_000_000,
    totalCollected: 38_500_000_000,
    currentReceivables: 10_000_000_000,
    overdueReceivables: 0,
    rating: 4.6,
    paymentPunctuality: 'متوسط',
    projects: [
      {
        id: 'prj-104',
        name: 'خط انتقال گاز و ایستگاه تقلیل فشار البرز',
        contractNumber: 'CTR-1402-062',
        contractAmount: 62_000_000_000,
        approvedRevenue: 48_500_000_000,
        receivables: 10_000_000_000,
      },
    ],
  },
  {
    id: 'cli-04',
    code: 'CLI-104',
    name: 'تعاونی مسکن کارکنان دانشگاه علوم پزشکی',
    type: 'خصوصی',
    nationalId: '10100000390',
    economicCode: '411100000026',
    representative: 'دکتر سید مهدی حسینی (رئیس هیئت مدیره تعاونی)',
    phone: '۰۲۱-۰۰۰۰۰۰۳۳',
    email: 'maskan@example.com',
    address: 'تهران، خیابان نمونه ۱۵، پلاک ۱۵',
    activeProjectsCount: 1,
    totalContractValue: 48_000_000_000,
    totalApprovedRevenue: 45_200_000_000,
    totalCollected: 41_200_000_000,
    currentReceivables: 4_000_000_000,
    overdueReceivables: 0,
    rating: 4.4,
    paymentPunctuality: 'عالی',
    projects: [
      {
        id: 'prj-103',
        name: 'مجتمع مسکونی نیلوفر (۱۲۰ واحدی)',
        contractNumber: 'CTR-1401-048',
        contractAmount: 48_000_000_000,
        approvedRevenue: 45_200_000_000,
        receivables: 4_000_000_000,
      },
    ],
  },
  {
    id: 'cli-05',
    code: 'CLI-105',
    name: 'کارفرمای نمونه ۸ (سازمان بندری)',
    type: 'دولتی',
    nationalId: '10100000406',
    economicCode: '411100000027',
    representative: 'مهندس بیژن افشار (معاونت زیرساخت و توسعه اسکله‌ها)',
    phone: '۰۷۶-۰۰۰۰۰۰۳۴',
    email: 'ports@example.com',
    address: 'بندرعباس، خیابان نمونه ۱۶، پلاک ۱۶',
    activeProjectsCount: 1,
    totalContractValue: 21_500_000_000,
    totalApprovedRevenue: 6_800_000_000,
    totalCollected: 4_800_000_000,
    currentReceivables: 2_000_000_000,
    overdueReceivables: 0,
    rating: 4.5,
    paymentPunctuality: 'متوسط',
    projects: [
      {
        id: 'prj-105',
        name: 'سیلوی ذخیره غلات بندری ۳۰ هزار تنی',
        contractNumber: 'CTR-1403-021',
        contractAmount: 21_500_000_000,
        approvedRevenue: 6_800_000_000,
        receivables: 2_000_000_000,
      },
    ],
  },
];

export const mockClients: ClientPartner[] = demoDataEnabled() ? rawClients : [];
