import React, { useState } from 'react';
import { Account, StockItem, AssetCategory } from '../types';
import { 
  Database, 
  Search, 
  ArrowUpDown, 
  Layers, 
  Briefcase, 
  TrendingUp, 
  TrendingDown, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink 
} from 'lucide-react';

interface StockConsolidationSectionProps {
  accounts: Account[];
  exchangeRate: number;
  onUpdateStockPriceGlobally: (ticker: string, name: string, newPrice: number) => void;
}

interface ConsolidatedStock {
  key: string; // Ticker (or Name if ticker is absent)
  name: string;
  ticker: string;
  category: AssetCategory;
  isForeign: boolean;
  totalQuantity: number;
  weightedAvgPurchasePriceNative: number;
  weightedAvgCurrentPriceNative: number;
  totalPurchaseAmountKRW: number;
  totalValuationAmountKRW: number;
  totalProfitLossKRW: number;
  returnRate: number;
  portfolioWeight: number; // weight against overall total portfolio
  holdingsByAccount: Array<{
    accountId: string;
    accountName: string;
    quantity: number;
    purchasePriceNative: number;
    currentPriceNative: number;
    valuationKRW: number;
  }>;
}

type SortField = 'weight' | 'valuation' | 'returnRate' | 'profitLoss' | 'name' | 'quantity';
type SortOrder = 'asc' | 'desc';

