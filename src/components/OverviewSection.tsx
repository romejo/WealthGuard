import React, { useState, useEffect } from 'react';
import { Account, AssetCategory, StockItem } from '../types';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid, ComposedChart, Bar } from 'recharts';
import { TrendingUp, TrendingDown, Briefcase, Plus, Wallet, Award, Activity, RotateCcw, Calendar, ChevronRight } from 'lucide-react';
import { KNOWN_STOCKS } from '../initialData';

interface CustomizedLabelProps {
  x?: number;
  y?: number;
  value?: number;
  index?: number;
  payload?: any;
  dataKey?: string;
}

const CustomizedLabel = (props: any) => {
  const { x, y, index, data, payload, dataKey, showDelta } = props;
  if (x === undefined || y === undefined || !dataKey) return null;

  if (index === 0) {
    let offsetY = 0;
    if (data && data[0]) {
      const keys = Object.keys(data[0])
        .filter(k => k !== 'date' && !k.endsWith('_percent') && !k.endsWith('_delta') && typeof data[0][k] === 'number')
        .sort((a, b) => data[0][b] - data[0][a]);

      const maxVal = Math.max(...keys.map(k => data[0][k]), 1);
      const minVal = Math.min(...keys.map(k => data[0][k]), 0);
      const valRange = maxVal - minVal || 1;

      const pseudoYs = keys.map(k => {
        const val = data[0][k];
        return {
          key: k,
          y: 400 * (1 - (val - minVal) / valRange)
        };
      });

      const minDistance = 18;
      const adjustedYs = [...pseudoYs];
      
      for (let pass = 0; pass < 5; pass++) {
        for (let i = 0; i < adjustedYs.length - 1; i++) {
          const item1 = adjustedYs[i];
          const item2 = adjustedYs[i + 1];
          const diff = item2.y - item1.y;
          if (diff < minDistance) {
            const overlap = minDistance - diff;
            item1.y -= overlap / 2;
            item2.y += overlap / 2;
          }
        }
        if (adjustedYs[0].y < 0) {
          const shift = -adjustedYs[0].y;
          adjustedYs.forEach(it => { it.y += shift; });
        }
      }

      const itemIdx = keys.indexOf(dataKey);
      if (itemIdx !== -1) {
        offsetY = adjustedYs[itemIdx].y - pseudoYs[itemIdx].y;
      }
    }

    return (
      <text
        x={x - 10}
        y={y + offsetY + 4}
        fill={props.stroke || '#475569'}
        fontSize={10}
        fontWeight="bold"
        fontFamily="sans-serif"
        textAnchor="end"
        style={{ textShadow: '0 1.5px 3px rgba(255, 255, 255, 1), 0 0 1.5px rgba(255, 255, 255, 1)' }}
      >
        {dataKey}
      </text>
    );
  }

  let percent: number | undefined;
  if (data && index !== undefined && data[index]) {
    percent = data[index][`${dataKey}_percent`];
  }

  if (percent === undefined && payload) {
    percent = payload[`${dataKey}_percent`];
  }
  if (percent === undefined && props[`${dataKey}_percent`] !== undefined) {
    percent = props[`${dataKey}_percent`];
  }

  if (percent === undefined || percent === 0 || isNaN(percent)) return null;

  const isPositive = percent > 0;
  const displayText = `${isPositive ? '+' : ''}${percent.toFixed(1)}%`;

  return (
    <text
      x={x}
      y={y - 12}
      fill={isPositive ? '#e11d48' : '#1d4ed8'}
      fontSize={9.5}
      fontWeight="900"
      fontFamily="sans-serif"
      textAnchor="middle"
      style={{ textShadow: '0 1.5px 3px rgba(255, 255, 255, 1), 0 0 1.5px rgba(255, 255, 255, 1)' }}
    >
      {displayText}
    </text>
  );
};

const TotalAssetCustomizedLabel = (props: any) => {
  const { x, y, index, data, payload } = props;
  if (x === undefined || y === undefined) return null;

  let total_val = 0;
  let total_changeAmount: number | null = null;
  let total_changeRate: number | null = null;

  if (data && index !== undefined && data[index]) {
    total_val = data[index].total_val || 0;
    total_changeAmount = data[index].total_changeAmount;
    total_changeRate = data[index].total_changeRate;
  } else if (payload) {
    total_val = payload.total_val || 0;
    total_changeAmount = payload.total_changeAmount;
    total_changeRate = payload.total_changeRate;
  }

  if (total_val <= 0) return null;

  const actualKRW = total_val * 10000;
  
  // Format total
  let totalDisplay = '';
  if (actualKRW >= 100000000) {
    totalDisplay = `₩${(actualKRW / 100000000).toFixed(2)}억`;
  } else {
    totalDisplay = `₩${Math.round(actualKRW / 10000).toLocaleString()}만`;
  }

  // Format change
  let changeDisplay = '첫 거래일';
  let isPositive = false;
  let isNegative = false;

  if (total_changeAmount !== null && total_changeAmount !== undefined) {
    if (total_changeAmount === 0) {
      changeDisplay = '0원 (0.0%)';
    } else {
      isPositive = total_changeAmount > 0;
      isNegative = total_changeAmount < 0;
      const sign = isPositive ? '+' : '-';
      const absVal = Math.abs(total_changeAmount);
      
      let amountPart = '';
      if (absVal >= 100000000) {
        amountPart = `${(absVal / 100000000).toFixed(2)}억`;
      } else {
        amountPart = `${Math.round(absVal / 10000).toLocaleString()}만`;
      }

      const ratePart = total_changeRate !== null && total_changeRate !== undefined
        ? `(${isPositive ? '+' : ''}${total_changeRate.toFixed(1)}%)`
        : '';
        
      changeDisplay = `${sign}${amountPart} ${ratePart}`;
    }
  }

  const changeColor = isPositive ? '#e11d48' : isNegative ? '#2563eb' : '#64748b';
  const bgColor = isPositive ? '#fff5f5' : isNegative ? '#f0f7ff' : '#f8fafc';
  const strokeColor = isPositive ? '#fecdd3' : isNegative ? '#bfdbfe' : '#e2e8f0';

  const containerWidth = props.viewBox?.width || props.width || 0;
  const pillWidth = 124; // Expanded to prevent truncation of total asset digits
  const halfPill = pillWidth / 2;
  let labelX = x;
  if (containerWidth > 0) {
    const minX = halfPill + 4;
    const maxX = containerWidth - halfPill - 4;
    labelX = Math.max(minX, Math.min(maxX, x));
  } else {
    labelX = Math.max(halfPill + 4, x);
  }

  const labelY = Math.max(42, y);

  return (
    <g>
      {/* Background Tooltip/Pill */}
      <rect
        x={labelX - halfPill}
        y={labelY - 36}
        width={pillWidth}
        height={28}
        fill={bgColor}
        stroke={strokeColor}
        strokeWidth={1}
        rx={5}
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.06))' }}
      />
      {/* Total Asset Text */}
      <text
        x={labelX}
        y={labelY - 25}
        fill="#0f172a"
        fontSize={9.2}
        fontWeight="bold"
        fontFamily="sans-serif"
        textAnchor="middle"
      >
        {totalDisplay}
      </text>
      {/* Change Text */}
      <text
        x={labelX}
        y={labelY - 14}
        fill={changeColor}
        fontSize={7.8}
        fontWeight="bold"
        fontFamily="sans-serif"
        textAnchor="middle"
      >
        {changeDisplay}
      </text>
    </g>
  );
};

