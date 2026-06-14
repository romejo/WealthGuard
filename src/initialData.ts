import { Account, RebalancingTarget, AssetCategory } from './types';

export const USD_EXCHANGE_RATE = 1540;

export const KNOWN_STOCKS: Record<string, { category: AssetCategory; price: number; isForeign: boolean }> = {
  '에스티팜': { category: '국내주식', price: 117500, isForeign: false },
  'SK하이닉스': { category: '국내주식', price: 2045000, isForeign: false },
  '엔비디아': { category: '해외주식', price: 208.84, isForeign: true },
  '삼성전자': { category: '국내주식', price: 310000, isForeign: false },
  '삼성전자우': { category: '국내주식', price: 206000, isForeign: false },
  'DB손해보험': { category: '국내주식', price: 139200, isForeign: false },
  'ACE KRX금현물': { category: '금은', price: 29090, isForeign: false },
  '동아쏘시오홀딩스': { category: '국내주식', price: 83200, isForeign: false },
  'LG전자': { category: '국내주식', price: 268000, isForeign: false },
  'Tiger 머니마켓액티브': { category: '현금', price: 102665, isForeign: false },
  'HANARO 원자력iSelect': { category: '국내주식', price: 64505, isForeign: false },
  'Tiger 반도체TOP10': { category: '국내주식', price: 47080, isForeign: false },
  'KODEX 코스닥150': { category: '국내주식', price: 16880, isForeign: false },
  'KODEX TDF2050액티브적격': { category: '국내주식', price: 18135, isForeign: false },
  'Tiger 미국S&P500': { category: '국내주식', price: 27915, isForeign: false },
  'Tiger 미국나스닥100': { category: '국내주식', price: 197695, isForeign: false },
  'KODEX은선물': { category: '금은', price: 11085, isForeign: false }
};

export const DEFAULT_ACCOUNTS: Account[] = [
  {
    id: "toss",
    name: "토스 주식",
    cash: 5083387,
    stocks: [
      {
        id: "t4",
        name: "삼성전자",
        purchasePrice: 291000,
        quantity: 10,
        currentPrice: 310000,
        category: "국내주식",
        isForeign: false,
        ticker: "005930"
      },
      {
        id: "t8",
        name: "SK하이닉스",
        purchasePrice: 2140818,
        quantity: 11,
        currentPrice: 2045000,
        category: "국내주식",
        isForeign: false,
        ticker: "000660"
      },
      {
        id: "t9",
        name: "엔비디아",
        purchasePrice: 216.67,
        quantity: 66,
        currentPrice: 208.84,
        category: "해외주식",
        isForeign: true,
        ticker: "NVDA"
      },
      {
        id: "stock_1780300881068_s30du",
        name: "에스티팜",
        purchasePrice: 132818,
        quantity: 80,
        currentPrice: 117500,
        category: "국내주식",
        isForeign: false,
        ticker: "237690"
      },
      {
        id: "stock_1780301211324_7k9eh",
        name: "달러",
        purchasePrice: 169.33,
        quantity: 1,
        currentPrice: 169.33,
        category: "해외주식",
        isForeign: true
      },
      {
        id: "stock_1780546845890_4gebf",
        name: "삼성전자우",
        ticker: "005935",
        purchasePrice: 207592,
        quantity: 26,
        currentPrice: 206000,
        category: "국내주식",
        isForeign: false
      }
    ]
  },
  {
    id: "meritz",
    name: "메리츠 주식",
    cash: 6846499,
    stocks: [
      {
        id: "m1",
        name: "SK하이닉스",
        purchasePrice: 1768273,
        quantity: 5,
        currentPrice: 2045000,
        category: "국내주식",
        isForeign: false,
        ticker: "000660"
      },
      {
        id: "m2",
        name: "삼성전자",
        purchasePrice: 275429,
        quantity: 33,
        currentPrice: 310000,
        category: "국내주식",
        isForeign: false,
        ticker: "005930"
      },
      {
        id: "m3",
        name: "DB손해보험",
        purchasePrice: 145285,
        quantity: 75,
        currentPrice: 139200,
        category: "국내주식",
        isForeign: false,
        ticker: "005830"
      },
      {
        id: "m6",
        name: "ACE KRX금현물",
        purchasePrice: 30465,
        quantity: 164,
        currentPrice: 29090,
        category: "금은",
        isForeign: false,
        ticker: "411060"
      },
      {
        id: "m7",
        name: "동아쏘시오홀딩스",
        purchasePrice: 92413,
        quantity: 55,
        currentPrice: 83200,
        category: "국내주식",
        isForeign: false,
        ticker: "000640"
      }
    ]
  },
  {
    id: "hantoo_irp",
    name: "한투 IRP",
    cash: 19195,
    stocks: [
      {
        id: "h2",
        name: "Tiger 머니마켓액티브",
        purchasePrice: 102554,
        quantity: 89,
        currentPrice: 102665,
        category: "현금",
        isForeign: false,
        ticker: "0043B0"
      },
      {
        id: "h3",
        name: "ACE KRX금현물",
        purchasePrice: 31008,
        quantity: 628,
        currentPrice: 29090,
        category: "금은",
        isForeign: false,
        ticker: "411060"
      },
      {
        id: "stock_1780621512972_899sg",
        name: "HANARO 원자력iSelect",
        ticker: "434730",
        purchasePrice: 67000,
        quantity: 14,
        currentPrice: 64505,
        category: "국내주식",
        isForeign: false
      },
      {
        id: "stock_1780621567259_6v3az",
        name: "Tiger 반도체TOP10",
        ticker: "396500",
        purchasePrice: 48525,
        quantity: 19,
        currentPrice: 47080,
        category: "국내주식",
        isForeign: false
      }
    ]
  },
  {
    id: "nh_irp",
    name: "농협 IRP",
    cash: 5504337,
    stocks: [
      {
        id: "nh1",
        name: "Tiger 반도체TOP10",
        purchasePrice: 45115,
        quantity: 373,
        currentPrice: 47080,
        category: "국내주식",
        isForeign: false,
        ticker: "396500"
      },
      {
        id: "nh2",
        name: "Tiger 머니마켓액티브",
        purchasePrice: 102576,
        quantity: 218,
        currentPrice: 102665,
        category: "현금",
        isForeign: false,
        ticker: "0043B0"
      },
      {
        id: "stock_1780301713710_kunf4",
        name: "KODEX 코스닥150",
        purchasePrice: 17695,
        quantity: 849,
        currentPrice: 16880,
        category: "국내주식",
        isForeign: false,
        ticker: "229200"
      },
      {
        id: "stock_1780537916844_8frto",
        name: "HANARO 원자력iSelect",
        purchasePrice: 67989,
        quantity: 190,
        currentPrice: 64505,
        category: "국내주식",
        isForeign: false,
        ticker: "434730"
      },
      {
        id: "stock_1780549564817_hade2",
        name: "KODEX TDF2050액티브적격",
        ticker: "434060",
        purchasePrice: 18421,
        quantity: 644,
        currentPrice: 18135,
        category: "국내주식",
        isForeign: false
      },
      {
        id: "stock_1780625314702_bza54",
        name: "Tiger 미국S&P500",
        ticker: "360750",
        purchasePrice: 28401,
        quantity: 301,
        currentPrice: 27915,
        category: "국내주식",
        isForeign: false
      },
      {
        id: "stock_1780646401179_3fd8y",
        name: "Tiger 미국나스닥100",
        ticker: "133690",
        purchasePrice: 200480,
        quantity: 31,
        currentPrice: 197695,
        category: "국내주식",
        isForeign: false
      }
    ]
  },
  {
    id: "nh_pension",
    name: "농협 연금",
    cash: 0,
    stocks: [
      {
        id: "np1",
        name: "KODEX은선물",
        purchasePrice: 13743,
        quantity: 820,
        currentPrice: 11085,
        category: "금은",
        isForeign: false,
        ticker: "144600"
      }
    ]
  },
  {
    id: "acc_1780302406742_hpk9",
    name: "신한투자",
    stocks: [
      {
        id: "stock_1780537642184_m4z1v",
        name: "삼성전자",
        purchasePrice: 330224,
        quantity: 38,
        currentPrice: 310000,
        category: "국내주식",
        isForeign: false,
        ticker: "005930"
      },
      {
        id: "stock_1780537703351_sl0a6",
        name: "SK하이닉스",
        purchasePrice: 2107000,
        quantity: 9,
        currentPrice: 2045000,
        category: "국내주식",
        isForeign: false,
        ticker: "000660"
      },
      {
        id: "stock_1780537787985_leyxu",
        name: "삼성전자우",
        purchasePrice: 211098,
        quantity: 61,
        currentPrice: 206000,
        category: "국내주식",
        isForeign: false,
        ticker: "005935"
      }
    ],
    cash: 13522673
  }
];