export default function StockConsolidationSection({ accounts, exchangeRate, onUpdateStockPriceGlobally }: StockConsolidationSectionProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [accountGroupFilter, setAccountGroupFilter] = useState<'all' | 'regular' | 'pension'>('all');
  const [sortField, setSortField] = useState<SortField>('weight');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [expandedStockKey, setExpandedStockKey] = useState<string | null>(null);
  const [editingPriceKey, setEditingPriceKey] = useState<string | null>(null);
  const [editingPriceVal, setEditingPriceVal] = useState<string>('');
  const [isCashExpanded, setIsCashExpanded] = useState(false);

  const startEditing = (key: string, currentVal: number) => {
    setEditingPriceKey(key);
    setEditingPriceVal(currentVal.toString());
  };

  const savePriceChange = (ticker: string, name: string) => {
    const rawVal = parseFloat(editingPriceVal);
    if (!isNaN(rawVal) && rawVal >= 0) {
      onUpdateStockPriceGlobally(ticker, name, rawVal);
    }
    setEditingPriceKey(null);
  };

  // Filter accounts by group: general stock accounts vs pension
  const filteredAccounts = accounts.filter((acc) => {
    const isPension = /(IRP|연금|retirement|pension)/i.test(acc.name);
    if (accountGroupFilter === 'regular') return !isPension;
    if (accountGroupFilter === 'pension') return isPension;
    return true; // 'all'
  });

  // 1. Calculate overall portfolio total value (including stocks AND cash of all accounts)
  let overallPortfolioTotalValuation = 0;
  filteredAccounts.forEach((acc) => {
    overallPortfolioTotalValuation += acc.cash;
    acc.stocks.forEach((s) => {
      const rate = s.isForeign ? exchangeRate : 1;
      overallPortfolioTotalValuation += s.currentPrice * s.quantity * rate;
    });
  });

  // 2. Consolidate stocks by stock code/ticker (or name if no ticker/code is specified)
  const stockMap: Record<string, ConsolidatedStock> = {};

  filteredAccounts.forEach((acc) => {
    acc.stocks.forEach((s) => {
      const tickerClean = (s.ticker || '').trim();
      const nameClean = s.name.trim();
      
      // We will group primarily by ticker/code if provided, else name
      const key = tickerClean ? tickerClean.toUpperCase() : nameClean.toUpperCase();
      const rate = s.isForeign ? exchangeRate : 1;
      const purchaseAmountKRW = s.purchasePrice * s.quantity * rate;
      const valuationAmountKRW = s.currentPrice * s.quantity * rate;

      if (!stockMap[key]) {
        stockMap[key] = {
          key,
          name: nameClean,
          ticker: tickerClean || '코드없음',
          category: s.category,
          isForeign: s.isForeign,
          totalQuantity: 0,
          weightedAvgPurchasePriceNative: 0,
          weightedAvgCurrentPriceNative: 0,
          totalPurchaseAmountKRW: 0,
          totalValuationAmountKRW: 0,
          totalProfitLossKRW: 0,
          returnRate: 0,
          portfolioWeight: 0,
          holdingsByAccount: []
        };
      }

      const cs = stockMap[key];

      // Update name if we find one with actual ticker match or to be consistent
      if (s.name && !cs.name) {
        cs.name = s.name;
      }

      cs.totalQuantity += s.quantity;
      cs.totalPurchaseAmountKRW += purchaseAmountKRW;
      cs.totalValuationAmountKRW += valuationAmountKRW;
      
      cs.holdingsByAccount.push({
        accountId: acc.id,
        accountName: acc.name,
        quantity: s.quantity,
        purchasePriceNative: s.purchasePrice,
        currentPriceNative: s.currentPrice,
        valuationKRW: valuationAmountKRW
      });
    });
  });

  // Calculate averages & rates for the consolidated stocks
  const consolidatedList = Object.values(stockMap).map((cs) => {
    // Collect weighted native prices
    let totalPurchNativeWeight = 0;
    let totalCurrNativeWeight = 0;

    cs.holdingsByAccount.forEach((h) => {
      totalPurchNativeWeight += h.purchasePriceNative * h.quantity;
      totalCurrNativeWeight += h.currentPriceNative * h.quantity;
    });

    cs.weightedAvgPurchasePriceNative = cs.totalQuantity > 0 ? (totalPurchNativeWeight / cs.totalQuantity) : 0;
    cs.weightedAvgCurrentPriceNative = cs.totalQuantity > 0 ? (totalCurrNativeWeight / cs.totalQuantity) : 0;
    
    cs.totalProfitLossKRW = cs.totalValuationAmountKRW - cs.totalPurchaseAmountKRW;
    cs.returnRate = cs.totalPurchaseAmountKRW > 0 ? (cs.totalProfitLossKRW / cs.totalPurchaseAmountKRW) * 100 : 0;
    cs.portfolioWeight = overallPortfolioTotalValuation > 0 ? (cs.totalValuationAmountKRW / overallPortfolioTotalValuation) * 100 : 0;

    return cs;
  });

  // 3. Filtering
  const filteredList = consolidatedList.filter((cs) => {
    const sTerm = searchTerm.toLowerCase().trim();
    const matchesSearch = 
      cs.name.toLowerCase().includes(sTerm) || 
      cs.ticker.toLowerCase().includes(sTerm) ||
      (cs.isForeign ? 'foreign overseas 해외' : 'domestic 코스피 코스닥 국내').includes(sTerm);

    const matchesCategory = selectedCategory === 'All' || 
      cs.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // 4. Sorting
  const sortedList = [...filteredList].sort((a, b) => {
    let result = 0;
    if (sortField === 'weight') {
      result = a.portfolioWeight - b.portfolioWeight;
    } else if (sortField === 'valuation') {
      result = a.totalValuationAmountKRW - b.totalValuationAmountKRW;
    } else if (sortField === 'returnRate') {
      result = a.returnRate - b.returnRate;
    } else if (sortField === 'profitLoss') {
      result = a.totalProfitLossKRW - b.totalProfitLossKRW;
    } else if (sortField === 'name') {
      result = a.name.localeCompare(b.name);
    } else if (sortField === 'quantity') {
      result = a.totalQuantity - b.totalQuantity;
    }

    return sortOrder === 'desc' ? -result : result;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc'); // Default to descending
    }
  };

  // Distinct Categories for badges
  const categoriesList = ['All', '국내주식', '해외주식', '단기채', '금은', '현금'];

  // Cash computations
  const totalCashKRW = filteredAccounts.reduce((sum, acc) => sum + (acc.cash || 0), 0);
  const cashPortfolioWeight = overallPortfolioTotalValuation > 0 ? (totalCashKRW / overallPortfolioTotalValuation) * 100 : 0;

  const shouldShowCash = (selectedCategory === 'All' || selectedCategory === '현금') && 
    (!searchTerm || '현금 cash'.includes(searchTerm.toLowerCase().trim()));

  // Filtered KPIs for Consolidator (including raw account cash when '현금' filter is chosen)
  const isCashFilter = selectedCategory === '현금';
  const totalStockPurchase = filteredList.reduce((acc, curr) => acc + curr.totalPurchaseAmountKRW, 0) + (isCashFilter && shouldShowCash ? totalCashKRW : 0);
  const totalStockValuation = filteredList.reduce((acc, curr) => acc + curr.totalValuationAmountKRW, 0) + (isCashFilter && shouldShowCash ? totalCashKRW : 0);
  const totalStockProfitLoss = totalStockValuation - totalStockPurchase;
  const overallStockReturnRate = totalStockPurchase > 0 ? (totalStockProfitLoss / totalStockPurchase) * 100 : 0;

  const toggleExpand = (key: string) => {
    if (expandedStockKey === key) {
      setExpandedStockKey(null);
    } else {
      setExpandedStockKey(key);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6" id="stock-consolidation-section">
      {/* Header section */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 border-b border-slate-100 pb-5">
        <div className="space-y-1 max-w-xl">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600" />
            종목별 통합 투자 현황
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            토스, 메리츠, 한투 등 각 금융기관에 분산 등록된 개별 종목들을 단축코드 기준으로 완전히 합산해 추적하며, 금융기관 계좌 내 현금(예수금)은 하단에 합산 출력하고 투자 종합 평가에서는 제외하여 오롯이 투자 자산의 실적을 반영합니다.
          </p>
        </div>

        {/* Global Invested Stock Stats Redesigned HUD */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50/85 p-3.5 rounded-xl border border-slate-150/80 shrink-0 w-full xl:w-auto min-w-0 md:min-w-[700px]">
          {/* Item 1 */}
          <div className="bg-white p-2.5 rounded-lg border border-slate-100 flex flex-col justify-center shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <span className="text-[10px] text-slate-400 font-bold block mb-1">
              {selectedCategory !== 'All' || searchTerm ? '필터 합산 매입액' : '총 투자 원금(매입액)'}
            </span>
            <span className="font-mono font-bold text-slate-800 text-xs md:text-[13px] leading-tight">
              ₩{Math.round(totalStockPurchase).toLocaleString()}
            </span>
          </div>

          {/* Item 2 */}
          <div className="bg-white p-2.5 rounded-lg border border-slate-100 flex flex-col justify-center shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <span className="text-[10px] text-slate-400 font-bold block mb-1">
              {selectedCategory !== 'All' || searchTerm ? '필터 합산 평가액' : '실시간 투자 평가액'}
            </span>
            <span className="font-mono font-bold text-slate-900 text-xs md:text-[13px] leading-tight">
              ₩{Math.round(totalStockValuation).toLocaleString()}
            </span>
          </div>

          {/* Item 3 */}
          <div className="bg-white p-2.5 rounded-lg border border-slate-100 flex flex-col justify-center shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <span className="text-[10px] text-slate-400 font-bold block mb-1">
              {selectedCategory !== 'All' || searchTerm ? '필터 합산 평가손익' : '종합 투자 평가손익'}
            </span>
            <span className={`font-mono font-bold text-xs md:text-[13px] leading-tight ${
              totalStockProfitLoss >= 0 ? 'text-rose-600' : 'text-blue-600'
            }`}>
              {totalStockProfitLoss >= 0 ? '+' : ''}{Math.round(totalStockProfitLoss).toLocaleString()}원
            </span>
          </div>

          {/* Item 4 */}
          <div className="bg-white p-2.5 rounded-lg border border-indigo-100/50 flex flex-col justify-center shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <span className="text-[10px] text-indigo-500 font-bold block mb-1">
              {selectedCategory !== 'All' || searchTerm ? '필터 가중 수익률' : '가중 투자 수익률'}
            </span>
            <span className={`font-mono font-extrabold px-1.5 py-0.5 rounded text-[11px] self-start ${
              overallStockReturnRate >= 0 ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
            }`}>
              {overallStockReturnRate >= 0 ? '+' : ''}{overallStockReturnRate.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* 계좌 구분 전용 탭 필터 (일반 주식 계좌 vs 연금계좌) */}
      <div className="flex bg-slate-100/60 p-1.5 rounded-xl border border-slate-200 gap-1">
        <button
          type="button"
          onClick={() => setAccountGroupFilter('all')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg text-center transition-all cursor-pointer ${
            accountGroupFilter === 'all'
              ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/40'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          📁 전체 통합 현황 ({accounts.length}개 계좌)
        </button>
        <button
          type="button"
          onClick={() => setAccountGroupFilter('regular')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg text-center transition-all cursor-pointer ${
            accountGroupFilter === 'regular'
              ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/40'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          💳 일반 주식 계좌 ({accounts.filter(a => !/(IRP|연금|retirement|pension)/i.test(a.name)).length}개)
        </button>
        <button
          type="button"
          onClick={() => setAccountGroupFilter('pension')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg text-center transition-all cursor-pointer ${
            accountGroupFilter === 'pension'
              ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/40'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          👵 연금계좌 (IRP/연금) ({accounts.filter(a => /(IRP|연금|retirement|pension)/i.test(a.name)).length}개)
        </button>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-150">
        {/* Category Pill Buttons */}
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-xs font-semibold text-slate-500 mr-1 hidden md:block">필터:</span>
          {categoriesList.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all border outline-none ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat === 'All' ? '전체 종목' : cat}
            </button>
          ))}
        </div>

        {/* Searching input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="종목명, 단축코드 조회..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-md py-1 px-8 text-xs text-slate-800 outline-none transition-all placeholder:text-slate-400"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-[10px] bg-slate-100 hover:bg-slate-200 px-1 py-0.2 text-slate-500 rounded"
            >
              지우기
            </button>
          )}
        </div>
      </div>

      {/* Grid List Table */}
      {(sortedList.length === 0 && !shouldShowCash) ? (
        <div className="border border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400 text-xs">
          {searchTerm || selectedCategory !== 'All' 
            ? '검색이나 필터 결과와 부합하는 자산 종목이 존재하지 않습니다.'
            : '포트폴리오 내에 등록된 종목형 투자 자산이 없습니다. 상단 계좌별 편집기에서 추가해 보세요.'}
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
          {/* Table for Desktop layout */}
          <table className="w-full min-w-[1000px] text-left border-collapse" id="consolidated-stocks-table">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                <th className="py-3 px-4 w-12 text-center">순위</th>
                <th className="py-3 px-4">
                  <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-slate-700 transition-colors">
                    자산 종목명 (코드)
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </button>
                </th>
                <th className="py-3 px-3 w-28 text-center">구분</th>
                <th className="py-3 px-3">
                  <button onClick={() => handleSort('quantity')} className="flex items-center gap-1 hover:text-slate-700 transition-colors">
                    총 수량
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </button>
                </th>
                <th className="py-3 px-3 text-right">평균 매수가 (가중)</th>
                <th className="py-3 px-3 text-right">현재가 (종가)</th>
                <th className="py-3 px-3 text-right">총 매입금액 (원화)</th>
                <th className="py-3 px-3 text-right">
                  <button onClick={() => handleSort('valuation')} className="flex items-center gap-1 hover:text-slate-700 transition-colors justify-end w-full">
                    평가금액 (원화)
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </button>
                </th>
                <th className="py-3 px-3 text-right">
                  <button onClick={() => handleSort('profitLoss')} className="flex items-center gap-1 hover:text-slate-700 transition-colors justify-end w-full">
                    평가손익 (원화)
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </button>
                </th>
                <th className="py-3 px-3 text-center">
                  <button onClick={() => handleSort('returnRate')} className="flex items-center gap-1 hover:text-slate-700 transition-colors justify-center w-full">
                    수익률
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </button>
                </th>
                <th className="py-3 px-4 text-center">
                  <button onClick={() => handleSort('weight')} className="flex items-center gap-1 hover:text-slate-700 transition-colors justify-center w-full">
                    포트폴리오 비중
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </button>
                </th>
                <th className="py-3 px-4 w-16 text-center">상세</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 text-xs text-slate-700">
              {sortedList.map((cs, idx) => {
                const profitColor = cs.totalProfitLossKRW > 0 
                  ? 'text-rose-600 font-semibold' 
                  : cs.totalProfitLossKRW < 0 
                    ? 'text-blue-600 font-semibold' 
                    : 'text-slate-500';
                
                const returnBadgeClass = cs.returnRate > 0 
                  ? 'bg-rose-50 text-rose-600 border-rose-100' 
                  : cs.returnRate < 0 
                    ? 'bg-blue-50 text-blue-600 border-blue-100' 
                    : 'bg-slate-50 text-slate-500 border-slate-100';

                // Assign category tags/styles
                let categoryColorClass = "bg-slate-50 text-slate-600 border-slate-200";
                if (cs.category === '국내주식') categoryColorClass = "bg-sky-50 text-sky-700 border-sky-100";
                else if (cs.category === '해외주식') categoryColorClass = "bg-violet-50 text-violet-700 border-violet-100";
                else if (cs.category === '단기채') categoryColorClass = "bg-amber-50 text-amber-700 border-amber-100";
                else if (cs.category === '금은') categoryColorClass = "bg-orange-50 text-orange-700 border-orange-100";
                else if (cs.category === '현금') categoryColorClass = "bg-teal-50 text-teal-700 border-teal-100";

                const isExpanded = expandedStockKey === cs.key;

                return (
                  <React.Fragment key={cs.key}>
                    <tr 
                      className={`hover:bg-slate-50/60 transition-colors cursor-pointer ${
                        isExpanded ? 'bg-indigo-50/15' : ''
                      }`}
                      onClick={() => toggleExpand(cs.key)}
                      id={`consolidated-row-${cs.key}`}
                    >
                      {/* Rank */}
                      <td className="py-3.5 px-4 text-center font-bold text-slate-400 font-mono">
                        {idx + 1}
                      </td>

                      {/* Stock Name / Ticker */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800 text-xs max-w-[200px] truncate" title={cs.name}>
                            {cs.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold font-mono tracking-wider mt-0.5 flex items-center gap-1">
                            {cs.isForeign ? (
                              <span className="px-1 py-0.1 bg-indigo-50 text-indigo-500 text-[8px] font-extrabold rounded">US</span>
                            ) : (
                              <span className="px-1 py-0.1 bg-sky-50 text-sky-500 text-[8px] font-extrabold rounded">KR</span>
                            )}
                            {cs.ticker}
                          </span>
                        </div>
                      </td>

                      {/* Category Badge */}
                      <td className="py-3.5 px-3 text-center">
                        <span className={`inline-block border rounded px-2 py-0.5 text-[10px] font-bold ${categoryColorClass}`}>
                          {cs.category}
                        </span>
                      </td>

                      {/* Total quantity */}
                      <td className="py-3.5 px-3 font-mono font-medium">
                        {cs.totalQuantity.toLocaleString(undefined, { maximumFractionDigits: 5 })}개
                      </td>

                      {/* Weighted Purchase price */}
                      <td className="py-3.5 px-3 text-right font-mono font-medium">
                        {cs.isForeign ? 'US$' : '₩'}
                        {cs.weightedAvgPurchasePriceNative.toLocaleString(undefined, {
                          minimumFractionDigits: cs.isForeign ? 2 : 0,
                          maximumFractionDigits: cs.isForeign ? 2 : 0
                        })}
                      </td>

                      {/* Weighted Current price (Editable) */}
                      <td 
                        className="py-3.5 px-3 text-right font-mono font-medium group relative cursor-pointer"
                        title="클릭하여 현재가 실시간 수정"
                        onClick={(e) => {
                          e.stopPropagation(); // Avoid expanding the table row
                          startEditing(cs.key, cs.weightedAvgCurrentPriceNative);
                        }}
                      >
                        {editingPriceKey === cs.key ? (
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <span className="text-slate-400 text-xs font-semibold mr-0.5">{cs.isForeign ? 'US$' : '₩'}</span>
                            <input
                              type="number"
                              value={editingPriceVal}
                              onChange={(e) => setEditingPriceVal(e.target.value)}
                              onBlur={() => savePriceChange(cs.ticker, cs.name)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  savePriceChange(cs.ticker, cs.name);
                                } else if (e.key === 'Escape') {
                                  setEditingPriceKey(null);
                                }
                              }}
                              className="w-24 px-1.5 py-0.5 text-xs text-right border border-indigo-500 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono font-extrabold text-slate-800 bg-indigo-50/20"
                              autoFocus
                            />
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1 hover:text-indigo-600 transition-colors">
                            <span>
                              {cs.isForeign ? 'US$' : '₩'}
                              {cs.weightedAvgCurrentPriceNative.toLocaleString(undefined, {
                                minimumFractionDigits: cs.isForeign ? 2 : 0,
                                maximumFractionDigits: cs.isForeign ? 2 : 0
                              })}
                            </span>
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 text-slate-400 hover:text-indigo-600">
                              <svg xmlns="http://www.w3.org/2500/svg" className="h-3.5 w-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Sum Purchase KRW */}
                      <td className="py-3.5 px-3 text-right font-mono text-slate-600">
                        ₩{Math.round(cs.totalPurchaseAmountKRW).toLocaleString()}
                      </td>

                      {/* Sum Valuation KRW */}
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-800">
                        ₩{Math.round(cs.totalValuationAmountKRW).toLocaleString()}
                      </td>

                      {/* Profit/Loss KRW */}
                      <td className={`py-3.5 px-3 text-right font-mono ${profitColor}`}>
                        {cs.totalProfitLossKRW > 0 ? '+' : ''}
                        {Math.round(cs.totalProfitLossKRW).toLocaleString()}
                      </td>

                      {/* Return rate */}
                      <td className="py-3.5 px-3 text-center">
                        <span className={`inline-block border px-2 py-0.5 rounded-full text-[11px] font-mono font-bold ${returnBadgeClass}`}>
                          {cs.returnRate > 0 ? '+' : ''}{cs.returnRate.toFixed(2)}%
                        </span>
                      </td>

                      {/* Weight Progress Bar */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col items-center gap-1 w-full min-w-[70px]">
                          <span className="font-mono font-bold text-slate-800 text-[11px]">
                            {cs.portfolioWeight.toFixed(2)}%
                          </span>
                          <div className="w-full bg-slate-100 rounded-full h-1">
                            <div 
                              className="bg-indigo-600 h-1 rounded-full"
                              style={{ width: `${Math.min(100, cs.portfolioWeight)}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>

                      {/* Expand Button */}
                      <td className="py-3.5 px-4 text-center">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(cs.key);
                          }}
                          className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Detail Component (Detailed accounts holdings) */}
                    {isExpanded && (
                      <tr className="bg-slate-50/40" id={`expanded-detail-${cs.key}`}>
                        <td colSpan={12} className="py-3 px-8">
                          <div className="bg-white rounded-xl border border-indigo-100/40 p-4 shadow-sm space-y-3.5 max-w-4xl animate-slide-in">
                            <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs border-b border-indigo-50/70 pb-2">
                              <Layers className="w-3.5 h-3.5 text-indigo-600" />
                              <span>계좌 구분별 통합 보유 현황 ({cs.holdingsByAccount.length}개 금융기관 계좌)</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Account holdings breakdown table */}
                              <div className="overflow-hidden border border-slate-150 rounded-lg bg-white">
                                <table className="w-full text-left text-[11px]">
                                  <thead>
                                    <tr className="bg-indigo-50/30 text-slate-500 font-bold border-b border-indigo-100/30">
                                      <th className="py-2 px-3">금융기관 계좌</th>
                                      <th className="py-2 px-3 text-right">보유 수량</th>
                                      <th className="py-2 px-3 text-right">평균 매입단가</th>
                                      <th className="py-2 px-3 text-right">평가금액 (원화)</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 font-mono text-slate-600">
                                    {cs.holdingsByAccount.map((hold) => (
                                      <tr key={hold.accountId} className="hover:bg-slate-50/60 transition-all">
                                        <td className="py-2.5 px-3 font-sans font-semibold text-slate-800 flex items-center gap-1">
                                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                          {hold.accountName}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                                          {hold.quantity.toLocaleString(undefined, { maximumFractionDigits: 5 })}개
                                        </td>
                                        <td className="py-2.5 px-3 text-right">
                                          {cs.isForeign ? 'US$' : '₩'}
                                          {hold.purchasePriceNative.toLocaleString(undefined, {
                                            minimumFractionDigits: cs.isForeign ? 2 : 0,
                                            maximumFractionDigits: cs.isForeign ? 2 : 0
                                          })}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-semibold text-slate-800">
                                          ₩{Math.round(hold.valuationKRW).toLocaleString()}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>

                              {/* Asset characteristics / details */}
                              <div className="bg-slate-50/60 p-3.5 border border-slate-150 rounded-lg flex flex-col justify-between space-y-3">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px]">
                                    <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>자산 종목 세부정보</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px] text-slate-600">
                                    <div>
                                      <span className="text-slate-400 block">자산 마켓 유형</span>
                                      <span className="font-semibold text-slate-800">{cs.isForeign ? "미국/해외 금융 시장 (USD)" : "한국 거래소 상장 (KRW)"}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 block">국내외 구분</span>
                                      <span className="font-semibold text-slate-800">{cs.isForeign ? "해외자산" : "국내자산"}</span>
                                    </div>
                                    <div>
                                      <span className="text-slate-400 block">단축코드(티커)</span>
                                      <span className="font-mono font-bold text-indigo-600 bg-indigo-50/50 px-1 border border-indigo-100 rounded inline-block">{cs.ticker}</span>
                                    </div>
                                                                    <div>
                                      <span className="text-slate-400 block">계좌 포트폴리오 기여</span>
                                      <span className="font-semibold text-slate-800">전체 자산의 {cs.portfolioWeight.toFixed(2)}% 차지</span>
                                    </div>
                                  </div>

                                  {/* Direct price modification right inside details */}
                                  <div className="pt-2.5 border-t border-slate-200 mt-2.5 flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-slate-700">개별 종목 현재가 일괄 수정:</span>
                                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                      <span className="font-mono text-slate-500 text-[11px]">{cs.isForeign ? 'US$' : '₩'}</span>
                                      <input
                                        type="number"
                                        id={`detail-price-input-${cs.key}`}
                                        value={editingPriceKey === cs.key ? editingPriceVal : cs.weightedAvgCurrentPriceNative}
                                        onFocus={() => {
                                          setEditingPriceKey(cs.key);
                                          setEditingPriceVal(cs.weightedAvgCurrentPriceNative.toString());
                                        }}
                                        onChange={(e) => {
                                          setEditingPriceKey(cs.key);
                                          setEditingPriceVal(e.target.value);
                                        }}
                                        onBlur={() => savePriceChange(cs.ticker, cs.name)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            savePriceChange(cs.ticker, cs.name);
                                          }
                                        }}
                                        className="w-24 px-1.5 py-0.5 border border-slate-300 rounded font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-xs text-right bg-white"
                                      />
                                      <button
                                        type="button"
                                        onMouseDown={(e) => {
                                          // Prevent input element blur action from discarding state before clicking save
                                          e.preventDefault();
                                        }}
                                        onClick={() => savePriceChange(cs.ticker, cs.name)}
                                        className="bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-[10px] px-2 py-0.5 rounded cursor-pointer transition-colors"
                                      >
                                        적용
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                <div className="bg-indigo-50/45 p-2 rounded-lg border border-indigo-100/30 flex items-center justify-between text-[11px] text-indigo-950 font-medium">
                                  <span className="flex items-center gap-1 shrink-0">
                                    {cs.totalProfitLossKRW >= 0 ? (
                                      <TrendingUp className="w-3.5 h-3.5 text-rose-500" />
                                    ) : (
                                      <TrendingDown className="w-3.5 h-3.5 text-blue-500" />
                                    )}
                                    <span>현재가 평가 수익 상태:</span>
                                  </span>
                                  <span className={`font-mono font-extrabold ${cs.totalProfitLossKRW >= 0 ? 'text-rose-600' : 'text-blue-600'}`}>
                                    {cs.returnRate > 0 ? '+' : ''}{cs.returnRate.toFixed(2)}% ({cs.totalProfitLossKRW >= 0 ? '수익중' : '손실 구간'})
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {/* 현금 (예수금 자산) 통합 출력 행 */}
              {shouldShowCash && (
                <React.Fragment>
                  <tr 
                    className={`hover:bg-slate-50/60 transition-colors cursor-pointer border-t-2 border-slate-200 bg-slate-50/30 ${
                      isCashExpanded ? 'bg-indigo-50/15' : ''
                    }`}
                    onClick={() => setIsCashExpanded(!isCashExpanded)}
                    id="consolidated-row-cash"
                  >
                    {/* Rank */}
                    <td className="py-3.5 px-4 text-center font-bold text-slate-400 font-mono">
                      -
                    </td>

                    {/* Asset Name / Code */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-indigo-700 text-xs">
                          총 현금 (예수금 자산)
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold font-mono tracking-wider mt-0.5 flex items-center gap-1">
                          <span className="px-1 py-0.1 bg-slate-100 text-slate-500 text-[8px] font-extrabold rounded">CASH</span>
                          보유 잔액 총합 (원화 기준)
                        </span>
                      </div>
                    </td>

                    {/* Category Badge */}
                    <td className="py-3.5 px-3 text-center">
                      <span className="inline-block border rounded px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 border-slate-200">
                        현금
                      </span>
                    </td>

                    {/* Total quantity */}
                    <td className="py-3.5 px-3 font-mono font-medium text-slate-400">
                      -
                    </td>

                    {/* Weighted Purchase price */}
                    <td className="py-3.5 px-3 text-right font-mono font-medium text-slate-400">
                      -
                    </td>

                    {/* Weighted Current price */}
                    <td className="py-3.5 px-3 text-right font-mono font-medium text-slate-400">
                      -
                    </td>

                    {/* Sum Purchase KRW */}
                    <td className="py-3.5 px-3 text-right font-mono text-slate-600">
                      ₩{Math.round(totalCashKRW).toLocaleString()}
                    </td>

                    {/* Sum Valuation KRW */}
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-800">
                      ₩{Math.round(totalCashKRW).toLocaleString()}
                    </td>

                    {/* Profit/Loss KRW */}
                    <td className="py-3.5 px-3 text-right font-mono text-slate-400">
                      ₩0
                    </td>

                    {/* Return rate */}
                    <td className="py-3.5 px-3 text-center">
                      <span className="inline-block border px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-slate-50 text-slate-450 border-slate-100">
                        0.00%
                      </span>
                    </td>

                    {/* Weight Progress Bar */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col items-center gap-1 w-full min-w-[70px]">
                        <span className="font-mono font-bold text-slate-800 text-[11px]">
                          {cashPortfolioWeight.toFixed(2)}%
                        </span>
                        <div className="w-full bg-slate-100 rounded-full h-1">
                          <div 
                            className="bg-slate-400 h-1 rounded-full"
                            style={{ width: `${Math.min(100, cashPortfolioWeight)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>

                    {/* Expand Button */}
                    <td className="py-3.5 px-4 text-center">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsCashExpanded(!isCashExpanded);
                        }}
                        className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {isCashExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>

                  {/* 현금 상세 아코디언 드롭다운 */}
                  {isCashExpanded && (
                    <tr className="bg-slate-50/40" id="expanded-cash-detail">
                      <td colSpan={12} className="py-3 px-8">
                        <div className="bg-white rounded-xl border border-indigo-100/40 p-4 shadow-sm space-y-3.5 max-w-4xl animate-slide-in">
                          <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs border-b border-indigo-50/70 pb-2">
                            <Layers className="w-3.5 h-3.5 text-indigo-600" />
                            <span>계좌 구분별 원화 현금 보유 현황 ({filteredAccounts.filter(a => a.cash > 0).length}개 금융기관 계좌)</span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Account holdings breakdown table */}
                            <div className="overflow-hidden border border-slate-150 rounded-lg bg-white">
                              <table className="w-full text-left text-[11px]">
                                <thead>
                                  <tr className="bg-indigo-50/30 text-slate-500 font-bold border-b border-indigo-100/30">
                                    <th className="py-2 px-3">금융기관 계좌</th>
                                    <th className="py-2 px-3 text-right">현금 잔액 (원화)</th>
                                    <th className="py-2 px-3 text-right">계좌 내 현금 비중</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-mono text-slate-600">
                                  {filteredAccounts.map((accItem) => {
                                    if (accItem.cash <= 0) return null;
                                    
                                    // Calculate weight of cash inside this specific account
                                    const accStocksValuation = accItem.stocks.reduce((sum, s) => {
                                      const rate = s.isForeign ? exchangeRate : 1;
                                      return sum + s.currentPrice * s.quantity * rate;
                                    }, 0);
                                    const totalAccValue = accItem.cash + accStocksValuation;
                                    const cashInAccountWeight = totalAccValue > 0 ? (accItem.cash / totalAccValue) * 100 : 0;

                                    return (
                                      <tr key={accItem.id} className="hover:bg-slate-50/60 transition-all">
                                        <td className="py-2.5 px-3 font-sans font-semibold text-slate-800 flex items-center gap-1">
                                          <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                                          {accItem.name}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                                          ₩{Math.round(accItem.cash).toLocaleString()}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-medium text-slate-500">
                                          {cashInAccountWeight.toFixed(1)}%
                                        </td>
                                      </tr>
                                    );
                                  })}
                                  {filteredAccounts.filter(a => a.cash > 0).length === 0 && (
                                    <tr>
                                      <td colSpan={3} className="py-4 text-center text-slate-400">
                                        현금 잔액이 대기 중인 계좌가 없습니다.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>

                            {/* Asset characteristics / details */}
                            <div className="bg-slate-50/50 p-3.5 border border-slate-150 rounded-lg flex flex-col justify-between space-y-3">
                              <div className="space-y-2">
                                <div className="flex items-center gap-1.5 font-bold text-slate-800 text-[11px]">
                                  <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                                  <span>현금 자산 성격 및 가이드</span>
                                </div>
                                <p className="text-[11px] text-slate-500 leading-relaxed">
                                  현금은 금융투자 상품을 매입하지 않은 순수 가용 현금이며 리밸런싱 및 시장 급변 시 즉각 대응할 수 있는 가장 유동적인 리스크 오프(Risk-Off) 성격의 원자산입니다.
                                </p>
                                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px] text-slate-600 pt-1 border-t border-slate-200/60 mt-1">
                                  <div>
                                    <span className="text-slate-400 block">원화 현금 총합</span>
                                    <span className="font-bold text-indigo-700">₩{Math.round(totalCashKRW).toLocaleString()}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block">전체 포트 수식 기여</span>
                                    <span className="font-semibold text-slate-800">전체 자산의 {cashPortfolioWeight.toFixed(2)}% 차지</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