const AssetCustomizedLabel = (props: any) => {
  const { x, y, index, data, dataKey, payload, itemsList } = props;
  if (x === undefined || y === undefined || !dataKey) return null;

  // Only display on the last day's bar graph to prevent label repetition and overlapping
  if (!data || index === undefined || index !== data.length - 1) return null;

  const categoryClean = dataKey.replace('_mid', '');
  
  // Clean up stock names for better readability and to avoid overlaps
  const cleanCategoryName = (name: string) => {
    return name
      .replace(/^(Tiger|KODEX|ACE|HANARO|SOL|Kosef)\s+/i, '')
      .replace(/액티브적격$/, '')
      .trim();
  };

  const displayName = cleanCategoryName(categoryClean);
  
  let changeAmount: number | undefined | null;
  let changeRate: number | undefined | null;

  // 1. Try explicit lookup if we passed the data array
  if (data && index !== undefined && data[index]) {
    changeAmount = data[index][`${categoryClean}_changeAmount`];
    changeRate = data[index][`${categoryClean}_changeRate`];
  }
  
  // 2. Fallbacks
  if (changeAmount === undefined && payload) {
    changeAmount = payload[`${categoryClean}_changeAmount`];
  }
  if (changeAmount === undefined && props[`${categoryClean}_changeAmount`] !== undefined) {
    changeAmount = props[`${categoryClean}_changeAmount`];
  }

  if (changeRate === undefined && payload) {
    changeRate = payload[`${categoryClean}_changeRate`];
  }
  if (changeRate === undefined && props[`${categoryClean}_changeRate`] !== undefined) {
    changeRate = props[`${categoryClean}_changeRate`];
  }

  // Verify that the segment/item itself has valuation on this day
  let currentVal = 0;
  if (data && index !== undefined && data[index]) {
    currentVal = data[index][categoryClean] || 0;
  } else if (payload) {
    currentVal = payload[categoryClean] || 0;
  }
  
  // 1만 원 미만의 극히 작은 dust assets 는 노이즈 제거를 위해 숨김
  if (currentVal < 1) return null;

  const formatAmountChange = (changeInWon: number) => {
    if (changeInWon === 0) return '0';
    const isPositive = changeInWon > 0;
    const absVal = Math.abs(changeInWon);
    const sign = isPositive ? '+' : '-';
    
    if (absVal >= 10000) {
      const inMan = absVal / 10000;
      if (inMan % 1 === 0) {
        return `${sign}${inMan.toFixed(0)}만`;
      } else {
        return `${sign}${inMan.toFixed(1)}만`;
      }
    } else {
      if (absVal >= 1000) {
        const inChon = absVal / 1000;
        if (inChon % 1 === 0) {
          return `${sign}${inChon.toFixed(0)}천`;
        } else {
          return `${sign}${inChon.toFixed(1)}천`;
        }
      }
      return `${sign}${absVal.toLocaleString()}`;
    }
  };

  let displayText = '';
  if (changeAmount !== undefined && changeAmount !== null && !isNaN(changeAmount) && changeAmount !== 0) {
    displayText = formatAmountChange(changeAmount);
    if (changeRate !== undefined && changeRate !== null && !isNaN(changeRate)) {
      const isPositiveRate = changeRate > 0;
      const signRate = isPositiveRate ? '+' : '';
      displayText += ` (${signRate}${changeRate.toFixed(1)}%)`;
    }
  } else {
    displayText = `₩${Math.round(currentVal).toLocaleString()}만`;
  }

  const containerWidth = props.viewBox?.width || props.width || 0;
  const lastIndex = data.length - 1;
  const lastDay = data[lastIndex];

  // Resolve active items on the last day based on supplied itemsList
  const activeItems = (itemsList || []).filter((name: string) => (lastDay[name] || 0) >= 1);
  const activeIdx = activeItems.indexOf(categoryClean);
  if (activeIdx === -1) return null;

  // Alternate zigzag placement: left versus right
  const isLeft = activeIdx % 2 === 0;

  // Calibrate Y axis scale using current pixel coordinate vs midpoint value ratio
  const currentMidVal = lastDay[`${categoryClean}_mid`] || 0;
  const chartHeight = props.viewBox?.height || 300;
  const chartY = props.viewBox?.y || 52;
  const ratio = 1 - (y - chartY) / chartHeight;

  const getPixelY = (val: number) => {
    if (currentMidVal > 0 && ratio > 0.05) {
      const calibratedMaxY = currentMidVal / ratio;
      return chartY + (1 - val / calibratedMaxY) * chartHeight;
    }
    const maxTotalVal = Math.max(...data.map((d: any) => d.total_val || 0));
    const fallbackMaxY = maxTotalVal * 1.15;
    return chartY + (1 - val / fallbackMaxY) * chartHeight;
  };

  // Run 1D Spacing layout sweep-and-prune for same side items only
  const sideItems = activeItems.filter((_, idx) => (idx % 2 === activeIdx % 2));
  const sidePositions = sideItems.map(name => ({
    name,
    y: getPixelY(lastDay[`${name}_mid`] || 0)
  }));

  // Sort top-to-bottom of screen (ascending pixel y coordinates)
  sidePositions.sort((a, b) => a.y - b.y);

  const minGap = 17;
  
  // Forward sweep (push down)
  for (let i = 1; i < sidePositions.length; i++) {
    if (sidePositions[i].y < sidePositions[i - 1].y + minGap) {
      sidePositions[i].y = sidePositions[i - 1].y + minGap;
    }
  }
  // Backward sweep (push up)
  for (let i = sidePositions.length - 2; i >= 0; i--) {
    if (sidePositions[i].y > sidePositions[i + 1].y - minGap) {
      sidePositions[i].y = sidePositions[i + 1].y - minGap;
    }
  }

  const found = sidePositions.find(item => item.name === categoryClean);
  const adjustedY = found ? found.y : y;
  const labelY = Math.max(16, adjustedY);

  const offsetDistance = 12;
  let labelX = isLeft ? x - offsetDistance : x + offsetDistance;

  if (containerWidth > 0) {
    const minX = 42;
    const maxX = containerWidth - 42;
    labelX = Math.max(minX, Math.min(maxX, labelX));
  } else {
    labelX = Math.max(42, labelX);
  }

  return (
    <g>
      {/* 텍스트와 중심점을 잇는 대쉬 구조 가이드선 */}
      <line 
        x1={x} 
        y1={y} 
        x2={isLeft ? x - 10 : x + 10} 
        y2={labelY} 
        stroke="#94a3b8" 
        strokeWidth={0.8} 
        strokeDasharray="2 2"
      />
      <text
        x={labelX}
        y={labelY - 5}
        fill="#1e293b"
        fontSize={8.5}
        fontWeight="bold"
        fontFamily="sans-serif"
        textAnchor={isLeft ? "end" : "start"}
        style={{ textShadow: '0 2px 4px rgba(255, 255, 255, 1), -1.5px -1.5px 0px rgba(255,255,255,1), 1.5px -1.5px 0px rgba(255,255,255,1), -1.5px 1.5px 0px rgba(255,255,255,1), 1.5px 1.5px 0px rgba(255,255,255,1)' }}
      >
        <tspan x={labelX} fontWeight="bold">{displayName}</tspan>
        <tspan x={labelX} dy="1.15em" fontSize={7.5} fill="#475569" fontWeight="medium">{displayText}</tspan>
      </text>
    </g>
  );
};

