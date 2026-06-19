import React, { useState } from 'react';
import { Account, StockItem, AssetCategory } from '../types';
import { KNOWN_STOCKS, USD_EXCHANGE_RATE } from '../initialData';
import { Trash2, Plus, Info, Check, HelpCircle, CornerDownRight, RefreshCw } from 'lucide-react';

interface AccountTableProps {
  key?: string;
  account: Account;
  accounts: Account[];
  onUpdateAccount: (updatedAccount: Account) => void;
  exchangeRate: number;
  onDeleteAccount?: (id: string) => void;
  selectedDate?: string;
  historicalDayData?: any;
}

export default function AccountTable({
  account,
  accounts,
  onUpdateAccount,
  exchangeRate,
  onDeleteAccount,
  selectedDate = 'live',
  historicalDayData
}: AccountTableProps) {

  const getHistoricalItemValuation = (stock?: StockItem, isCash?: boolean): number => {
    if (selectedDate === 'live' || !historicalDayData) {
      if (isCash) {
        return account.cash;
      }
      if (stock) {
        return stock.isForeign
          ? stock.currentPrice * stock.quantity * exchangeRate
          : stock.currentPrice * stock.quantity;
      }
      return 0;
    }

    let segName = account.name;
    if (account.id === 'toss') {
      if (stock && stock.category === '해외주식') {
        segName = '토스 해외';
      } else {
        segName = '토스 국내';
      }
    }

    const itemName = isCash ? '예수금(현금)' : (stock ? stock.name : '');
    const storedItemKey = `${segName}_${itemName}`;

    if (historicalDayData[storedItemKey] !== undefined) {
      return historicalDayData[storedItemKey];
    }

    if (isCash) {
      const liveCashVal = account.cash;
      const liveTotal = getLiveSegmentTotal(segName);
      const histTotal = historicalDayData[segName] || 0;
      if (liveTotal > 0 && histTotal > 0) {
        return liveCashVal * (histTotal / liveTotal);
      }
      return 0;
    }

    if (stock) {
      const liveItemVal = stock.isForeign
        ? stock.currentPrice * stock.quantity * exchangeRate
        : stock.currentPrice * stock.quantity;
      const liveTotal = getLiveSegmentTotal(segName);
      const histTotal = historicalDayData[segName] || 0;
      if (liveTotal > 0 && histTotal > 0) {
        return liveItemVal * (histTotal / liveTotal);
      }
    }

    return 0;
  };

  const getLiveSegmentTotal = (segName: string) => {
    let cash = 0;
    let stocks: StockItem[] = [];
    if (segName === '토스 국내') {
      const toss = accounts.find(a => a.id === 'toss');
      if (toss) {
        cash = toss.cash;
        stocks = toss.stocks.filter(s => s.category !== '해외주식');
      }
    } else if (segName === '토스 해외') {
      const toss = accounts.find(a => a.id === 'toss');
      if (toss) {
        cash = 0;
        stocks = toss.stocks.filter(s => s.category === '해외주식');
      }
    } else {
      const acc = accounts.find(a => a.name === segName);
      if (acc) {
        cash = acc.cash;
        stocks = acc.stocks;
      }
    }

    const stocksVal = stocks.reduce((sum, s) => {
      const val = s.isForeign ? s.currentPrice * s.quantity * exchangeRate : s.currentPrice * s.quantity;
      return sum + val;
    }, 0);

    return stocksVal + cash;
  };


  // Local state for adding a new stock line
  const [newStock, setNewStock] = useState<{
    name: string;
    ticker: string;
    purchasePrice: string;
    quantity: string;
    currentPrice: string;
    category: AssetCategory;
    isForeign: boolean;
  }>({
    name: '',
    ticker: '',
    purchasePrice: '',
    quantity: '',
    currentPrice: '',
    category: '국내주식',
    isForeign: false,
  });

  // Highlight rows that are edited or newly added
  const handleStockChange = (stockId: string, field: keyof StockItem, value: any) => {
    const updatedStocks = account.stocks.map((stock) => {
      if (stock.id === stockId) {
        let updatedRow = { ...stock, [field]: value };
        if (field === 'purchasePrice' || field === 'quantity' || field === 'currentPrice') {
          let numVal = Number(value);
          if (isNaN(numVal)) numVal = 0;
          updatedRow[field] = numVal;
        }

        // 만약 기존 주식 종목 이름이 바뀌었을 때, 등록된 종목 가이드 데이터베이스에 고시된 항목이 있다면 자동 치환/입력합니다.
        if (field === 'name') {
          const trimmed = value.trim();
          const known = KNOWN_STOCKS[trimmed];
          if (known) {
            updatedRow.category = known.category;
            updatedRow.currentPrice = known.price;
            updatedRow.isForeign = known.isForeign;
          }
        }
        return updatedRow;
      }
      return stock;
    });
    onUpdateAccount({ ...account, stocks: updatedStocks });
  };

  // 현재 계좌의 모든 연동 종목 현재가를 사전 등록된 종가 데이터베이스 값과 자동 맞충동기화합니다.
  const handleSyncWithClosingPrices = () => {
    let updatedCount = 0;
    const updatedStocks = account.stocks.map((stock) => {
      const known = KNOWN_STOCKS[stock.name.trim()];
      if (known) {
        if (stock.currentPrice !== known.price || stock.category !== known.category || stock.isForeign !== known.isForeign) {
          updatedCount++;
          return {
            ...stock,
            currentPrice: known.price,
            category: known.category,
            isForeign: known.isForeign,
          };
        }
      }
      return stock;
    });

    if (updatedCount === 0) {
      alert('이 계좌의 모든 입력된 연동 종목이 이미 최신 고시 종가와 일치합니다.');
      return;
    }

    onUpdateAccount({ ...account, stocks: updatedStocks });
    alert(`성공: 총 ${updatedCount}개 종목의 현재가를 사전 등록된 종가 정보로 자동 업데이트 하였습니다.`);
  };

  const handleCashChange = (value: string) => {
    let cleanVal = Number(value.replace(/[^0-9.-]/g, ''));
    if (isNaN(cleanVal)) cleanVal = 0;
    onUpdateAccount({ ...account, cash: cleanVal });
  };

  // When stock name or ticker changes, check if it already exists globally, or fall back to KNOWN_STOCKS
  const handleNewStockFieldChange = (field: 'name' | 'ticker', value: string) => {
    setNewStock((prev) => {
      const updated = { ...prev, [field]: value };
      
      const cleanName = updated.name.trim().toUpperCase();
      const cleanTicker = updated.ticker.trim().toUpperCase();
      
      // 1. Check in existing accounts (global active portfolio) first
      if (accounts) {
        for (const acc of accounts) {
          for (const s of acc.stocks) {
            const sTicker = (s.ticker || '').trim().toUpperCase();
            const sName = s.name.trim().toUpperCase();
            
            const isMatch = (cleanTicker && sTicker === cleanTicker) || (cleanName && sName === cleanName);
            if (isMatch) {
              return {
                ...updated,
                name: updated.name || s.name,
                ticker: updated.ticker || s.ticker || '',
                category: s.category,
                currentPrice: s.currentPrice.toString(),
                isForeign: s.isForeign,
              };
            }
          }
        }
      }

      // 2. Check in static KNOWN_STOCKS database as fallback
      const lookupName = updated.name.trim();
      const known = KNOWN_STOCKS[lookupName];
      if (known) {
        return {
          ...updated,
          category: known.category,
          currentPrice: known.price.toString(),
          isForeign: known.isForeign,
        };
      }

      return updated;
    });
  };

  const handleAddStock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStock.name.trim()) return;

    const purchasePriceNum = Number(newStock.purchasePrice) || 0;
    const quantityNum = Number(newStock.quantity) || 0;
    let currentPriceNum = Number(newStock.currentPrice) || purchasePriceNum; // Fallback to purchase price

    const cleanName = newStock.name.trim().toUpperCase();
    const cleanTicker = newStock.ticker.trim().toUpperCase();

    // Securely pull and sync with global portfolio price if it already exists
    if (accounts) {
      let foundGlobal = false;
      for (const acc of accounts) {
        for (const s of acc.stocks) {
          const sTicker = (s.ticker || '').trim().toUpperCase();
          const sName = s.name.trim().toUpperCase();
          
          const isMatch = (cleanTicker && sTicker === cleanTicker) || sName === cleanName;
          if (isMatch) {
            currentPriceNum = s.currentPrice;
            foundGlobal = true;
            break;
          }
        }
        if (foundGlobal) break;
      }
    }

    const newItem: StockItem = {
      id: `stock_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: newStock.name.trim(),
      ticker: newStock.ticker.trim() || undefined,
      purchasePrice: purchasePriceNum,
      quantity: quantityNum,
      currentPrice: currentPriceNum,
      category: newStock.category,
      isForeign: newStock.isForeign,
    };

    onUpdateAccount({
      ...account,
      stocks: [...account.stocks, newItem],
    });

    // Reset input fields
    setNewStock({
      name: '',
      ticker: '',
      purchasePrice: '',
      quantity: '',
      currentPrice: '',
      category: '국내주식',
      isForeign: false,
    });
  };

  const handleDeleteStock = (id: string) => {
    const updatedStocks = account.stocks.filter((stock) => stock.id !== id);
    onUpdateAccount({ ...account, stocks: updatedStocks });
  };

  // Pre-calculate raw valuation totals to compute individual stock weights
  const tempValuations = account.stocks.map((stock) => {
    return getHistoricalItemValuation(stock, false);
  });
  const tempValuationsSum = tempValuations.reduce((sum, val) => sum + val, 0);
  const historicalCashVal = getHistoricalItemValuation(undefined, true);
  const tempTotalValuationTotal = tempValuationsSum + historicalCashVal;

  // Compute calculated statistics for stocks
  const renderedStocks = account.stocks.map((stock, idx) => {
    const purchaseAmount = stock.isForeign
      ? stock.purchasePrice * stock.quantity * exchangeRate
      : stock.purchasePrice * stock.quantity;

    const valuationAmount = tempValuations[idx];

    const profitLoss = valuationAmount - purchaseAmount;
    const returnRate = purchaseAmount === 0 ? 0 : (profitLoss / purchaseAmount) * 100;
    const weight = tempTotalValuationTotal === 0 ? 0 : (valuationAmount / tempTotalValuationTotal) * 100;

    return {
      ...stock,
      purchaseAmount,
      valuationAmount,
      profitLoss,
      returnRate,
      weight,
    };
  });

  // Calculate totals
  const investmentPurchaseTotal = renderedStocks.reduce((sum, item) => sum + item.purchaseAmount, 0);
  const investmentValuationTotal = renderedStocks.reduce((sum, item) => sum + item.valuationAmount, 0);
  const investmentProfitLoss = investmentValuationTotal - investmentPurchaseTotal;
  const investmentReturnRate = investmentPurchaseTotal === 0 ? 0 : (investmentProfitLoss / investmentPurchaseTotal) * 100;

  const totalPurchaseTotal = investmentPurchaseTotal + historicalCashVal;
  const totalValuationTotal = investmentValuationTotal + historicalCashVal;
  const totalProfitLoss = investmentProfitLoss; // cash profit is zero
  const totalReturnRate = totalPurchaseTotal === 0 ? 0 : (totalProfitLoss / totalPurchaseTotal) * 100;

  const investmentWeight = totalValuationTotal === 0 ? 0 : (investmentValuationTotal / totalValuationTotal) * 100;
  const cashWeight = totalValuationTotal === 0 ? 0 : (historicalCashVal / totalValuationTotal) * 100;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-scale-up" id={`account-panel-${account.id}`}>
      {/* Card Header */}
      <div className="px-6 py-5 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
        <div className="flex items-center justify-between w-full sm:w-auto">
          <div>
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <span className="w-2 h-5 bg-indigo-600 rounded-full inline-block"></span>
              {account.name}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              실시간 주가 자동 계산 및 라인 단위 수기 편집이 지원됩니다.
            </p>
          </div>
          {onDeleteAccount && (
            <button
              onClick={() => onDeleteAccount(account.id)}
              className="sm:hidden px-2 py-1 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded transition-all cursor-pointer"
            >
              삭제
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 md:gap-4 flex-wrap">
          {account.stocks.length > 0 && (
            <button
              type="button"
              onClick={handleSyncWithClosingPrices}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg hover:text-emerald-700 transition-all cursor-pointer shadow-sm"
              title="이 계좌에 입력된 모든 종목의 현재가를 사전 등록된 시장 종가 정보로 자동 동기화합니다."
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-500" />
              <span>종가 일괄 자동입력</span>
            </button>
          )}
          {onDeleteAccount && (
            <button
              onClick={() => onDeleteAccount(account.id)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg hover:text-rose-700 transition-all cursor-pointer shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              계좌 전체 삭제
            </button>
          )}
          <div className="flex flex-col items-end shrink-0">
            <span className="text-xs text-slate-400 font-medium font-sans">
              실시간 평가액 총합
            </span>
            <span className="text-xl font-bold text-indigo-700 font-mono">
              ₩{Math.round(totalValuationTotal).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* PC/Tablet View: Scrollable Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-medium text-xs uppercase tracking-wider font-sans">
              <th className="py-3 px-4 min-w-[125px]">종목명</th>
              <th className="py-3 px-2 min-w-[85px]">종목코드</th>
              <th className="py-3 px-3 min-w-[90px]">구분</th>
              <th className="py-3 px-3 text-right">비중</th>
              <th className="py-3 px-3 text-right min-w-[100px]">매입단가</th>
              <th className="py-3 px-3 text-right w-[150px] min-w-[95px]">수량</th>
              <th className="py-3 px-3 text-right">매입금액</th>
              <th className="py-3 px-3 text-right min-w-[100px]">현재가</th>
              <th className="py-3 px-4 text-right">평가금액</th>
              <th className="py-3 px-4 text-right">평가손익</th>
              <th className="py-3 px-3 text-right w-[85px]">수익률</th>
              <th className="py-3 px-4 text-center w-[60px]">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {renderedStocks.map((stock) => (
              <React.Fragment key={stock.id}>
                <tr className="hover:bg-slate-50/40 transition-colors group font-sans">
                  {/* Stock Name */}
                  <td className="py-3 px-4">
                    <div className="flex flex-col">
                      {selectedDate === 'live' ? (
                        <input
                          type="text"
                          id={`edit-${stock.id}-name`}
                          value={stock.name}
                          onChange={(e) => handleStockChange(stock.id, 'name', e.target.value)}
                          className="font-medium text-slate-800 bg-transparent hover:bg-slate-100/70 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-0.5 border-none outline-none w-full transition-all text-sm font-semibold"
                        />
                      ) : (
                        <span className="font-semibold text-slate-800 px-1.5 py-0.5 text-sm">{stock.name}</span>
                      )}
                      {stock.isForeign && (
                        <span className="text-[10px] text-indigo-500 px-1.5 font-mono">
                          외화 자산 (USD)
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Stock Code / Ticker */}
                  <td className="py-3 px-2">
                    {selectedDate === 'live' ? (
                      <input
                        type="text"
                        id={`edit-${stock.id}-ticker`}
                        placeholder="예: 005930, NVDA"
                        value={stock.ticker || ''}
                        onChange={(e) => handleStockChange(stock.id, 'ticker', e.target.value)}
                        className="font-normal text-slate-600 bg-transparent hover:bg-slate-100/70 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-0.5 border-none outline-none w-full transition-all text-xs font-mono"
                      />
                    ) : (
                      <span className="text-slate-600 font-mono text-xs px-1.5 py-0.5">{stock.ticker || '-'}</span>
                    )}
                  </td>

                  {/* Category */}
                  <td className="py-3 px-3">
                    {selectedDate === 'live' ? (
                      <select
                        id={`edit-${stock.id}-category`}
                        value={stock.category}
                        onChange={(e) => handleStockChange(stock.id, 'category', e.target.value as AssetCategory)}
                        className="text-xs font-semibold rounded bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 py-1 px-2 border-none outline-none cursor-pointer transition-colors"
                      >
                        <option value="국내주식">국내주식</option>
                        <option value="해외주식">해외주식</option>
                        <option value="ETF">ETF</option>
                        <option value="단기채">단기채</option>
                        <option value="금은">금은</option>
                        <option value="현금">현금</option>
                      </select>
                    ) : (
                      <span className="text-xs font-semibold rounded bg-slate-100 text-slate-600 py-1 px-2">{stock.category}</span>
                    )}
                  </td>

                  {/* Asset Weight inside this Account */}
                  <td className="py-3 px-3 text-right text-xs font-semibold text-slate-600 font-mono">
                    {stock.weight.toFixed(1)}%
                  </td>

                  {/* Purchase Price */}
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {stock.isForeign && <span className="text-xs text-slate-400 font-mono">$</span>}
                      {selectedDate === 'live' ? (
                        <input
                          type="number"
                          id={`edit-${stock.id}-purchasePrice`}
                          value={stock.purchasePrice || ''}
                          onChange={(e) => handleStockChange(stock.id, 'purchasePrice', e.target.value)}
                          step={stock.isForeign ? '0.01' : '1'}
                          className="bg-transparent hover:bg-slate-100/70 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-0.5 border-none outline-none text-right font-mono text-xs w-full max-w-[100px] text-slate-800"
                        />
                      ) : (
                        <span className="font-mono text-xs text-slate-800 pr-1.5 font-semibold">{stock.purchasePrice.toLocaleString()}</span>
                      )}
                    </div>
                  </td>

                  {/* Quantity */}
                  <td className="py-3 px-3 text-right">
                    {selectedDate === 'live' ? (
                      <input
                        type="number"
                        id={`edit-${stock.id}-quantity`}
                        value={stock.quantity || ''}
                        onChange={(e) => handleStockChange(stock.id, 'quantity', e.target.value)}
                        className="bg-transparent hover:bg-slate-100/70 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-0.5 border-none outline-none text-right font-mono text-xs w-full text-slate-800"
                      />
                    ) : (
                      <span className="font-mono text-xs text-slate-800 pr-1.5 font-semibold">{stock.quantity}</span>
                    )}
                  </td>

                  {/* Calculated Purchase Amount */}
                  <td className="py-3 px-3 text-right font-mono text-slate-600 text-xs">
                    ₩{Math.round(stock.purchaseAmount).toLocaleString()}
                  </td>

                  {/* Current Price */}
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {stock.isForeign && <span className="text-xs text-slate-400 font-mono">$</span>}
                      <input
                        type="number"
                        id={`edit-${stock.id}-currentPrice`}
                        value={stock.currentPrice || ''}
                        readOnly
                        disabled
                        className="bg-slate-150/40 select-none cursor-not-allowed rounded px-1.5 py-0.5 border-none outline-none text-right font-mono text-xs w-full max-w-[80px] text-slate-400 font-semibold"
                        title="현재가는 종목별 통합 투자 현황에서만 수정 가능합니다."
                      />
                    </div>
                  </td>

                  {/* Valuation Amount */}
                  <td className="py-3 px-4 text-right font-mono font-medium text-slate-800 text-xs">
                    ₩{Math.round(stock.valuationAmount).toLocaleString()}
                  </td>

                  {/* Profit/Loss */}
                  <td className={`py-3 px-4 text-right font-mono text-xs font-semibold ${
                    stock.profitLoss > 10 ? 'text-rose-600' : stock.profitLoss < -10 ? 'text-blue-600' : 'text-slate-500'
                  }`}>
                    {stock.profitLoss > 10 ? '+' : ''}
                    {Math.round(stock.profitLoss).toLocaleString()}
                  </td>

                  {/* Return Rate % */}
                  <td className={`py-3 px-3 text-right font-mono text-xs font-semibold ${
                    stock.profitLoss > 10 ? 'text-rose-600' : stock.profitLoss < -10 ? 'text-blue-600' : 'text-slate-500'
                  }`}>
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] ${
                      stock.profitLoss > 10 ? 'bg-rose-50' : stock.profitLoss < -10 ? 'bg-blue-50' : 'bg-slate-50'
                    }`}>
                      {stock.returnRate > 0 ? '+' : ''}
                      {stock.returnRate.toFixed(2)}%
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-center">
                    {selectedDate === 'live' ? (
                      <button
                        type="button"
                        id={`delete-${stock.id}`}
                        onClick={() => handleDeleteStock(stock.id)}
                        className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all duration-150 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                </tr>


              </React.Fragment>
            ))}

            {account.stocks.length === 0 && (
              <tr>
                <td colSpan={12} className="py-8 text-center text-slate-400 text-sm">
                  등록된 보유 종목이 없습니다. 아래의 생성 라인을 이용하여 종목을 입력해 보세요.
                </td>
              </tr>
            )}

            {/* Subtotal of Investments (투자계) */}
            <tr className="bg-emerald-50/40 text-emerald-900 font-sans font-medium text-xs">
              <td className="py-3 px-4 flex items-center gap-1.5 text-emerald-800 font-semibold">
                <CornerDownRight className="w-3.5 h-3.5" />
                투자계 (PC)
              </td>
              <td className="py-3 px-2"></td>
              <td className="py-3 px-3"></td>
              <td className="py-3 px-3 text-right font-semibold text-emerald-800 font-mono">
                {investmentWeight.toFixed(1)}%
              </td>
              <td className="py-3 px-3"></td>
              <td className="py-3 px-3"></td>
              <td className="py-3 px-3 text-right font-mono font-medium">
                ₩{Math.round(investmentPurchaseTotal).toLocaleString()}
              </td>
              <td className="py-3 px-3"></td>
              <td className="py-3 px-4 text-right font-mono text-emerald-900 font-bold">
                ₩{Math.round(investmentValuationTotal).toLocaleString()}
              </td>
              <td className={`py-3 px-4 text-right font-mono font-bold ${
                investmentProfitLoss > 0 ? 'text-rose-600' : investmentProfitLoss < 0 ? 'text-blue-600' : 'text-slate-500'
              }`}>
                {investmentProfitLoss > 0 ? '+' : ''}
                {Math.round(investmentProfitLoss).toLocaleString()}
              </td>
              <td className="py-3 px-3 text-right">
                <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold ${
                  investmentProfitLoss > 0 ? 'bg-rose-100/70 text-rose-700' : investmentProfitLoss < 0 ? 'bg-blue-100/70 text-blue-700' : 'bg-slate-100'
                }`}>
                  {investmentReturnRate > 0 ? '+' : ''}
                  {investmentReturnRate.toFixed(2)}%
                </span>
              </td>
              <td className="py-3 px-4"></td>
            </tr>

            {/* 현금 행 */}
            <tr className="bg-slate-50/50 text-slate-600 font-sans text-xs">
              <td className="py-3.5 px-4 font-medium text-slate-700">
                보유 현금
              </td>
              <td className="py-3.5 px-2"></td>
              <td className="py-3.5 px-3">
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                  현금 자산
                </span>
              </td>
              <td className="py-3.5 px-3 text-right font-semibold text-slate-600 font-mono">
                {cashWeight.toFixed(1)}%
              </td>
              <td className="py-3.5 px-3"></td>
              <td className="py-3.5 px-3"></td>
              <td className="py-3.5 px-3 text-right font-mono font-medium">
                <div className="flex items-center justify-end gap-1.5">
                  <span className="text-slate-400">₩</span>
                  {selectedDate === 'live' ? (
                    <input
                      type="text"
                      id={`edit-cash-${account.id}`}
                      value={account.cash.toLocaleString() || '0'}
                      onChange={(e) => handleCashChange(e.target.value)}
                      className="bg-transparent hover:bg-slate-200/50 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-0.5 border-none outline-none text-right font-mono font-semibold text-slate-700 max-w-[130px] transition-all"
                    />
                  ) : (
                    <span className="font-mono font-semibold text-slate-700 pr-1.5">{historicalCashVal.toLocaleString()}</span>
                  )}
                </div>
              </td>
              <td className="py-3.5 px-3"></td>
              <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-700">
                ₩{Math.round(historicalCashVal).toLocaleString()}
              </td>
              <td className="py-3.5 px-4 text-right font-mono text-slate-400">-</td>
              <td className="py-3.5 px-3 text-center">-</td>
              <td className="py-3.5 px-4"></td>
            </tr>

            {/* 계좌 종합 합계 행 */}
            <tr className="bg-amber-100/60 font-sans font-bold text-xs text-amber-950">
              <td className="py-3.5 px-4 text-amber-900 font-extrabold uppercase tracking-wide">
                계좌 합계 (Total)
              </td>
              <td className="py-3.5 px-2"></td>
              <td className="py-3.5 px-3"></td>
              <td className="py-3.5 px-3 text-right font-semibold text-amber-900 font-mono">
                100.0%
              </td>
              <td className="py-3.5 px-3"></td>
              <td className="py-3.5 px-3"></td>
              <td className="py-3.5 px-3 text-right font-mono font-extrabold text-amber-900">
                ₩{Math.round(totalPurchaseTotal).toLocaleString()}
              </td>
              <td className="py-3.5 px-3"></td>
              <td className="py-3.5 px-4 text-right font-mono font-extrabold text-amber-950 text-sm">
                ₩{Math.round(totalValuationTotal).toLocaleString()}
              </td>
              <td className={`py-3.5 px-4 text-right font-mono font-bold ${
                totalProfitLoss > 0 ? 'text-rose-600' : totalProfitLoss < 0 ? 'text-blue-600' : 'text-slate-500'
              }`}>
                {totalProfitLoss > 0 ? '+' : ''}
                {Math.round(totalProfitLoss).toLocaleString()}
              </td>
              <td className="py-3.5 px-3 text-right">
                <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold ${
                  totalProfitLoss > 0 ? 'bg-rose-100 text-rose-700' : totalProfitLoss < 0 ? 'bg-blue-100/80 text-blue-700' : 'bg-slate-100'
                }`}>
                  {totalReturnRate > 0 ? '+' : ''}
                  {totalReturnRate.toFixed(2)}%
                </span>
              </td>
              <td className="py-3.5 px-4"></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Mobile View: Stacked Card-Based Editor (Visible only on mobile) */}
      <div className="block md:hidden divide-y divide-slate-100">
        {renderedStocks.map((stock) => (
          <div key={stock.id} className="p-4 bg-white hover:bg-slate-50/20 transition-all font-sans" id={`mobile-card-${stock.id}`}>
            {/* Title & Category & Weights */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="grid grid-cols-2 gap-2">
                  {selectedDate === 'live' ? (
                    <input
                      type="text"
                      id={`edit-mobile-${stock.id}-name`}
                      value={stock.name}
                      onChange={(e) => handleStockChange(stock.id, 'name', e.target.value)}
                      className="font-bold text-slate-800 bg-slate-50 hover:bg-slate-100/50 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded px-2.5 py-1 border-none outline-none w-full transition-all text-xs"
                      placeholder="종목명"
                    />
                  ) : (
                    <span className="font-bold text-slate-850 bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs whitespace-nowrap overflow-hidden text-ellipsis block">{stock.name}</span>
                  )}
                  {selectedDate === 'live' ? (
                    <input
                      type="text"
                      id={`edit-mobile-${stock.id}-ticker`}
                      value={stock.ticker || ''}
                      placeholder="종목코드 (선택)"
                      onChange={(e) => handleStockChange(stock.id, 'ticker', e.target.value)}
                      className="font-normal text-slate-600 bg-slate-50 hover:bg-slate-100/50 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded px-2.5 py-1 border-none outline-none w-full transition-all text-xs font-mono"
                    />
                  ) : (
                    <span className="text-slate-600 bg-slate-50 font-mono text-xs border border-slate-200 rounded px-2.5 py-1 whitespace-nowrap overflow-hidden text-ellipsis block">{stock.ticker || '-'}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedDate === 'live' ? (
                    <select
                      id={`edit-mobile-${stock.id}-category`}
                      value={stock.category}
                      onChange={(e) => handleStockChange(stock.id, 'category', e.target.value as AssetCategory)}
                      className="text-[10px] font-bold rounded bg-indigo-50 text-indigo-700 py-1 px-1.5 border-none outline-none cursor-pointer transition-colors"
                    >
                      <option value="국내주식">국내주식</option>
                      <option value="해외주식">해외주식</option>
                      <option value="ETF">ETF</option>
                      <option value="단기채">단기채</option>
                      <option value="금은">금은</option>
                      <option value="현금">현금</option>
                    </select>
                  ) : (
                    <span className="text-[10px] font-bold rounded bg-slate-100 text-slate-600 py-1 px-1.5">{stock.category}</span>
                  )}
                  {stock.isForeign && (
                    <span className="text-[9px] font-extrabold text-indigo-500 bg-indigo-50 px-1 py-0.5 rounded font-mono uppercase shrink-0">
                      USD ($)
                    </span>
                  )}
                  <div className="text-[10px] text-slate-500 ml-auto">
                    단위비중 <span className="font-mono font-bold text-indigo-600 bg-slate-100 px-1 py-0.5 rounded">{stock.weight.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              {/* Delete Button */}
              {selectedDate === 'live' ? (
                <button
                  type="button"
                  id={`delete-mobile-${stock.id}`}
                  onClick={() => handleDeleteStock(stock.id)}
                  className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all duration-150 cursor-pointer shrink-0"
                >
                  <Trash2 className="w-4.5 h-4.5" />
                </button>
              ) : (
                <span className="text-slate-300 text-xs shrink-0 px-2 py-1">-</span>
              )}
            </div>

            {/* Inputs grid for Purchase price, Quantity, and Current Price */}
            <div className="grid grid-cols-3 gap-2.5 mb-3.5">
              <div>
                <label htmlFor={`edit-mobile-${stock.id}-purchasePrice`} className="block text-[9px] font-bold uppercase text-slate-400 tracking-wider mb-1">
                  매입단가 {stock.isForeign && '($)'}
                </label>
                {selectedDate === 'live' ? (
                  <input
                    type="number"
                    id={`edit-mobile-${stock.id}-purchasePrice`}
                    value={stock.purchasePrice || ''}
                    onChange={(e) => handleStockChange(stock.id, 'purchasePrice', e.target.value)}
                    step={stock.isForeign ? '0.01' : '1'}
                    className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-lg py-1.5 px-2 border border-slate-200 outline-none text-right font-mono text-xs text-slate-800"
                  />
                ) : (
                  <div className="w-full bg-slate-50 rounded-lg py-1.5 px-2 border border-slate-200 text-right font-mono text-xs font-bold text-slate-700">
                    {stock.purchasePrice.toLocaleString()}
                  </div>
                )}
              </div>
              <div>
                <label htmlFor={`edit-mobile-${stock.id}-quantity`} className="block text-[9px] font-bold uppercase text-slate-400 tracking-wider mb-1">
                  수량
                </label>
                {selectedDate === 'live' ? (
                  <input
                    type="number"
                    id={`edit-mobile-${stock.id}-quantity`}
                    value={stock.quantity || ''}
                    onChange={(e) => handleStockChange(stock.id, 'quantity', e.target.value)}
                    className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-lg py-1.5 px-2 border border-slate-200 outline-none text-right font-mono text-xs text-slate-800"
                  />
                ) : (
                  <div className="w-full bg-slate-50 rounded-lg py-1.5 px-2 border border-slate-200 text-right font-mono text-xs font-bold text-slate-700">
                    {stock.quantity}
                  </div>
                )}
              </div>
              <div>
                <label htmlFor={`edit-mobile-${stock.id}-currentPrice`} className="block text-[9px] font-bold uppercase text-slate-400 tracking-wider mb-1">
                  현재가 {stock.isForeign && '($)'}
                </label>
                <div className="relative flex items-center">
                  <input
                    type="number"
                    id={`edit-mobile-${stock.id}-currentPrice`}
                    value={stock.currentPrice || ''}
                    readOnly
                    disabled
                    className="w-full bg-slate-100/75 select-none cursor-not-allowed text-slate-400 font-mono text-xs text-right rounded-lg py-1.5 px-2 border border-slate-200 outline-none"
                    title="현재가는 종목별 통합 투자 현황에서만 수정 가능합니다."
                  />
                </div>
              </div>
            </div>

            {/* Sub-computations block */}
            <div className="bg-slate-50/70 rounded-xl p-3 text-xs font-sans space-y-1.5">
              <div className="flex justify-between items-center text-slate-500 text-[11px]">
                <span>매입금액</span>
                <span className="font-mono text-slate-700 font-semibold text-xs">₩{Math.round(stock.purchaseAmount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500 text-[11px] pb-1.5 mb-1.5 border-b border-dashed border-slate-200/50">
                <span>평가금액</span>
                <span className="font-mono text-slate-900 font-bold text-xs">₩{Math.round(stock.valuationAmount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500 text-[11px]">
                <span>평가손익 / 수익률</span>
                <div className="flex items-center gap-1.5">
                  <span className={`font-mono font-bold text-xs ${
                    stock.profitLoss > 10 ? 'text-rose-600' : stock.profitLoss < -10 ? 'text-blue-600' : 'text-slate-500'
                  }`}>
                    {stock.profitLoss > 10 ? '+' : ''}
                    {Math.round(stock.profitLoss).toLocaleString()}
                  </span>
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    stock.profitLoss > 10 ? 'bg-rose-50 text-rose-600' : stock.profitLoss < -10 ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {stock.returnRate > 0 ? '+' : ''}
                    {stock.returnRate.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {account.stocks.length === 0 && (
          <div className="py-8 text-center text-slate-400 text-sm font-sans px-4">
            등록된 보유 종목이 없습니다. 아래의 생성 라인을 이용하여 종목을 입력해 보세요.
          </div>
        )}

        {/* Mobile View Totals and Assets */}
        <div className="p-4 bg-slate-50/50 space-y-3.5 font-sans text-xs">
          {/* 투자계 */}
          <div className="flex items-start justify-between text-emerald-800 border-b border-slate-200/50 pb-3">
            <span className="font-bold flex items-center gap-1.5 pt-1 text-emerald-900">
              <CornerDownRight className="w-3.5 h-3.5" />
              투자계
            </span>
            <div className="flex flex-col items-end space-y-0.5">
              <span className="font-mono text-[10px] text-emerald-600 font-bold">비중 {investmentWeight.toFixed(1)}%</span>
              <div className="font-mono text-slate-600 text-[11px]">
                총 매입: ₩{Math.round(investmentPurchaseTotal).toLocaleString()}
              </div>
              <div className="font-mono font-bold text-emerald-950 text-sm">
                총 평가: ₩{Math.round(investmentValuationTotal).toLocaleString()}
              </div>
              <div className="flex items-center gap-1.5 pt-0.5">
                <span className={`font-mono text-[11px] font-bold ${
                  investmentProfitLoss > 0 ? 'text-rose-600' : investmentProfitLoss < 0 ? 'text-blue-600' : 'text-slate-500'
                }`}>
                  {investmentProfitLoss > 0 ? '+' : ''}
                  {Math.round(investmentProfitLoss).toLocaleString()}
                </span>
                <span className={`inline-block px-1 rounded text-[10px] font-bold ${
                  investmentProfitLoss > 0 ? 'bg-rose-100 text-rose-700' : investmentProfitLoss < 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {investmentReturnRate > 0 ? '+' : ''}
                  {investmentReturnRate.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          {/* 보유 현금 */}
          <div className="flex items-center justify-between text-slate-700 border-b border-slate-200/50 pb-3">
            <div className="space-y-1">
              <span className="font-bold text-slate-800">보유 현금</span>
              <div className="text-[10px] text-slate-400 font-medium">현금 잔고</div>
            </div>
            <div className="flex flex-col items-end space-y-1.5">
              <span className="font-mono text-[10px] text-slate-500 font-bold">비중 {cashWeight.toFixed(1)}%</span>
              <div className="flex items-center justify-end gap-1.5 w-full max-w-[160px]">
                {selectedDate === 'live' ? (
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 rounded-lg px-2 py-1 w-full transition-all">
                    <span className="text-slate-400 font-mono text-xs">₩</span>
                    <input
                      type="text"
                      id={`edit-mobile-cash-${account.id}`}
                      value={account.cash.toLocaleString() || '0'}
                      onChange={(e) => handleCashChange(e.target.value)}
                      className="bg-transparent border-none text-right font-mono font-bold text-slate-700 w-full text-xs outline-none"
                    />
                  </div>
                ) : (
                  <span className="font-mono font-bold text-slate-700 text-xs">₩{Math.round(historicalCashVal).toLocaleString()}</span>
                )}
              </div>
            </div>
          </div>

          {/* 계좌 종합 합계 (Total) */}
          <div className="bg-amber-100/65 rounded-2xl p-4 text-amber-950 font-sans font-bold space-y-2.5 shadow-xs border border-amber-200">
            <div className="flex justify-between items-center text-amber-900">
              <span className="font-extrabold text-xs tracking-wider uppercase">계좌 합계 (Total)</span>
              <span className="text-amber-800 font-mono text-[10px] bg-amber-200/30 px-1.5 py-0.5 rounded font-extrabold">100.0%</span>
            </div>
            <div className="flex justify-between text-[11px] text-amber-850">
              <span>총 매입액 합계</span>
              <span className="font-mono text-xs">₩{Math.round(totalPurchaseTotal).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center font-bold text-amber-950 text-xs">
              <span>총 평가액 합계</span>
              <span className="font-mono text-base text-indigo-700 font-extrabold">₩{Math.round(totalValuationTotal).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-[11px] pt-1.5 border-t border-amber-250/50">
              <span>누적 평가손익 / 수익률</span>
              <div className="flex items-center gap-1.5 leading-none">
                <span className={`font-mono font-extrabold text-xs ${
                  totalProfitLoss > 0 ? 'text-rose-600' : totalProfitLoss < 0 ? 'text-blue-600' : 'text-slate-500'
                }`}>
                  {totalProfitLoss > 0 ? '+' : ''}
                  {Math.round(totalProfitLoss).toLocaleString()}
                </span>
                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  totalProfitLoss > 0 ? 'bg-rose-100 text-rose-700' : totalProfitLoss < 0 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {totalReturnRate > 0 ? '+' : ''}
                  {totalReturnRate.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Adding a Stock Line Form */}
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
        {(() => {
          const cleanFormName = newStock.name.trim().toUpperCase();
          const cleanFormTicker = newStock.ticker.trim().toUpperCase();
          let matchedGlobalStock: StockItem | null = null;
          if (accounts && (cleanFormName || cleanFormTicker)) {
            for (const acc of accounts) {
              for (const s of acc.stocks) {
                const sTicker = (s.ticker || '').trim().toUpperCase();
                const sName = s.name.trim().toUpperCase();
                if ((cleanFormTicker && sTicker === cleanFormTicker) || (cleanFormName && sName === cleanFormName)) {
                  matchedGlobalStock = s;
                  break;
                }
              }
              if (matchedGlobalStock) break;
            }
          }

          const hasGlobalMatch = !!matchedGlobalStock;
          const staticKnown = KNOWN_STOCKS[newStock.name.trim()];

          return (
            <>
              <form onSubmit={handleAddStock} className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
                {/* 종목명 */}
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-1">
                    종목명
                  </label>
                  <input
                    type="text"
                    id={`add-${account.id}-name`}
                    placeholder="예: 삼성전자"
                    value={newStock.name}
                    onChange={(e) => handleNewStockFieldChange('name', e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg py-1.5 px-3 text-xs text-slate-800 outline-none transition-all placeholder:text-slate-400 font-sans font-medium"
                  />
                </div>

                {/* 종목코드 */}
                <div className="md:col-span-1.5">
                  <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-1">
                    종목코드
                  </label>
                  <input
                    type="text"
                    id={`add-${account.id}-ticker`}
                    placeholder="005930, NVDA 등"
                    value={newStock.ticker}
                    onChange={(e) => handleNewStockFieldChange('ticker', e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg py-1.5 px-2.5 text-xs text-slate-800 outline-none transition-all placeholder:text-slate-400 font-mono"
                  />
                </div>

                {/* 구분 */}
                <div className="md:col-span-1.5 font-sans">
                  <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-1">
                    구분
                  </label>
                  <select
                    id={`add-${account.id}-category`}
                    value={newStock.category}
                    onChange={(e) => setNewStock((prev) => ({ ...prev, category: e.target.value as AssetCategory }))}
                    className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg py-1.5 px-2 text-xs text-slate-800 outline-none transition-all font-sans cursor-pointer h-[32px]"
                  >
                    <option value="국내주식">국내주식</option>
                    <option value="해외주식">해외주식</option>
                    <option value="ETF">ETF</option>
                    <option value="단기채">단기채</option>
                    <option value="금은">금은</option>
                    <option value="현금">현금</option>
                  </select>
                </div>

                {/* 외화여부 */}
                <div className="md:col-span-1.5 font-sans">
                  <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-1">
                    통화
                  </label>
                  <select
                    id={`add-${account.id}-isForeign`}
                    value={newStock.isForeign ? 'yes' : 'no'}
                    onChange={(e) => setNewStock((prev) => ({ ...prev, isForeign: e.target.value === 'yes' }))}
                    className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg py-1.5 px-2 text-xs text-slate-800 outline-none transition-all font-sans cursor-pointer h-[32px]"
                  >
                    <option value="no">KRW (₩)</option>
                    <option value="yes">USD ($)</option>
                  </select>
                </div>

                {/* 수량 */}
                <div className="md:col-span-1.5">
                  <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-1">
                    수량
                  </label>
                  <input
                    type="number"
                    id={`add-${account.id}-quantity`}
                    placeholder="0"
                    value={newStock.quantity}
                    onChange={(e) => setNewStock((prev) => ({ ...prev, quantity: e.target.value }))}
                    className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg py-1.5 px-2 text-xs text-slate-800 outline-none transition-all font-mono"
                  />
                </div>

                {/* 매입 자산 단가 */}
                <div className="md:col-span-1.5">
                  <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-1">
                    매입단가
                  </label>
                  <input
                    type="number"
                    id={`add-${account.id}-purchasePrice`}
                    placeholder={newStock.isForeign ? 'USD $' : 'KRW ₩'}
                    value={newStock.purchasePrice}
                    onChange={(e) => setNewStock((prev) => ({ ...prev, purchasePrice: e.target.value }))}
                    className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg py-1.5 px-3 text-xs text-slate-800 outline-none transition-all font-mono"
                  />
                </div>

                {/* 현재 주가 */}
                <div className="md:col-span-1.5">
                  <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-1 flex items-center gap-1">
                    현재가
                    <HelpCircle className="w-3 h-3 text-slate-400" title={hasGlobalMatch ? '통합 투자 현황에 고시된 현재가가 강제 설정됩니다.' : '미입력시 매입단가와 동일설정'} />
                  </label>
                  <input
                    type="number"
                    id={`add-${account.id}-currentPrice`}
                    placeholder={newStock.isForeign ? 'USD $' : 'KRW ₩'}
                    value={newStock.currentPrice}
                    onChange={(e) => setNewStock((prev) => ({ ...prev, currentPrice: e.target.value }))}
                    readOnly={hasGlobalMatch}
                    disabled={hasGlobalMatch}
                    className={`w-full border rounded-lg py-1.5 px-3 text-xs text-slate-800 outline-none transition-all font-mono ${
                      hasGlobalMatch
                        ? 'border-indigo-200 bg-slate-100 select-none cursor-not-allowed text-indigo-700 font-bold'
                        : 'bg-white border-slate-250 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                    }`}
                    title={hasGlobalMatch ? '이미 포트폴리오에 등록되어 있는 단일현재가 종목입니다.' : undefined}
                  />
                </div>

                {/* 추가 버튼 */}
                <div className="md:col-span-1">
                  <button
                    type="submit"
                    id={`add-btn-${account.id}`}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2 px-1 rounded-lg flex items-center justify-center gap-1 shadow-sm transition-all cursor-pointer h-[32px]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    추가
                  </button>
                </div>
              </form>

              {/* Info alerts */}
              {hasGlobalMatch && matchedGlobalStock && (
                <p className="text-[11px] text-indigo-700 bg-indigo-50 rounded-lg px-3 py-1.5 mt-2.5 flex items-center gap-1.5 font-sans border border-indigo-100">
                  <Check className="w-3.5 h-3.5 text-indigo-500 shrink-0 animate-bounce" />
                  <span>
                    통합 투자 현황에 등록된 보유 주식 <strong>{matchedGlobalStock.name}</strong> 종목을 찾았습니다. 
                    현재가(<strong>{matchedGlobalStock.isForeign ? `$${matchedGlobalStock.currentPrice}` : `₩${matchedGlobalStock.currentPrice.toLocaleString()}`}</strong>)가 고정 반영됩니다. (현재가는 통합 투자 현황에서만 수정 가능합니다.)
                  </span>
                </p>
              )}

              {!hasGlobalMatch && staticKnown && (
                <p className="text-[11px] text-emerald-700 bg-emerald-50 rounded-lg px-3 py-1.5 mt-2.5 flex items-center gap-1.5 font-sans border border-emerald-100">
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>
                    보유 종목 데이터베이스에서 <strong>{newStock.name.trim()}</strong> 종목 정보를 발견하여 대입하였습니다. 
                    (구분: {staticKnown.category}, 고시 가격: {newStock.isForeign ? `$${staticKnown.price}` : `₩${staticKnown.price.toLocaleString()}`})
                  </span>
                </p>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}