export const DEFAULT_REBALANCING_TARGETS: RebalancingTarget[] = [
  { name: "동아쏘시오홀딩스", targetWeight: 0 },
  { name: "엔비디아", targetWeight: 6.3 },
  { name: "삼성전자", targetWeight: 5 },
  { name: "하이닉스", targetWeight: 7 },
  { name: "리노공업", targetWeight: 1.1 },
  { name: "HPSP", targetWeight: 1.4 },
  { name: "한화오션", targetWeight: 2 },
  { name: "HD현대일렉트릭", targetWeight: 3 },
  { name: "두산에너빌리티", targetWeight: 3 },
  { name: "DB손해보험", targetWeight: 3.2 },
  { name: "리가켐", targetWeight: 1.4 },
  { name: "에스티팜", targetWeight: 2.4 },
  { name: "Tiger 반도체TOP10", targetWeight: 7 },
  { name: "Tiger 머니마켓액티브", targetWeight: 15.4 },
  { name: "Tiger 미국초단기국채", targetWeight: 0 },
  { name: "ACE KRX금현물", targetWeight: 7.1 },
  { name: "KODEX은선물", targetWeight: 4.5 },
  { name: "1Q은액티브", targetWeight: 0 },
  { name: "Tiger KRX금현물", targetWeight: 0 },
  { name: "현금", targetWeight: 23.5 },
  { name: "KODEX TDF2050", targetWeight: 5.2 },
  { name: "Tiger 필라델피아반도체", targetWeight: 10 },
  { name: "Tiger S&P500", targetWeight: 10 },
  { name: "Tiger 나스닥100", targetWeight: 10 },
  { name: "KODEX 코스피 200 TR", targetWeight: 10 },
  { name: "달러", targetWeight: 0 },
  { name: "KODEX 코스닥150", targetWeight: 0 },
  { name: "LG전자", targetWeight: 0 },
  { name: "리가켐바이오", targetWeight: 0 },
  { name: "SK하이닉스", targetWeight: 0 },
  { name: "삼성전자우", targetWeight: 0 },
  { name: "HANARO 원자력iSelect", targetWeight: 0 },
  { name: "KODEX TDF2050액티브적격", targetWeight: 0 }
];