interface OverviewSectionProps {
  key?: string;
  accounts: Account[];
  exchangeRate: number;
  customBaseAmounts: Record<string, number>;
  handleBaseAmountChange: (segmentName: string, value: number) => void;
  handleResetBaseAmount: (segmentName: string) => void;
  accountTrends: any[];
}

export default function OverviewSection({
  accounts,
  exchangeRate,
  customBaseAmounts,
  handleBaseAmountChange,
  handleResetBaseAmount,
  accountTrends,
}: OverviewSectionProps) {

  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);

  // Helper to compute stock purchase and valuation values
  const getStockValues = (stock: StockItem) => {
    const purchaseAmount = stock.isForeign
      ? stock.purchasePrice * stock.quantity * exchangeRate
      : stock.purchasePrice * stock.quantity;
    const valuationAmount = stock.isForeign
      ? stock.currentPrice * stock.quantity * exchangeRate
      : stock.currentPrice * stock.quantity;
    return { purchaseAmount, valuationAmount };
  };

  // 1. Calculate Account Segment Summaries dynamically to support custom additions/deletions seamlessly
  const segments: { name: string; purchase: number; valuation: number }[] = [];

  // Find Toss to keep preferred domestic/foreign split
  const tossAccount = accounts.find((a) => a.id === 'toss');
  if (tossAccount) {
    let tossDomPurchase = tossAccount.cash;
    let tossDomValuation = tossAccount.cash;
    let tossForPurchase = 0;
    let tossForValuation = 0;

    tossAccount.stocks.forEach((s) => {
      const { purchaseAmount, valuationAmount } = getStockValues(s);
      if (s.category === '해외주식') {
        tossForPurchase += purchaseAmount;
        tossForValuation += valuationAmount;
      } else {
        tossDomPurchase += purchaseAmount;
        tossDomValuation += valuationAmount;
      }
    });

    segments.push({ name: '토스 국내', purchase: tossDomPurchase, valuation: tossDomValuation });
    segments.push({ name: '토스 해외', purchase: tossForPurchase, valuation: tossForValuation });
  }

  // Handle all other accounts dynamically
  accounts.forEach((acc) => {
    if (acc.id === 'toss') return; // Handled split above

    let accPurchase = acc.cash;
    let accValuation = acc.cash;

    acc.stocks.forEach((s) => {
      const { purchaseAmount, valuationAmount } = getStockValues(s);
      accPurchase += purchaseAmount;
      accValuation += valuationAmount;
    });

    segments.push({
      name: acc.name,
      purchase: accPurchase,
      valuation: accValuation,
    });
  });

  // 현재 가치(valuation) 기준 오름차순 정렬하여, 비중이 작은 계좌가 아래에 먼저 쌓이도록 보장
  segments.sort((a, b) => a.valuation - b.valuation);

  const getCurDateLabel = () => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${mm}월 ${dd}일`;
  };

  const curDateLabel = getCurDateLabel();

  const getSegmentDailyChange = (segName: string) => {
    const todayIndex = accountTrends.findIndex(d => d.date === curDateLabel);
    let prevVal = 0;

    if (todayIndex > 0) {
      for (let i = todayIndex - 1; i >= 0; i--) {
        if (accountTrends[i][segName] && accountTrends[i][segName] > 0) {
          prevVal = accountTrends[i][segName];
          break;
        }
      }
    } else {
      // Weekend or today not yet created: compare live valuation against the last recorded day's valuation
      for (let i = accountTrends.length - 1; i >= 0; i--) {
        if (accountTrends[i][segName] && accountTrends[i][segName] > 0) {
          prevVal = accountTrends[i][segName];
          break;
        }
      }
    }
    
    const liveItem = segments.find(s => s.name === segName);
    const curVal = liveItem ? Math.round(liveItem.valuation) : 0;
    
    if (prevVal === 0 || curVal === 0) return { change: 0, percent: 0 };
    
    const change = curVal - prevVal;
    const percent = (change / prevVal) * 100;
    return { change, percent };
  };

  // Pre-process accountTrends to carry over previous day's state on empty days (weekdays with no records)
  const validAccountTrends = React.useMemo(() => {
    if (!accountTrends || accountTrends.length === 0) return [];

    const filled: any[] = [];
    let lastNonEmptyDay: any = null;

    accountTrends.forEach((day) => {
      // Check if this day is empty.
      // An empty day has only "date" or all numeric keys are 0.
      let isEmpty = true;
      Object.keys(day).forEach(key => {
        if (key !== 'date' && typeof day[key] === 'number' && day[key] > 0) {
          isEmpty = false;
        }
      });

      if (isEmpty && lastNonEmptyDay) {
        // Carry over all keys from the last non-empty day, keeping the current day's date label.
        filled.push({
          ...lastNonEmptyDay,
          date: day.date
        });
      } else {
        filled.push(day);
        if (!isEmpty) {
          lastNonEmptyDay = day;
        }
      }
    });

    return filled;
  }, [accountTrends]);

  const getSegmentValuationInDayForChart = (segName: string, segCurrentValuation: number, day: any) => {
    const lastDayInTrends = validAccountTrends[validAccountTrends.length - 1];
    if (day.date === curDateLabel || (lastDayInTrends && day.date === lastDayInTrends.date)) {
      return segCurrentValuation;
    }
    return day[segName] || 0;
  };

  const getSegmentYieldInDay = (segName: string, day: any) => {
    const seg = segments.find(s => s.name === segName);
    if (!seg) return null;

    const isCustom = customBaseAmounts[seg.name] !== undefined;
    const baseAmount = isCustom ? customBaseAmounts[seg.name] : seg.purchase;
    
    const val = getSegmentValuationInDayForChart(seg.name, seg.valuation, day);
    if (val === undefined || val <= 0) {
      return null;
    }
    
    const profit = val - baseAmount;
    const currentYield = baseAmount === 0 ? 0 : (profit / baseAmount) * 100;

    return Number(currentYield.toFixed(2));
  };

  const getPortfolioItemYieldInDay = (segName: string, itemName: string, itemCurrentValuation: number, day: any) => {
    if (itemName === '예수금(현금)' || itemName.includes('현금') || itemName.includes('예수금')) {
      return null;
    }

    let stock: StockItem | undefined;
    for (const acc of accounts) {
      if (acc.name === segName || (segName.startsWith('토스') && acc.id === 'toss')) {
        const found = acc.stocks.find(s => s.name === itemName);
        if (found) {
          stock = found;
          break;
        }
      }
    }

    if (!stock) {
      return null;
    }

    const { purchaseAmount } = getStockValues(stock);
    if (purchaseAmount <= 0) {
      return null;
    }

    const val = getPortfolioItemValuationInDay(segName, itemName, itemCurrentValuation, day);
    if (val <= 0) return null;
    const itemYield = ((val - purchaseAmount) / purchaseAmount) * 100;

    return Number(itemYield.toFixed(2));
  };

  const accountChartData = validAccountTrends.map((day, dayIdx) => {
    const formatted: any = { date: day.date };
    let total_val = 0;
    
    segments.forEach(seg => {
      const amountVal = getSegmentValuationInDayForChart(seg.name, seg.valuation, day);
      const valInMan = Math.round(amountVal / 10000);
      formatted[seg.name] = valInMan;
      total_val += valInMan;
    });
    
    formatted.total_val = total_val;

    let runningSum = 0;
    segments.forEach(seg => {
      const val = formatted[seg.name] || 0;
      formatted[`${seg.name}_mid`] = val > 0 ? runningSum + (val / 2) : null;
      runningSum += val;
      
      // Calculate day-over-day change rate and change amount instead of share weight
      if (dayIdx > 0) {
        const prevDay = validAccountTrends[dayIdx - 1];
        const prevVal = getSegmentValuationInDayForChart(seg.name, seg.valuation, prevDay);
        const currentVal = getSegmentValuationInDayForChart(seg.name, seg.valuation, day);
        if (prevVal > 0 && currentVal > 0) {
          formatted[`${seg.name}_changeAmount`] = currentVal - prevVal;
          formatted[`${seg.name}_changeRate`] = ((currentVal - prevVal) / prevVal) * 100;
        } else {
          formatted[`${seg.name}_changeAmount`] = null;
          formatted[`${seg.name}_changeRate`] = null;
        }
      } else {
        formatted[`${seg.name}_changeAmount`] = null;
        formatted[`${seg.name}_changeRate`] = null;
      }
    });

    let total_changeAmount = null;
    let total_changeRate = null;
    let decreaseLabel = '';
    if (dayIdx > 0 && total_val > 0) {
      const prevDay = validAccountTrends[dayIdx - 1];
      let prevTotalVal = 0;
      segments.forEach(seg => {
        const segPrevVal = getSegmentValuationInDayForChart(seg.name, seg.valuation, prevDay);
        prevTotalVal += Math.round(segPrevVal / 10000);
      });
      if (prevTotalVal > 0) {
        total_changeAmount = (total_val - prevTotalVal) * 10000; // in KRW
        total_changeRate = ((total_val - prevTotalVal) / prevTotalVal) * 100;
        const diff = total_val - prevTotalVal;
        if (diff < 0) {
          const decreaseAmt = Math.abs(diff * 10000) / 1000000;
          decreaseLabel = `-${decreaseAmt.toFixed(1)}백만`;
        }
      }
    }
    formatted['total_changeAmount'] = total_changeAmount;
    formatted['total_changeRate'] = total_changeRate;
    formatted['decreaseLabel'] = decreaseLabel;

    return formatted;
  }).filter(day => {
    const match = day.date.match(/(\d+)월\s*(\d+)일/);
    if (match) {
      const month = parseInt(match[1], 10);
      const date = parseInt(match[2], 10);
      if (month === 6 && date < 8) {
        return false;
      }
    }
    return true;
  });

  const getSegmentPortfolioItems = (segName: string) => {
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

    const items: { name: string; isCash: boolean; currentValuation: number }[] = [];
    
    // Add stocks that currently exist
    stocks.forEach(s => {
      const { valuationAmount } = getStockValues(s);
      const existing = items.find(item => item.name === s.name);
      if (existing) {
        existing.currentValuation += valuationAmount;
      } else {
        items.push({
          name: s.name,
          isCash: false,
          currentValuation: valuationAmount
        });
      }
    });

    // Merge historically active keys in accountTrends (e.g. key: "신한투자_LG전자")
    // to include stocks that were deleted but have non-zero values on past days
    if (accountTrends) {
      accountTrends.forEach(day => {
        Object.keys(day).forEach(key => {
          if (key.startsWith(`${segName}_`)) {
            const itemName = key.substring(segName.length + 1);
            if (
              itemName && 
              itemName !== '예수금(현금)' && 
              itemName !== 'changeAmount' && 
              itemName !== 'changeRate' && 
              !itemName.endsWith('_changeAmount') && 
              !itemName.endsWith('_changeRate') && 
              !itemName.endsWith('_mid')
            ) {
              const val = day[key];
              if (typeof val === 'number' && val > 0) {
                const existing = items.find(item => item.name === itemName);
                if (!existing) {
                  items.push({
                    name: itemName,
                    isCash: false,
                    currentValuation: 0 // Live valuation is 0 since it is deleted/sold
                  });
                }
              }
            }
          }
        });
      });
    }

    // Add cash if greater than 0, or if cash was historically present
    const hasHistoricalCash = accountTrends && accountTrends.some(day => {
      const hval = day[`${segName}_예수금(현금)`];
      return typeof hval === 'number' && hval > 0;
    });

    if (cash > 0 || hasHistoricalCash) {
      const existingCash = items.find(item => item.isCash);
      if (!existingCash) {
        items.push({
          name: '예수금(현금)',
          isCash: true,
          currentValuation: cash
        });
      } else {
        // Just override the current valuation
        existingCash.currentValuation = cash;
      }
    }

    // Sort items based on category to maintain consistent visual stacking on the Recharts bar chart
    // High-priority (bottom of chart): 예수금(현금), 달러 -> Rank 10 (Cash/Reserve assets at the bottom)
    // Second-priority: Commodities like ACE KRX금현물 (Category: 금은) -> Rank 20 (Commodities second from bottom)
    // Third-priority: Short-term CMA/Money Market like Tiger 머니마켓액티브 (Category: 현금) -> Rank 30
    // Fourth-priority (top of chart): Equities like HANARO 원자력iSelect, Tiger 반도체TOP10, SK하이닉스 (Category: 국내주식/해외주식) -> Rank 40
    
    // 비중(가치)이 작은 종목을 아래로 놓고 (오름차순 정렬)
    items.sort((a, b) => {
      if (segName === '토스 국내') {
        const tossOrder: Record<string, number> = {
          '현대차': 1,
          '에스티팜': 2,
          '달러': 3,
          'NAVER': 4,
          '한전KPS': 5,
          '삼성전자': 6,
          '삼성전자우': 7,
          'SK하이닉스': 8,
          '예수금(현금)': 9,
          '예수금': 9,
          '현금': 9
        };
        const weightA = tossOrder[a.name] !== undefined ? tossOrder[a.name] : 100;
        const weightB = tossOrder[b.name] !== undefined ? tossOrder[b.name] : 100;
        if (weightA !== weightB) {
          return weightA - weightB;
        }
        return a.name.localeCompare(b.name);
      } else {
        // 타 계좌(신한투자 등)는 기존과 완전히 동일하게 현재 가치 오름차순 기준으로 정렬 유지
        if (a.currentValuation !== b.currentValuation) {
          return a.currentValuation - b.currentValuation;
        }
        return a.name.localeCompare(b.name);
      }
    });

    return items;
  };

  const getPortfolioItemValuationInDay = (segName: string, itemName: string, itemCurrentValuation: number, day: any) => {
    // For today (the live/current day) or the right-most day on the chart, ALWAYS prioritize the actual live valuation 
    // so changes in the accounts editor are reflected on the chart in real-time.
    const lastDayInTrends = validAccountTrends[validAccountTrends.length - 1];
    if (day.date === curDateLabel || (lastDayInTrends && day.date === lastDayInTrends.date)) {
      return itemCurrentValuation;
    }

    const storedItemKey = `${segName}_${itemName}`;
    if (day[storedItemKey] !== undefined) {
      return day[storedItemKey];
    }
    
    return 0;
  };

  const portfolioChartData = validAccountTrends.map((day, dayIdx) => {
    const formatted: any = { date: day.date };
    if (!selectedSegment) return formatted;

    const items = getSegmentPortfolioItems(selectedSegment);
    let total_val = 0;

    items.forEach(item => {
      const itemVal = getPortfolioItemValuationInDay(selectedSegment, item.name, item.currentValuation, day);
      const valInMan = Math.round(itemVal / 10000);
      formatted[item.name] = valInMan;
      total_val += valInMan;
    });

    formatted.total_val = total_val;

    let runningSum = 0;
    items.forEach(item => {
      const val = formatted[item.name] || 0;
      formatted[`${item.name}_mid`] = val > 0 ? runningSum + (val / 2) : null;
      runningSum += val;
      
      // Calculate day-over-day change rate and change amount instead of share weight
      if (dayIdx > 0) {
        const prevDay = validAccountTrends[dayIdx - 1];
        const prevItemVal = getPortfolioItemValuationInDay(selectedSegment, item.name, item.currentValuation, prevDay);
        const currentItemVal = getPortfolioItemValuationInDay(selectedSegment, item.name, item.currentValuation, day);
        if (prevItemVal > 0 && currentItemVal > 0) {
          formatted[`${item.name}_changeAmount`] = currentItemVal - prevItemVal;
          formatted[`${item.name}_changeRate`] = ((currentItemVal - prevItemVal) / prevItemVal) * 100;
        } else {
          formatted[`${item.name}_changeAmount`] = null;
          formatted[`${item.name}_changeRate`] = null;
        }
      } else {
        formatted[`${item.name}_changeAmount`] = null;
        formatted[`${item.name}_changeRate`] = null;
      }
    });

    let total_changeAmount = null;
    let total_changeRate = null;
    let decreaseLabel = '';
    if (dayIdx > 0 && total_val > 0) {
      const prevDay = validAccountTrends[dayIdx - 1];
      let prevTotalVal = 0;
      items.forEach(item => {
        const prevItemVal = getPortfolioItemValuationInDay(selectedSegment, item.name, item.currentValuation, prevDay);
        prevTotalVal += Math.round(prevItemVal / 10000);
      });
      if (prevTotalVal > 0) {
        total_changeAmount = (total_val - prevTotalVal) * 10000; // in KRW
        total_changeRate = ((total_val - prevTotalVal) / prevTotalVal) * 100;
        const diff = total_val - prevTotalVal;
        if (diff < 0) {
          const decreaseAmt = Math.abs(diff * 10000) / 1000000;
          decreaseLabel = `-${decreaseAmt.toFixed(1)}백만`;
        }
      }
    }
    formatted['total_changeAmount'] = total_changeAmount;
    formatted['total_changeRate'] = total_changeRate;
    formatted['decreaseLabel'] = decreaseLabel;

    return formatted;
  }).filter(day => {
    const match = day.date.match(/(\d+)월\s*(\d+)일/);
    if (match) {
      const month = parseInt(match[1], 10);
      const date = parseInt(match[2], 10);
      if (month === 6 && date < 8) {
        return false;
      }
    }
    return true;
  });

  const getSegmentColor = (name: string, index: number) => {
    const predefined: Record<string, string> = {
      '토스 국내': '#3b82f6',
      '토스 해외': '#f97316',
      '메리츠 주식': '#10b981',
      '한투 IRP': '#8b5cf6',
      '농협 IRP': '#db2777',
      '농협 연금': '#eab308',
      '신한투자': '#06b6d4',
      '삼성전자': '#2563eb',
      '삼성전자우': '#3b82f6',
      'SK하이닉스': '#06b6d4',
      '에스티팜': '#8b5cf6',
      '엔비디아': '#f97316',
      '달러': '#14b8a6',
      '예수금(현금)': '#64748b',
    };
    if (predefined[name]) return predefined[name];
    const alternates = ['#3b82f6', '#f97316', '#10b981', '#8b5cf6', '#eab308', '#ec4899', '#06b6d4', '#14b8a6', '#f43f5e', '#6366f1'];
    return alternates[index % alternates.length];
  };

  const AccountCustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const filteredPayload = payload.filter((entry: any) => 
        entry.dataKey !== 'total_val' && 
        !(typeof entry.dataKey === 'string' && entry.dataKey.endsWith('_mid')) &&
        entry.value !== 0
      );
      const reversedPayload = [...filteredPayload].reverse(); // Stacking order mapping
      const sum = filteredPayload.reduce((acc: number, entry: any) => acc + (entry.value || 0), 0);

      return (
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 text-white p-3.5 rounded-xl shadow-xl text-xs font-sans min-w-[200px]">
          <p className="font-bold text-slate-200 border-b border-slate-800 pb-1.5 mb-1.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            {label} {selectedSegment ? `${selectedSegment} 종목별 추이` : '계좌별 자산 추이'}
          </p>
          <div className="space-y-1.5 font-sans">
            {reversedPayload.map((entry: any) => (
              <div key={entry.name} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-slate-300 font-medium">{entry.name}</span>
                </div>
                <span className="font-mono font-bold text-slate-100">
                  ₩{(entry.value || 0).toLocaleString()}만
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-800 mt-2.5 pt-2 flex items-center justify-between text-indigo-300 font-bold font-mono">
            <span>{selectedSegment ? '계좌 합계' : '종합 자산 합계'}</span>
            <span className="text-[13px]">₩{sum.toLocaleString()}만</span>
          </div>
        </div>
      );
    }
    return null;
  };

  // Overall totals
  const totalPurchaseSum = segments.reduce((s, item) => {
    const isCustom = customBaseAmounts[item.name] !== undefined;
    const baseAmount = isCustom ? customBaseAmounts[item.name] : item.purchase;
    return s + baseAmount;
  }, 0);
  const totalValuationSum = segments.reduce((s, item) => s + item.valuation, 0);
  const totalProfitLossSum = totalValuationSum - totalPurchaseSum;
  const totalReturnPercent = totalPurchaseSum === 0 ? 0 : (totalProfitLossSum / totalPurchaseSum) * 100;

  // 2. Classify Assets for Pie Chart
  // Categories: 국내주식, 해외주식, ETF, 단기채, 금은, 현금
  const categoryTotals: Record<AssetCategory, number> = {
    '국내주식': 0,
    '해외주식': 0,
    'ETF': 0,
    '단기채': 0,
    '금은': 0,
    '현금': 0,
  };

  // Add stock valuations
  accounts.forEach((acc) => {
    acc.stocks.forEach((s) => {
      const { valuationAmount } = getStockValues(s);
      const normName = s.name.toLowerCase().trim();
      const isMMActive = normName.includes('머니마켓액티브') || normName.includes('머니마켓엑티브');
      
      if (s.category === 'ETF') {
        categoryTotals['ETF'] += valuationAmount;
      } else if (s.category === '현금' || s.category === '단기채' || isMMActive) {
        categoryTotals['현금'] += valuationAmount;
      } else {
        categoryTotals[s.category] += valuationAmount;
      }
    });
    // Add account cash directly to 현금
    categoryTotals['현금'] += acc.cash;
  });

  const chartData = Object.entries(categoryTotals)
    .map(([key, value]) => ({
      name: key,
      value: Math.round(value),
      percentage: totalValuationSum === 0 ? 0 : (value / totalValuationSum) * 100,
    }))
    .filter((d) => d.value > 0 && d.percentage >= 0.05); // Filter out 0% or close-to-zero percentage items entirely from pie chart & listing

  // Map colors to match the user's uploaded chart
  const categoryColors: Record<AssetCategory | string, string> = {
    '국내주식': '#3b82f6', // Premium Blue
    '해외주식': '#f97316', // Bright Orange
    'ETF': '#10b981', // Crisp Emerald Green
    '단기채': '#a1a1aa', // Slate Grey
    '금은': '#eab308', // Shiny gold/silver yellow
    '현금': '#60a5fa', // Vivid cyan/soft blue
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="overview-dashboard-layout">
      {/* 1. Category Asset Allocation Chart Panel */}
      <div className="lg:col-span-5 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between" id="asset-allocation-pizza-chart">
        <div>
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <Activity className="w-4 h-4" />
            </span>
            분류별 자산 포트폴리오 비중
          </h3>
          <p className="text-xs text-slate-400 mt-1">국내외 주식, 채권, 금은, 현금의 종합 실시간 투자 비율</p>
        </div>

        <div className="h-[290px] flex items-center justify-center relative my-4">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 30, bottom: 30, left: 35, right: 35 }}>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={44}
                outerRadius={65}
                paddingAngle={4}
                dataKey="value"
                nameKey="name"
                label={({ name, percentage }) => `${name} ${percentage.toFixed(1)}%`}
              >
                {chartData.map((entry) => (
                  <Cell key={`cell-${entry.name}`} fill={categoryColors[entry.name] || '#6366f1'} />
                ))}
              </Pie>
              <Tooltip
                formatter={(val: number) => [`₩${val.toLocaleString()}`, '평가금액']}
                contentStyle={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                  fontSize: '12px',
                  fontWeight: 'semibold',
                  fontFamily: 'sans-serif',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          
          {/* Central Donut Hole Valuation HUD */}
          <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none mt-1 bg-white/80 backdrop-blur-[2px] p-2 rounded-full w-[80px] h-[80px] shadow-inner border border-slate-100">
            <span className="text-[9px] uppercase font-bold tracking-widest text-slate-400">총 평가 자산</span>
            <span className="text-[13px] font-black text-slate-900 font-mono tracking-tight mt-0.5">
              ₩{Math.round(totalValuationSum / 10000).toLocaleString()}만
            </span>
          </div>
        </div>

        {/* Custom Legend / Category Breakdown */}
        <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-5 font-sans">
          {chartData.map((cat) => (
            <div key={cat.name} className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/70 hover:bg-slate-50 border border-slate-150 transition-all shadow-[0_2px_4px_rgba(0,0,0,0.02)] hover:shadow-md">
              <div className="flex items-center gap-3">
                <span
                  className="w-4.5 h-4.5 rounded-full shrink-0 shadow-sm border border-white"
                  style={{ backgroundColor: categoryColors[cat.name] }}
                />
                <span className="text-[15px] font-black text-slate-900 tracking-tight">{cat.name}</span>
              </div>
              <div className="text-right">
                <p className="text-base font-black text-indigo-950 font-mono">
                  {cat.percentage.toFixed(1)}%
                </p>
                <p className="text-xs font-bold text-slate-500 font-mono leading-none mt-0.5">
                  ₩{Math.round(cat.value / 10000).toLocaleString()}만
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Account Segment Breakdown Table (Image 2) */}
      <div className="lg:col-span-7 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between" id="account-segment-recap-box">
        <div>
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <Wallet className="w-4 h-4" />
            </span>
            계좌 구분별 자산 종합
          </h3>
          <p className="text-xs text-slate-400 mt-1">상단의 상세 주식 표와 실시간 연계된 계좌별 요약 리포트</p>
        </div>

        <div className="overflow-x-auto my-4">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-medium text-[10px] uppercase tracking-wider font-sans">
                <th className="py-3 px-3">계좌 구분</th>
                <th className="py-3 px-3 text-right w-[180px]">기초 금액 (직접입력)</th>
                <th className="py-3 px-3 text-right">현재 평가</th>
                <th className="py-3 px-3 text-right">평가 수익금</th>
                <th className="py-3 px-3 text-right">수익률</th>
                <th className="py-3 px-3 text-right">비중</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-sans">
              {segments.map((seg) => {
                const isCustom = customBaseAmounts[seg.name] !== undefined;
                const baseAmount = isCustom ? customBaseAmounts[seg.name] : seg.purchase;
                const profit = seg.valuation - baseAmount;
                const rRate = baseAmount === 0 ? 0 : (profit / baseAmount) * 100;
                const weight = totalValuationSum === 0 ? 0 : (seg.valuation / totalValuationSum) * 100;

                return (
                  <tr key={seg.name} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-3 font-semibold text-slate-700">{seg.name}</td>
                    <td className="py-3.5 px-3 text-right font-mono text-slate-500">
                      <div className="flex items-center justify-end gap-1.5 max-w-[170px] ml-auto">
                        <div className="relative flex items-center bg-slate-50 hover:bg-slate-100/50 border border-slate-200 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 rounded-lg px-2 py-0.5 transition-all h-8">
                          <span className="text-slate-400 font-mono text-[10px] select-none mr-0.5">₩</span>
                          <input
                            type="number"
                            className="bg-transparent border-none outline-none text-right font-mono text-xs font-semibold text-slate-700 w-24 p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:ring-0"
                            value={isCustom ? customBaseAmounts[seg.name] : Math.round(seg.purchase)}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '') {
                                handleBaseAmountChange(seg.name, 0);
                              } else {
                                handleBaseAmountChange(seg.name, parseInt(val, 10));
                              }
                            }}
                          />
                        </div>
                        {isCustom && (
                          <button
                            onClick={() => handleResetBaseAmount(seg.name)}
                            title="자동 계산값으로 복원"
                            className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-medium text-slate-800">
                      ₩{Math.round(seg.valuation).toLocaleString()}
                    </td>
                    <td className={`py-3.5 px-3 text-right font-mono font-medium ${
                      profit > 10 ? 'text-rose-600' : profit < -10 ? 'text-blue-600' : 'text-slate-500'
                    }`}>
                      {profit > 10 ? '+' : ''}
                      {Math.round(profit).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        profit > 10 ? 'bg-rose-50 text-rose-600' : profit < -10 ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-500'
                      }`}>
                        {rRate > 0 ? '+' : ''}
                        {rRate.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-700">
                      {weight.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}

              {/* Total Aggregate Row */}
              <tr className="bg-slate-900 text-white font-semibold rounded-lg font-mono">
                <td className="py-4 px-3 rounded-l-xl font-bold bg-slate-950">종합 합계 (Total)</td>
                <td className="py-4 px-3 text-right text-slate-300">
                  ₩{Math.round(totalPurchaseSum).toLocaleString()}
                </td>
                <td className="py-4 px-3 text-right font-bold text-white text-sm">
                  ₩{Math.round(totalValuationSum).toLocaleString()}
                </td>
                <td className={`py-4 px-3 text-right font-bold ${
                  totalProfitLossSum > 0 ? 'text-rose-400' : totalProfitLossSum < 0 ? 'text-blue-400' : 'text-slate-300'
                }`}>
                  {totalProfitLossSum > 0 ? '+' : ''}
                  {Math.round(totalProfitLossSum).toLocaleString()}
                </td>
                <td className="py-4 px-3 text-right">
                  <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-extrabold ${
                    totalProfitLossSum > 0 ? 'bg-rose-500 text-white' : totalProfitLossSum < 0 ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300'
                  }`}>
                    {totalReturnPercent > 0 ? '+' : ''}
                    {totalReturnPercent.toFixed(2)}%
                  </span>
                </td>
                <td className="py-4 px-3 text-right rounded-r-xl font-bold">100.0%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. 계좌별 일별 자산 증감 및 추이 대시보드 */}
      <div className="lg:col-span-12 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mt-2 flex flex-col space-y-6" id="account-daily-trends-dashboard">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <Activity className="w-4 h-4" />
              </span>
              {selectedSegment ? `${selectedSegment} 일별 포트폴리오 자산 추이` : '계좌별 일별 자산 추이'}
            </h3>
            <p className="text-xs text-slate-400">
              {selectedSegment 
                ? `${selectedSegment} 계좌 개별 종목들의 일자별 누적 자산 변동 및 축적 추이입니다.`
                : '계좌 구분을 기준으로 일별 누적 자산 변동 및 축적 추이입니다.'
              }
            </p>
          </div>
          
          {/* Header Controls: All Accounts Button + Start Date Badge */}
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
            <button
              onClick={() => setSelectedSegment(null)}
              className={`text-[11px] font-sans font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all shadow-sm cursor-pointer ${
                selectedSegment === null
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo-150'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>전체계좌</span>
            </button>
            <div className="text-[11px] font-mono font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-150 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              <span>시작일: 2026년 6월 8일</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Chart Area */}
          <div className="xl:col-span-10 h-[480px] sm:h-[540px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart 
                data={selectedSegment ? portfolioChartData : accountChartData} 
                margin={{ top: 52, right: 35, left: 20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} dy={8} />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(val) => `₩${val.toLocaleString()}만`}
                  dx={-5}
                />
                <Tooltip content={<AccountCustomTooltip />} />
                
                {(selectedSegment 
                  ? getSegmentPortfolioItems(selectedSegment).map((item) => ({ name: item.name }))
                  : segments.map((seg) => ({ name: seg.name }))
                ).map((barItem, idx) => (
                  <Bar 
                    key={barItem.name}
                    dataKey={barItem.name}
                    stackId="acc-portfolio-stack"
                    fill={getSegmentColor(barItem.name, idx)}
                    maxBarSize={45}
                  />
                ))}

                <Line 
                  type="monotone"
                  dataKey="total_val"
                  stroke="#4338ca"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#4338ca", stroke: "#ffffff", strokeWidth: 1.5 }}
                  activeDot={{ r: 6 }}
                  name="총 자산"
                  label={<TotalAssetCustomizedLabel data={selectedSegment ? portfolioChartData : accountChartData} />}
                />

                {/* Overlaid Midpoint Trend Lines with Connected Dots and Daily Share Weights - Line hidden but labels preserved */}
                {(selectedSegment 
                  ? getSegmentPortfolioItems(selectedSegment).map((item) => ({ name: item.name }))
                  : segments.map((seg) => ({ name: seg.name }))
                ).map((barItem, idx, arr) => (
                  <Line 
                    key={`${barItem.name}_mid`}
                    type="monotone"
                    dataKey={`${barItem.name}_mid`}
                    connectNulls={true}
                    stroke="transparent"
                    strokeWidth={0}
                    dot={false}
                    activeDot={false}
                    label={
                      <AssetCustomizedLabel 
                        dataKey={`${barItem.name}_mid`} 
                        data={selectedSegment ? portfolioChartData : accountChartData} 
                        itemsList={arr.map(item => item.name)} 
                      />
                    }
                    legendType="none"
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Real-time Changes Stats Cards Container */}
          <div className="xl:col-span-2 space-y-2.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">계좌별 전일 대비 증감 (Daily Delta)</span>
            <div className="grid grid-cols-1 gap-2 border-l border-slate-100 pl-1">
              {segments.map((seg, idx) => {
                const { change, percent } = getSegmentDailyChange(seg.name);
                const color = getSegmentColor(seg.name, idx);
                const isPositive = change > 0;
                const isNegative = change < 0;
                const isSelected = selectedSegment === seg.name;

                return (
                  <button
                    key={seg.name}
                    id={`seg-delta-button-${seg.name}`}
                    onClick={() => setSelectedSegment(selectedSegment === seg.name ? null : seg.name)}
                    className={`w-full text-left flex flex-col sm:flex-row xl:flex-col gap-1.5 p-2 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-400/20 shadow-md'
                        : 'bg-slate-50 border border-slate-150 hover:bg-slate-50 hover:border-slate-300 shadow-[0_1px_2px_rgba(0,0,0,0.01)] hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 w-full justify-between sm:justify-start xl:justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: color }} />
                        <span className={`text-[11px] font-bold truncate ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
                          {seg.name}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] font-bold text-slate-900 shrink-0">
                        ₩{Math.round(seg.valuation).toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="flex items-center xl:self-end justify-between sm:justify-end xl:justify-end w-full sm:w-auto xl:w-full">
                      <span className="sm:hidden xl:hidden text-[9px] text-slate-400">전일대비:</span>
                      {change !== 0 ? (
                        <div className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold ${
                          isPositive ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
                        }`}>
                          {isPositive ? <TrendingUp className="w-2.5 h-2.5 text-rose-500" /> : <TrendingDown className="w-2.5 h-2.5 text-blue-500" />}
                          <span>{isPositive ? '+' : ''}{Math.round(change/10000).toLocaleString()}만 ({isPositive ? '+' : ''}{percent.toFixed(1)}%)</span>
                        </div>
                      ) : (
                        <span className="text-[9px] text-slate-400 font-bold bg-slate-100 px-1.5 py-0.5 rounded font-mono">-</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
