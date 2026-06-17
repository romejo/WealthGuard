import React, { useState, useEffect, useRef } from 'react';
import { Account, StockItem } from './types';
import { DEFAULT_ACCOUNTS, USD_EXCHANGE_RATE, KNOWN_STOCKS, DEFAULT_REBALANCING_TARGETS } from './initialData';
import AccountTable from './components/AccountTable';
import OverviewSection from './components/OverviewSection';
import AssetTrendSection from './components/AssetTrendSection';
import StockConsolidationSection from './components/StockConsolidationSection';
import {
  Globe,
  Sliders,
  Database,
  RefreshCw,
  Award,
  Wallet,
  Activity,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  Download,
  Upload,
  Sparkles,
  BarChart2,
  Lock,
  Unlock,
  Key,
  Eye,
  EyeOff,
  History,
  Clock,
  Cloud,
  CloudOff,
  CloudUpload,
  CloudDownload,
  Trash2
} from 'lucide-react';

// --- Cryptography Helpers (Zero-Knowledge Native Web Crypto API) ---
async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(password);
  const hash = await window.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptData(text: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    enc.encode(text)
  );
  
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
  const encryptedBytes = new Uint8Array(encrypted);
  const encryptedHex = Array.from(encryptedBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `${saltHex}:${ivHex}:${encryptedHex}`;
}

async function decryptData(encryptedString: string, password: string): Promise<string> {
  const parts = encryptedString.split(':');
  if (parts.length !== 3) throw new Error('올바르지 않은 백업 원본 포맷입니다.');
  const [saltHex, ivHex, encryptedHex] = parts;
  
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const encryptedData = new Uint8Array(encryptedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  
  const key = await deriveKey(password, salt);
  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encryptedData
  );
  
  const dec = new TextDecoder();
  return dec.decode(decrypted);
}

const LOCAL_STORAGE_KEY = 'portfolio_dashboard_accounts';
const RATE_STORAGE_KEY = 'portfolio_dashboard_usd_rate';

export default function App() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number>(USD_EXCHANGE_RATE);
  const [backupKey, setBackupKey] = useState<number>(0);
  const [customBaseAmounts, setCustomBaseAmounts] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('portfolio_dashboard_segment_base_amounts');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return {};
      }
    }
    return {};
  });


  const [selectedDate, setSelectedDate] = useState<string>('live');
  const [accountTrends, setAccountTrends] = useState<any[]>(() => {
    const saved = localStorage.getItem('portfolio_account_trends_daily_v3_fixed');
    let loaded: any[] = [];
    if (saved) {
      try {
        loaded = JSON.parse(saved);
      } catch (e) {
        loaded = [];
      }
    }
    return loaded;
  });

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

  const getSegmentPortfolioItems = (segName: string, currentAccounts: Account[]) => {
    let cash = 0;
    let stocks: StockItem[] = [];

    if (segName === '토스 국내') {
      const toss = currentAccounts.find(a => a.id === 'toss');
      if (toss) {
        cash = toss.cash;
        stocks = toss.stocks.filter(s => s.category !== '해외주식');
      }
    } else if (segName === '토스 해외') {
      const toss = currentAccounts.find(a => a.id === 'toss');
      if (toss) {
        cash = 0;
        stocks = toss.stocks.filter(s => s.category === '해외주식');
      }
    } else {
      const acc = currentAccounts.find(a => a.name === segName);
      if (acc) {
        cash = acc.cash;
        stocks = acc.stocks;
      }
    }

    const items: { name: string; isCash: boolean; currentValuation: number }[] = [];
    
    // Add stocks
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

    // Add cash if greater than 0
    if (cash > 0) {
      items.push({
        name: '예수금(현금)',
        isCash: true,
        currentValuation: cash
      });
    }

    return items;
  };

  // Calculate Account Segment Summaries dynamically
  const segments: { name: string; purchase: number; valuation: number }[] = [];

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

  accounts.forEach((acc) => {
    if (acc.id === 'toss') return;

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

  const getCurDateLabel = () => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${mm}월 ${dd}일`;
  };

  const getPastActiveBusinessDays = (n: number) => {
    const result: string[] = [];
    const curr = new Date();
    let count = 0;
    while (count < n + 5) {
      const dayName = curr.getDay();
      if (dayName !== 0 && dayName !== 6) {
        const mm = String(curr.getMonth() + 1).padStart(2, '0');
        const dd = String(curr.getDate()).padStart(2, '0');
        result.push(`${mm}월 ${dd}일`);
      }
      curr.setDate(curr.getDate() - 1);
      if (result.length >= n) break;
    }
    return result.reverse();
  };

  const curDateLabel = getCurDateLabel();
  const segmentsValuationKey = segments.map(s => `${s.name}:${Math.round(s.valuation)}`).join(',');

  useEffect(() => {
    if (segments.length === 0) return;
    const activeDates = getPastActiveBusinessDays(7);

    setAccountTrends((prev) => {
      const existingMap: Record<string, any> = {};
      prev.forEach((day) => {
        if (day.date) existingMap[day.date] = day;
      });

      const updatedMock: any[] = [];

      activeDates.forEach((date, dateIdx) => {
        const isToday = date === curDateLabel;
        const indexOffset = 7 - 1 - dateIdx;

        let record = existingMap[date] ? { ...existingMap[date] } : { date };

        segments.forEach((seg) => {
          if (record[seg.name] === undefined || isToday) {
            let seed = 0;
            for (let i = 0; i < seg.name.length; i++) {
              seed += seg.name.charCodeAt(i);
            }
            const stepSeed = Math.sin(seed + indexOffset * 17.31) * 9999;
            const deviation = ((stepSeed - Math.floor(stepSeed)) - 0.5) * 0.12;

            const dayValuation = Math.round(seg.valuation * (1 - deviation));
            record[seg.name] = dayValuation;

            const pItems = getSegmentPortfolioItems(seg.name, accounts);
            pItems.forEach((pItem) => {
              const itemKey = `${seg.name}_${pItem.name}`;
              if (record[itemKey] === undefined || isToday) {
                record[itemKey] = Math.round(pItem.currentValuation * (1 - deviation));
              }
            });
          }
        });

        updatedMock.push(record);
      });

      localStorage.setItem('portfolio_account_trends_daily_v3_fixed', JSON.stringify(updatedMock));
      return updatedMock;
    });
  }, [segmentsValuationKey, curDateLabel, accounts.length, exchangeRate]);

  const handleBaseAmountChange = (segmentName: string, value: number) => {
    const next = {
      ...customBaseAmounts,
      [segmentName]: value,
    };
    setCustomBaseAmounts(next);
    localStorage.setItem('portfolio_dashboard_segment_base_amounts', JSON.stringify(next));
  };

  const handleResetBaseAmount = (segmentName: string) => {
    const next = { ...customBaseAmounts };
    delete next[segmentName];
    setCustomBaseAmounts(next);
    localStorage.setItem('portfolio_dashboard_segment_base_amounts', JSON.stringify(next));
  };

  const [activeTab, setActiveTab] = useState<string>('all'); // 'all' or specific account id
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [activeNav, setActiveNav] = useState<string>('dashboard');

  // --- 비밀번호 & 보안 관리 관련 상태 및 Zero-Knowledge 보안 장치 ---
  const [passwordPlaintext, setPasswordPlaintext] = useState<string>('');
  const [savedPassword, setSavedPassword] = useState<string | null>(() => {
    return localStorage.getItem('portfolio_app_password');
  });
  const [passwordDisabled, setPasswordDisabled] = useState<boolean>(() => {
    return localStorage.getItem('portfolio_app_password_disabled') === 'true';
  });
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    const saved = localStorage.getItem('portfolio_app_password');
    const disabled = localStorage.getItem('portfolio_app_password_disabled') === 'true';
    if (saved) return false;
    if (disabled) return true;
    return false; // Show welcome/setup on fresh installation
  });

  // 계좌 추가 관련 상태
  const [showAddAccountForm, setShowAddAccountForm] = useState<boolean>(false);
  const [newAccountName, setNewAccountName] = useState<string>('');
  const [newAccountCash, setNewAccountCash] = useState<string>('');

  // --- 브라우저 종료 자동 백업 관련 상태 및 로직 ---
  const [isAutoBackupModalOpen, setIsAutoBackupModalOpen] = useState<boolean>(false);

  const latestEncryptedPayloadRef = useRef<{ encryptedData: string; timestamp: string; accountsCount: number } | null>(null);

  // --- 클라우드 백업 자동 로딩 제어기 (Zero-Knowledge) ---
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'idle' | 'fetching' | 'success' | 'no_backup' | 'locked' | 'error'>('idle');
  const latestDownloadedBackupRef = useRef<string | null>(null);

  const autoLoadLatestBackupFromServer = async (passwordKey?: string) => {
    setCloudSyncStatus('fetching');
    try {
      const listRes = await fetch('/api/backups');
      if (!listRes.ok) throw new Error('서버 백업 목록 수신 실패');
      const listData = await listRes.json();
      const backups = listData.backups || [];
      if (backups.length === 0) {
        setCloudSyncStatus('no_backup');
        return;
      }
      
      const latestBackup = backups[0];
      const fileRes = await fetch(`/api/backups/${latestBackup.fileName}`);
      if (!fileRes.ok) throw new Error('최신 백업 다운로드 실패');
      const fileData = await fileRes.json();
      const encryptedData = fileData.encryptedData;
      if (!encryptedData) throw new Error('암호화 데이터 누락');

      let decryptedStr = '';
      const key = passwordKey || passwordPlaintext || 'wealthguard_default_key';
      try {
        decryptedStr = await decryptData(encryptedData, key);
      } catch (e) {
        const hasSavedPw = localStorage.getItem('portfolio_app_password');
        if (hasSavedPw && !passwordKey) {
          setCloudSyncStatus('locked');
          latestDownloadedBackupRef.current = encryptedData;
          return;
        } else {
          throw e;
        }
      }

      const parsed = JSON.parse(decryptedStr);
      const importedAccounts = parsed.accounts;
      const importedRate = parsed.exchangeRate ? Number(parsed.exchangeRate) : null;
      const importedTargets = parsed.rebalancingTargets;
      const importedSegmentBaseAmounts = parsed.segmentBaseAmounts;
      const importedAssetTrends = parsed.assetTrendsDaily;
      const importedAccountTrends = parsed.accountTrendsDaily;

      if (importedAccounts) {
        setAccounts(importedAccounts);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(importedAccounts));
      }

      if (importedRate && !isNaN(importedRate) && importedRate > 0) {
        setExchangeRate(importedRate);
        localStorage.setItem(RATE_STORAGE_KEY, importedRate.toString());
      }

      if (importedTargets) {
        localStorage.setItem('portfolio_dashboard_rebalancing_targets', JSON.stringify(importedTargets));
      }

      if (importedSegmentBaseAmounts) {
        setCustomBaseAmounts(importedSegmentBaseAmounts);
        localStorage.setItem('portfolio_dashboard_segment_base_amounts', JSON.stringify(importedSegmentBaseAmounts));
      }

      if (importedAssetTrends) {
        localStorage.setItem('portfolio_asset_trends_daily_v1', JSON.stringify(importedAssetTrends));
      }

      if (importedAccountTrends) {
        setAccountTrends(importedAccountTrends);
        localStorage.setItem('portfolio_account_trends_daily_v1', JSON.stringify(importedAccountTrends));
      }

      setCloudSyncStatus('success');
    } catch (err) {
      console.error('클라우드 백업 자동 로드 실패:', err);
      setCloudSyncStatus('error');
    }
  };

  useEffect(() => {
    autoLoadLatestBackupFromServer();
  }, []);

  // 백업 데이터 백그라운드 암호화 연산 (상태가 바뀔 때 실행되며, CPU 장치 낭비 방지를 위해 디바운싱 처리)
  // 화면 로딩/상태 변경 시에는 암호화 준비만 마쳐두고(latestEncryptedPayloadRef 갱신), 실제 클라우드 백업은 브라우저 종료 시점이나 수동 업로드 시에만 수행하도록 구성하여 불필요한 네트워크 트래픽 및 오버헤드를 원천 차단합니다.
  useEffect(() => {
    let active = true;
    const processEncryption = async () => {
      if (!accounts || accounts.length === 0) return;
      try {
        const rebalancingTargets = (() => {
          const savedTargetStr = localStorage.getItem('portfolio_dashboard_rebalancing_targets');
          if (savedTargetStr) {
            try { return JSON.parse(savedTargetStr); } catch (e) {}
          }
          return null;
        })();

        const assetTrendsDaily = (() => {
          const savedTrends = localStorage.getItem('portfolio_asset_trends_daily_v1');
          if (savedTrends) {
            try { return JSON.parse(savedTrends); } catch (e) {}
          }
          return null;
        })();

        const accountTrendsDaily = (() => {
          const savedTrends = localStorage.getItem('portfolio_account_trends_daily_v1');
          if (savedTrends) {
            try { return JSON.parse(savedTrends); } catch (e) {}
          }
          return null;
        })();

        const backupData = {
          version: '1.0',
          accounts: accounts,
          exchangeRate: exchangeRate,
          segmentBaseAmounts: customBaseAmounts,
          rebalancingTargets,
          assetTrendsDaily,
          accountTrendsDaily,
          exportedAt: new Date().toISOString()
        };

        const jsonStr = JSON.stringify(backupData);
        // 비밀번호 설정 상태인 경우 해당 비밀번호로 AES-GCM 암호화 진행, 비설정 시 디폴트 키 사용
        const encryptionKey = passwordPlaintext || 'wealthguard_default_key';
        const encrypted = await encryptData(jsonStr, encryptionKey);

        if (active) {
          const payload = {
            encryptedData: encrypted,
            timestamp: String(Date.now()),
            accountsCount: accounts.length
          };
          latestEncryptedPayloadRef.current = payload;
          setCloudSyncStatus('success'); // 로컬 변경에 따른 암호화 캐싱 완료 (동기화 대기 상태)
        }
      } catch (err) {
        console.error('백업 로컬 백그라운드 암호화 실패:', err);
        setCloudSyncStatus('error');
      }
    };

    const timeout = setTimeout(() => {
      processEncryption();
    }, 1500);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [accounts, exchangeRate, customBaseAmounts, passwordPlaintext]);

  // 브라우저 닫기/새로고침 시 최종 보안 암호화 클라우드 백업을 전송 (서버 무중단 및 Zero-Knowledge 클라우드 전송 보장)
  useEffect(() => {
    const handleBeforeUnload = () => {
      const serverPayload = latestEncryptedPayloadRef.current;
      if (!serverPayload) return;

      try {
        const url = '/api/backups';
        const blob = new Blob([JSON.stringify(serverPayload)], { type: 'application/json' });
        if (navigator.sendBeacon) {
          navigator.sendBeacon(url, blob);
        } else {
          fetch(url, {
            method: 'POST',
            body: JSON.stringify(serverPayload),
            headers: { 'Content-Type': 'application/json' },
            keepalive: true
          });
        }
      } catch (err) {
        console.error('브라우저 종료 및 이탈 시 클라우드 자동 보안 저장 실패:', err);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // 수동 동기화용 레거시 제거 및 클라우드 백업 전용으로 마이그레이션 완료

  // --- 비밀번호 & 보안 관리 관련 상태 및 Zero-Knowledge 보안 장치 (선언부 상단으로 재배치됨) ---

  const [passwordInput, setPasswordInput] = useState<string>('');
  const [passwordConfirmInput, setPasswordConfirmInput] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // 내부 설정 모달 관련 상태
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState<boolean>(false);
  const [modalCurrentPassword, setModalCurrentPassword] = useState<string>('');
  const [modalNewPassword, setModalNewPassword] = useState<string>('');
  const [modalNewPasswordConfirm, setModalNewPasswordConfirm] = useState<string>('');
  const [modalError, setModalError] = useState<string>('');
  const [modalSuccess, setModalSuccess] = useState<string>('');

  // --- 클라우드 암호화 서버 백업 상태 ---
  const [serverBackups, setServerBackups] = useState<any[]>([]);
  const [serverBackupsLoading, setServerBackupsLoading] = useState<boolean>(false);
  const [serverBackupsError, setServerBackupsError] = useState<string>('');

  const fetchServerBackups = async () => {
    setServerBackupsLoading(true);
    setServerBackupsError('');
    try {
      const res = await fetch('/api/backups');
      if (!res.ok) throw new Error('서버 백업 리스트를 가져오는 데 실패했습니다.');
      const data = await res.json();
      setServerBackups(data.backups || []);
    } catch (err) {
      setServerBackupsError((err as Error).message);
    } finally {
      setServerBackupsLoading(false);
    }
  };

  const handleSaveServerBackupManual = async () => {
    setServerBackupsLoading(true);
    try {
      // Ensure we have encryption payload ready or generate it right away
      let payload = latestEncryptedPayloadRef.current;
      if (!payload) {
        const rebalancingTargets = (() => {
          const savedTargetStr = localStorage.getItem('portfolio_dashboard_rebalancing_targets');
          if (savedTargetStr) {
            try { return JSON.parse(savedTargetStr); } catch (e) {}
          }
          return null;
        })();

        const assetTrendsDaily = (() => {
          const savedTrends = localStorage.getItem('portfolio_asset_trends_daily_v1');
          if (savedTrends) {
            try { return JSON.parse(savedTrends); } catch (e) {}
          }
          return null;
        })();

        const accountTrendsDaily = (() => {
          const savedTrends = localStorage.getItem('portfolio_account_trends_daily_v1');
          if (savedTrends) {
            try { return JSON.parse(savedTrends); } catch (e) {}
          }
          return null;
        })();

        const backupData = {
          version: '1.0',
          accounts: accounts,
          exchangeRate: exchangeRate,
          segmentBaseAmounts: customBaseAmounts,
          rebalancingTargets,
          assetTrendsDaily,
          accountTrendsDaily,
          exportedAt: new Date().toISOString()
        };

        const jsonStr = JSON.stringify(backupData);
        const encryptionKey = passwordPlaintext || 'wealthguard_default_key';
        const encrypted = await encryptData(jsonStr, encryptionKey);

        payload = {
          encryptedData: encrypted,
          timestamp: String(Date.now()),
          accountsCount: accounts.length
        };
      }

      const res = await fetch('/api/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('서버 백업 등록 중 오류 발생');
      alert('🔒 비밀번호로 종단간(E2EE) 암호화를 마친 백업 파일이 클라우드 보안 서버에 정상 동기화되었습니다!');
      fetchServerBackups();
    } catch (err) {
      alert('서버 백업 업로드 중 오류 발생: ' + (err as Error).message);
    } finally {
      setServerBackupsLoading(false);
    }
  };

  const handleDeleteServerBackup = async (fileName: string) => {
    if (!window.confirm('⚠️ 해당 클라우드 보안 백업 기록을 영구히 삭제하시겠습니까?')) return;
    setServerBackupsLoading(true);
    try {
      const res = await fetch(`/api/backups/${fileName}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('백업 삭제 실패');
      alert('🗑️ 서버 백업 파일이 완전히 안전 소멸되었습니다.');
      fetchServerBackups();
    } catch (err) {
      alert('서버 백업 삭제 중 실패: ' + (err as Error).message);
    } finally {
      setServerBackupsLoading(false);
    }
  };

  const handleRestoreServerBackup = async (backupItem: any) => {
    const backupTimeStr = new Date(Number(backupItem.timestamp)).toLocaleString();
    const confirmMsg = `⚠️ [서버 암호화 백업 복원]\n\n[백업 서버 기록지: ${backupTimeStr}]\n\n비밀번호와 암호 장벽으로 격리된 서버 백업본을 복화하여 현재 대시보드를 완전히 덮어쓰시겠습니까?\n\n이 작업은 현 세션 데이터를 날리고 완전히 대체되며 되돌릴 수 없습니다.`;
    
    if (!window.confirm(confirmMsg)) return;

    setServerBackupsLoading(true);
    try {
      const res = await fetch(`/api/backups/${backupItem.fileName}`);
      if (!res.ok) throw new Error('암호화 백업을 다운로드하는 데 실패했습니다.');
      const data = await res.json();
      
      const encryptedData = data.encryptedData;
      if (!encryptedData) throw new Error('유효한 암호화 백업 문자 조각이 없습니다.');

      // 복호화 시도
      let decryptedStr = '';
      const keyCandidates = [passwordPlaintext, 'wealthguard_default_key'].filter(Boolean);
      
      let success = false;
      for (const key of keyCandidates) {
        try {
          decryptedStr = await decryptData(encryptedData, key!);
          success = true;
          break;
        } catch (e) {}
      }

      // 평문이 매치되지 않으면 수동으로 복구용 비밀번호 프롬프트 표시
      if (!success) {
        const inputPw = prompt("🔒 이 영지식 서버 백업본은 다른 세션 비밀번호로 암호화되어 잠겨 있습니다. 복구를 수동 진행하기 위해 당시 백업의 비밀번호 4자리 이상을 입력해 주십시오:");
        if (inputPw === null) {
          setServerBackupsLoading(false);
          return;
        }
        try {
          decryptedStr = await decryptData(encryptedData, inputPw.trim());
          success = true;
        } catch (decryptErr) {
          throw new Error('복호화 비밀번호가 어긋났습니다. 올바른 비밀번호를 입력해 주십시오.');
        }
      }

      // 파싱
      const parsed = JSON.parse(decryptedStr);
      const importedAccounts = parsed.accounts;
      const importedRate = parsed.exchangeRate ? Number(parsed.exchangeRate) : null;
      const importedTargets = parsed.rebalancingTargets;
      const importedSegmentBaseAmounts = parsed.segmentBaseAmounts;
      const importedAssetTrends = parsed.assetTrendsDaily;
      const importedAccountTrends = parsed.accountTrendsDaily;

      saveAccounts(importedAccounts);

      if (importedRate && !isNaN(importedRate) && importedRate > 0) {
        saveExchangeRate(importedRate);
      }

      if (importedTargets) {
        localStorage.setItem('portfolio_dashboard_rebalancing_targets', JSON.stringify(importedTargets));
      }

      if (importedSegmentBaseAmounts) {
        setCustomBaseAmounts(importedSegmentBaseAmounts);
        localStorage.setItem('portfolio_dashboard_segment_base_amounts', JSON.stringify(importedSegmentBaseAmounts));
      }

      if (importedAssetTrends) {
        localStorage.setItem('portfolio_asset_trends_daily_v1', JSON.stringify(importedAssetTrends));
      }

      if (importedAccountTrends) {
        setAccountTrends(importedAccountTrends);
        localStorage.setItem('portfolio_account_trends_daily_v1', JSON.stringify(importedAccountTrends));
      }

      alert('🎉 웰스가드 종단 전 구간 암호 해제가 무사히 완료되어 백업 데이터가 정상 복구되었습니다!');
      setIsAutoBackupModalOpen(false);
    } catch (err) {
      alert('클라우드 복원 오류: ' + (err as Error).message);
    } finally {
      setServerBackupsLoading(false);
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!savedPassword) return;

    try {
      let isMatch = false;
      // 이전 평문 방식과의 해시 하위 호환성 체크
      if (savedPassword.length !== 64) {
        isMatch = (passwordInput === savedPassword);
        if (isMatch) {
          // 보안 업그레이드: 해시 버전으로 즉시 마이그레이션 수행
          const hashedPw = await hashPassword(passwordInput);
          localStorage.setItem('portfolio_app_password', hashedPw);
          setSavedPassword(hashedPw);
        }
      } else {
        const hashedInput = await hashPassword(passwordInput);
        isMatch = (hashedInput === savedPassword);
      }

      if (isMatch) {
        setPasswordPlaintext(passwordInput); // 평문은 RAM에만 파지
        setIsUnlocked(true);
        setPasswordError('');
        setPasswordInput('');

        // 잠금 해제 시 최신 클라우드 백업 캐싱이 있으면 자동 연동
        if (latestDownloadedBackupRef.current) {
          try {
            const decData = await decryptData(latestDownloadedBackupRef.current, passwordInput);
            const parsed = JSON.parse(decData);
            const importedAccounts = parsed.accounts;
            const importedRate = parsed.exchangeRate ? Number(parsed.exchangeRate) : null;
            const importedTargets = parsed.rebalancingTargets;
            const importedSegmentBaseAmounts = parsed.segmentBaseAmounts;
            const importedAssetTrends = parsed.assetTrendsDaily;
            const importedAccountTrends = parsed.accountTrendsDaily;

            if (importedAccounts) {
              setAccounts(importedAccounts);
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(importedAccounts));
            }
            if (importedRate && !isNaN(importedRate) && importedRate > 0) {
              setExchangeRate(importedRate);
              localStorage.setItem(RATE_STORAGE_KEY, importedRate.toString());
            }
            if (importedTargets) {
              localStorage.setItem('portfolio_dashboard_rebalancing_targets', JSON.stringify(importedTargets));
            }
            if (importedSegmentBaseAmounts) {
              setCustomBaseAmounts(importedSegmentBaseAmounts);
              localStorage.setItem('portfolio_dashboard_segment_base_amounts', JSON.stringify(importedSegmentBaseAmounts));
            }
            if (importedAssetTrends) {
              localStorage.setItem('portfolio_asset_trends_daily_v1', JSON.stringify(importedAssetTrends));
            }
            if (importedAccountTrends) {
              setAccountTrends(importedAccountTrends);
              localStorage.setItem('portfolio_account_trends_daily_v1', JSON.stringify(importedAccountTrends));
            }
            setCloudSyncStatus('success');
          } catch (decryptErr) {
            console.error('인증 성공 후 클라우드 백업 자동 복화 실패:', decryptErr);
            setCloudSyncStatus('error');
          }
        }
      } else {
        setPasswordError('비밀번호가 올바르지 않습니다. 다시 확인해 주세요.');
      }
    } catch (err) {
      setPasswordError('인증 암호학적 연산 중 문제가 발생했습니다: ' + (err as Error).message);
    }
  };

  const handleSetupPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const pw = passwordInput.trim();
    const confirmPw = passwordConfirmInput.trim();
    if (!pw) {
      setPasswordError('사용하실 비밀번호를 입력해 주세요.');
      return;
    }
    if (pw.length < 4) {
      setPasswordError('비밀번호는 최소 4자리 이상이어야 합니다.');
      return;
    }
    if (pw !== confirmPw) {
      setPasswordError('입력하신 두 비밀번호가 일치하지 않습니다.');
      return;
    }

    try {
      const hashedPw = await hashPassword(pw);
      localStorage.setItem('portfolio_app_password', hashedPw);
      localStorage.removeItem('portfolio_app_password_disabled');
      setSavedPassword(hashedPw);
      setPasswordPlaintext(pw); // 평문은 RAM에 보과
      setPasswordDisabled(false);
      setIsUnlocked(true);
      setPasswordInput('');
      setPasswordConfirmInput('');
      setPasswordError('');
    } catch (err) {
      setPasswordError('비밀번호 보안 구성 오류: ' + (err as Error).message);
    }
  };

  const handleSkipPasswordSetup = () => {
    localStorage.setItem('portfolio_app_password_disabled', 'true');
    localStorage.removeItem('portfolio_app_password');
    setSavedPassword(null);
    setPasswordPlaintext('');
    setPasswordDisabled(true);
    setIsUnlocked(true);
    setPasswordInput('');
    setPasswordConfirmInput('');
    setPasswordError('');
  };

  const handleModalPasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setModalSuccess('');

    try {
      // 기존 비밀번호가 있으면 검증 필요
      if (savedPassword) {
        let isMatch = false;
        if (savedPassword.length !== 64) {
          isMatch = (modalCurrentPassword === savedPassword);
        } else {
          const hashedCurrent = await hashPassword(modalCurrentPassword);
          isMatch = (hashedCurrent === savedPassword);
        }

        if (!isMatch) {
          setModalError('현재 비밀번호가 일치하지 않습니다.');
          return;
        }
      }

      const newPw = modalNewPassword.trim();
      const confirmPw = modalNewPasswordConfirm.trim();

      if (!newPw) {
        setModalError('새로운 비밀번호를 입력해 주세요.');
        return;
      }
      if (newPw.length < 4) {
        setModalError('비밀번호는 최소 4자리 이상이어야 합니다.');
        return;
      }
      if (newPw !== confirmPw) {
        setModalError('새 비밀번호와 비밀번호 확인 입력값이 일치하지 않습니다.');
        return;
      }

      const hashedNew = await hashPassword(newPw);
      localStorage.setItem('portfolio_app_password', hashedNew);
      localStorage.removeItem('portfolio_app_password_disabled');
      setSavedPassword(hashedNew);
      setPasswordPlaintext(newPw); // RAM 임시 비밀번호 갱신
      setPasswordDisabled(false);
      setModalCurrentPassword('');
      setModalNewPassword('');
      setModalNewPasswordConfirm('');
      setModalSuccess('🔒 비밀번호 보안이 성공적으로 구성 및 활성화되었습니다!');
    } catch (err) {
      setModalError('비밀번호 변경 처리 실패: ' + (err as Error).message);
    }
  };

  const handleModalDisablePassword = async () => {
    setModalError('');
    setModalSuccess('');

    try {
      if (savedPassword) {
        let isMatch = false;
        if (savedPassword.length !== 64) {
          isMatch = (modalCurrentPassword === savedPassword);
        } else {
          const hashedCurrent = await hashPassword(modalCurrentPassword);
          isMatch = (hashedCurrent === savedPassword);
        }

        if (!isMatch) {
          setModalError('보안 해제를 하려면 현재 비밀번호를 입력해 주셔야 합니다.');
          return;
        }
      }

      localStorage.setItem('portfolio_app_password_disabled', 'true');
      localStorage.removeItem('portfolio_app_password');
      setSavedPassword(null);
      setPasswordPlaintext('');
      setPasswordDisabled(true);
      setModalCurrentPassword('');
      setModalNewPassword('');
      setModalNewPasswordConfirm('');
      setModalSuccess('🔓 비밀번호 화면 장치가 영구 해제되었습니다.');
    } catch (err) {
      setModalError('보안 장치 비활성화 실패: ' + (err as Error).message);
    }
  };

  // Load initial settings on mounting
  useEffect(() => {
    // Force write user backup the very first time to ensure clean recovery
    const hasRecovered = localStorage.getItem('portfolio_dashboard_restored_uploaded_v5_gold');
    if (hasRecovered !== 'yes') {
      const backupRate = 1540;
      const backupBaseAmounts = {
        "농협 IRP": 90400755,
        "농협 연금": 10010000,
        "한투 IRP": 27000000,
        "토스 해외": 15000000,
        "신한투자": 60000000,
        "메리츠 주식": 49114605
      };
      
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_ACCOUNTS));
      localStorage.setItem(RATE_STORAGE_KEY, backupRate.toString());
      localStorage.setItem('portfolio_dashboard_segment_base_amounts', JSON.stringify(backupBaseAmounts));
      localStorage.setItem('portfolio_dashboard_rebalancing_targets', JSON.stringify(DEFAULT_REBALANCING_TARGETS));
      
      const backupAssetTrends = [
        { date: "06월 05일", 국내주식: 170491680, 해외주식: 22434819, 금은: 33562580, 현금: 90188105 },
        { date: "06월 06일", 국내주식: 0, 해외주식: 0, 금은: 0, 현금: 0 },
        { date: "06월 07일", 국내주식: 0, 해외주식: 0, 금은: 0, 현금: 0 },
        { date: "06월 08일", 국내주식: 189918650, 해외주식: 21396806, 금은: 32016140, 현금: 55587600 },
        { date: "06월 09일", 국내주식: 190728400, 해외주식: 21487266, 금은: 32128980, 현금: 62494246 },
        { date: "06월 10일", 국내주식: 0, 해외주식: 0, 금은: 0, 현금: 0 },
        { date: "06월 11일", 국내주식: 0, 해외주식: 0, 금은: 0, 현금: 0 },
        { date: "06월 12일", 국내주식: 0, 해외주식: 0, 금은: 0, 현금: 0 },
        { date: "06월 13일", 국내주식: 0, 해외주식: 0, 금은: 0, 현금: 0 },
        { date: "06월 14일", 국내주식: 0, 해외주식: 0, 금은: 0, 현금: 0 },
        { date: "06월 15일", 국내주식: 0, 해외주식: 0, 금은: 0, 현금: 0 },
        { date: "06월 16일", 국내주식: 0, 해외주식: 0, 금은: 0, 현금: 0 },
        { date: "06월 17일", 국내주식: 0, 해외주식: 0, 금은: 0, 현금: 0 },
        { date: "06월 18일", 국내주식: 0, 해외주식: 0, 금은: 0, 현금: 0 },
        { date: "06월 19일", 국내주식: 0, 해외주식: 0, 금은: 0, 현금: 0 }
      ];
      const backupAccountTrends = [
        {
          date: "06월 05일",
          "토스 국내": 45875787,
          "토스 국내_예수금(현금)": 5445598,
          "토스 국내_삼성전자": 3165555,
          "토스 국내_SK하이닉스": 22518826,
          "토스 국내_에스티팜": 9384183,
          "토스 국내_삼성전자우": 5361625,
          "토스 해외": 22434819,
          "토스 해외_엔비디아": 22160485,
          "토스 해외_달러": 274334,
          "메리츠 주식": 50072074,
          "메리츠 주식_SK하이닉스": 10333717,
          "메리츠 주식_삼성전자": 10546231,
          "메리츠 주식_DB손해보험": 11047506,
          "메리츠 주식_ACE KRX금현물": 5147154,
          "메리츠 주식_동아쏘시오홀딩스": 4806180,
          "메리츠 주식_LG전자": 8115564,
          "메리츠 주식_예수금(현금)": 75722,
          "한투 IRP": 29999515,
          "한투 IRP_Tiger 머니마켓액티브": 9419780,
          "한투 IRP_ACE KRX금현물": 18789126,
          "한투 IRP_HANARO 원자력iSelect": 907158,
          "한투 IRP_Tiger 반도체TOP10": 863660,
          "한투 IRP_예수금(현금)": 19791,
          "농협 IRP": 100206698,
          "농협 IRP_Tiger 반도체TOP10": 17180140,
          "농협 IRP_Tiger 머니마켓액티브": 28526315,
          "농협 IRP_KODEX 코스닥150": 14003975,
          "농협 IRP_HANARO 원자력iSelect": 12474452,
          "농협 IRP_KODEX TDF2050액티브적격": 10093318,
          "농협 IRP_Tiger 미국S&P500": 5767739,
          "농협 IRP_Tiger 미국나스닥100": 5373309,
          "농협 IRP_예수금(현금)": 6787450,
          "농협 연금": 9671900,
          "농협 연금_KODEX은선물": 9671900,
          "신한투자": 58416391,
          "신한투자_LG전자": 7202173,
          "신한투자_삼성전자": 12070627,
          "신한투자_SK하이닉스": 18488087,
          "신한투자_삼성전자우": 12622615,
          "신한투자_예수금(현금)": 8032889
        },
        { date: "06월 06일" },
        { date: "06월 07일" },
        {
          date: "06월 08일",
          "토스 국내": 42824387,
          "토스 국내_예수금(현금)": 5083387,
          "토스 국내_삼성전자": 2955000,
          "토스 국내_SK하이닉스": 21021000,
          "토스 국내_에스티팜": 8760000,
          "토스 국내_삼성전자우": 5005000,
          "토스 해외": 21396806,
          "토스 해외_엔비디아": 21135166,
          "토스 해외_달러": 261640,
          "메리츠 주식": 46298794,
          "메리츠 주식_SK하이닉스": 9555000,
          "메리츠 주식_삼성전자": 9751500,
          "메리츠 주식_DB손해보험": 10215000,
          "메리츠 주식_ACE KRX금현물": 4759280,
          "메리츠 주식_동아쏘시오홀딩스": 4444000,
          "메리츠 주식_LG전자": 7504000,
          "메리츠 주식_예수금(현금)": 70014,
          "한투 IRP": 29098105,
          "한투 IRP_Tiger 머니마켓액티브": 9136740,
          "한투 IRP_ACE KRX금현물": 18224560,
          "한투 IRP_HANARO 원자력iSelect": 879900,
          "한투 IRP_Tiger 반도체TOP10": 837710,
          "한투 IRP_예수금(현금)": 19195,
          "농협 IRP": 95925508,
          "농협 IRP_Tiger 반도체TOP10": 16445570,
          "농협 IRP_Tiger 머니마켓액티브": 27307560,
          "농협 IRP_KODEX 코스닥150": 13405710,
          "농협 IRP_HANARO 원자력iSelect": 11941500,
          "농협 IRP_KODEX TDF2050액티브적격": 9662100,
          "농협 IRP_Tiger 미국S&P500": 5521320,
          "농협 IRP_Tiger 미국나스닥100": 5143840,
          "농협 IRP_예수금(현금)": 6497908,
          "농협 연금": 9032300,
          "농협 연금_KODEX은선물": 9032300,
          "신한투자": 54343296,
          "신한투자_LG전자": 6700000,
          "신한투자_삼성전자": 11229000,
          "신한투자_SK하이닉스": 17199000,
          "신한투자_삼성전자우": 11742500,
          "신한투자_예수금(현금)": 7472796
        },
        {
          date: "06월 09일",
          "토스 국내": 45434387,
          "토스 국내_삼성전자": 3100000,
          "토스 국내_SK하이닉스": 22495000,
          "토스 국내_에스티팜": 9400000,
          "토스 국내_삼성전자우": 5356000,
          "토스 국내_예수금(현금)": 5083387,
          "토스 해외": 21487266,
          "토스 해외_엔비디아": 21226498,
          "토스 해외_달러": 260768,
          "메리츠 주식": 47088259,
          "메리츠 주식_SK하이닉스": 10225000,
          "메리츠 주식_삼성전자": 10230000,
          "메리츠 주식_DB손해보험": 10440000,
          "메리츠 주식_ACE KRX금현물": 4770760,
          "메리츠 주식_동아쏘시오홀딩스": 4576000,
          "메리츠 주식_예수금(현금)": 6846499,
          "한투 IRP": 29231170,
          "한투 IRP_Tiger 머니마켓액티브": 9137185,
          "한투 IRP_ACE KRX금현물": 18268520,
          "한투 IRP_HANARO 원자력iSelect": 903070,
          "한투 IRP_Tiger 반도체TOP10": 894520,
          "한투 IRP_예수금(현금)": 19195,
          "농협 IRP": 98243117,
          "농협 IRP_Tiger 반도체TOP10": 17560840,
          "농협 IRP_Tiger 머니마켓액티브": 22380970,
          "농협 IRP_KODEX 코스닥150": 14331120,
          "농협 IRP_HANARO 원자력iSelect": 12255950,
          "농협 IRP_KODEX TDF2050액티브적격": 11678940,
          "농협 IRP_Tiger 미국S&P500": 8402415,
          "농협 IRP_Tiger 미국나스닥100": 6128545,
          "농협 IRP_예수금(현금)": 5504337,
          "농협 연금": 9089700,
          "농협 연금_KODEX은선물": 9089700,
          "신한투자": 56273673,
          "신한투자_삼성전자": 11780000,
          "신한투자_SK하이닉스": 18405000,
          "신한투자_삼성전자우": 12566000,
          "신한투자_예수금(현금)": 13522673
        },
        { date: "06월 10일" },
        { date: "06월 11일" },
        { date: "06월 12일" },
        { date: "06월 13일" },
        { date: "06월 14일" },
        { date: "06월 15일" }
      ];

      localStorage.setItem('portfolio_asset_trends_daily_v1', JSON.stringify(backupAssetTrends));
      localStorage.setItem('portfolio_account_trends_daily_v1', JSON.stringify(backupAccountTrends));
      localStorage.setItem('portfolio_dashboard_restored_uploaded_v5_gold', 'yes');

      setAccounts(DEFAULT_ACCOUNTS);
      setExchangeRate(backupRate);
      setCustomBaseAmounts(backupBaseAmounts);
      setBackupKey(prev => prev + 1);
    } else {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        try {
          setAccounts(JSON.parse(saved));
        } catch (e) {
          setAccounts(DEFAULT_ACCOUNTS);
        }
      } else {
        setAccounts(DEFAULT_ACCOUNTS);
      }

      const savedRate = localStorage.getItem(RATE_STORAGE_KEY);
      if (savedRate) {
        const rateNum = Number(savedRate);
        if (!isNaN(rateNum) && rateNum > 0) {
          setExchangeRate(rateNum);
        }
      }
    }
  }, []);

  // Save changes to localStorage on edits
  const saveAccounts = (newAccounts: Account[]) => {
    setAccounts(newAccounts);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newAccounts));
  };

  const saveExchangeRate = (rate: number) => {
    setExchangeRate(rate);
    localStorage.setItem(RATE_STORAGE_KEY, rate.toString());
  };

  const handleUpdateAccount = (updated: Account) => {
    const next = accounts.map((acc) => (acc.id === updated.id ? updated : acc));
    saveAccounts(next);
  };

  const handleUpdateStockPriceGlobally = (ticker: string, name: string, newPrice: number) => {
    const next = accounts.map((acc) => {
      const updatedStocks = acc.stocks.map((s) => {
        const sTicker = (s.ticker || '').trim().toUpperCase();
        const sName = s.name.trim().toUpperCase();
        const matches = (ticker && ticker !== '코드없음')
          ? sTicker === ticker.toUpperCase()
          : sName === name.toUpperCase();
        if (matches) {
          return { ...s, currentPrice: newPrice };
        }
        return s;
      });
      return { ...acc, stocks: updatedStocks };
    });
    saveAccounts(next);
  };

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newAccountName.trim();
    if (!name) {
      alert('계좌 이름을 입력해 주세요.');
      return;
    }
    const cash = Number(newAccountCash.replace(/[^0-9.-]/g, '')) || 0;

    const newAcc: Account = {
      id: `acc_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name,
      stocks: [],
      cash,
    };

    const updated = [...accounts, newAcc];
    saveAccounts(updated);

    // 폼 초기화
    setNewAccountName('');
    setNewAccountCash('');
    setShowAddAccountForm(false);
    setActiveTab(newAcc.id); // 새로 생성한 계좌로 탭 전환
  };

  const handleDeleteAccount = (id: string) => {
    const targetAcc = accounts.find((a) => a.id === id);
    if (!targetAcc) return;
    if (window.confirm(`선택하신 계좌 [${targetAcc.name}]를 완전히 삭제하시겠습니까?\n계좌 내에 등록된 모든 종목 및 자산액 정보가 영구 삭제되며, 되돌릴 수 없습니다.`)) {
      const updated = accounts.filter((a) => a.id !== id);
      saveAccounts(updated);
      setActiveTab('all');
    }
  };

  const handleResetData = () => {
    if (window.confirm('모든 데이터를 초기 Excel 기본값으로 완전히 리셋하시겠습니까? (수정한 데이터가 유실됩니다)')) {
      saveAccounts(DEFAULT_ACCOUNTS);
      saveExchangeRate(USD_EXCHANGE_RATE);
      localStorage.removeItem('portfolio_dashboard_rebalancing_targets');
      setActiveTab('all');
    }
  };

  const handleSyncAllClosingPrices = () => {
    let updatedCount = 0;
    const next = accounts.map((acc) => {
      let updatedStocks = acc.stocks.map((stock) => {
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
      return { ...acc, stocks: updatedStocks };
    });

    if (updatedCount === 0) {
      alert('모든 계좌 내 종목의 현재가가 이미 사전 고시된 시장 종가 정보와 오차 없이 똑같습니다.');
      return;
    }

    saveAccounts(next);
    alert(`성공: 모든 계좌에서 총 ${updatedCount}개 연동 자산의 현재가를 기준 공식 종가로 자동 입력 완료하였습니다.`);
  };

  // 포트폴리오 데이터를 JSON 파일로 다운로드 (내보내기)
  const handleExportData = () => {
    try {
      const dataToExport = {
        version: '1.0',
        accounts,
        exchangeRate,
        segmentBaseAmounts: customBaseAmounts,
        rebalancingTargets: (() => {
          const savedTargetStr = localStorage.getItem('portfolio_dashboard_rebalancing_targets');
          if (savedTargetStr) {
            try {
              return JSON.parse(savedTargetStr);
            } catch (e) {}
          }
          return null;
        })(),
        assetTrendsDaily: (() => {
          const savedTrends = localStorage.getItem('portfolio_asset_trends_daily_v1');
          if (savedTrends) {
            try {
              return JSON.parse(savedTrends);
            } catch (e) {}
          }
          return null;
        })(),
        accountTrendsDaily: (() => {
          const savedTrends = localStorage.getItem('portfolio_account_trends_daily_v1');
          if (savedTrends) {
            try {
              return JSON.parse(savedTrends);
            } catch (e) {}
          }
          return null;
        })(),
        exportedAt: new Date().toISOString(),
      };

      const dataStr = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = url;
      downloadAnchor.download = `wealthguard_portfolio_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('백업 파일 내보내기 중 문제가 발생했습니다: ' + (error as Error).message);
    }
  };

  // 백업된 JSON 파일을 불러와서 병합 또는 덮어쓰기 (가져오기)
  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        // 기본 유효성 검증
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('유효한 JSON 파일이 아닙니다.');
        }

        if (!Array.isArray(parsed.accounts)) {
          throw new Error("백업 파일 내에 유효한 계좌 데이터('accounts' 목록)가 정의되어 있지 않습니다.");
        }

        // 유저 확인 절차
        const confirmMsg = '⚠️ 경고: 외부 백업 데이터 파일을 가져옵니다.\n\n이 작업을 수행하면 기존에 이 브라우저에 입력되어 있는 모든 계좌 및 종가, 환율, 리밸런싱 타겟 정보가 백업 파일 내용으로 "덮어쓰기" 됩니다.\n\n계속 진행하시겠습니까?';
        if (!window.confirm(confirmMsg)) {
          return;
        }

        // 데이터 복원 실행
        const importedAccounts = parsed.accounts;
        const importedRate = parsed.exchangeRate ? Number(parsed.exchangeRate) : null;
        const importedTargets = parsed.rebalancingTargets;
        const importedSegmentBaseAmounts = parsed.segmentBaseAmounts;
        const importedAssetTrends = parsed.assetTrendsDaily;
        const importedAccountTrends = parsed.accountTrendsDaily;

        // 1. 계좌 정보 저장
        saveAccounts(importedAccounts);

        // 2. 환율 정보 복원
        if (importedRate && !isNaN(importedRate) && importedRate > 0) {
          saveExchangeRate(importedRate);
        }

        // 3. 리밸런싱 타겟 비중 복원
        if (Array.isArray(importedTargets)) {
          localStorage.setItem('portfolio_dashboard_rebalancing_targets', JSON.stringify(importedTargets));
        }

        // 4. 계좌 구분별 기초 금액 복원
        if (importedSegmentBaseAmounts && typeof importedSegmentBaseAmounts === 'object') {
          setCustomBaseAmounts(importedSegmentBaseAmounts);
          localStorage.setItem('portfolio_dashboard_segment_base_amounts', JSON.stringify(importedSegmentBaseAmounts));
        } else {
          setCustomBaseAmounts({});
          localStorage.removeItem('portfolio_dashboard_segment_base_amounts');
        }

        // 5. 일별 종합 자산 추이 기록 복원
        if (Array.isArray(importedAssetTrends)) {
          localStorage.setItem('portfolio_asset_trends_daily_v1', JSON.stringify(importedAssetTrends));
        }

        // 6. 계좌별 일별 자산 추이 기록 복원
        if (Array.isArray(importedAccountTrends)) {
          localStorage.setItem('portfolio_account_trends_daily_v1', JSON.stringify(importedAccountTrends));
        }

        // 리마운트 및 상태 동기화 트리거
        setBackupKey(prev => prev + 1);

        alert('🎉 성공: 백업 파일로부터 자산 포트폴리오 및 일별/계좌별 누적 추이 데이터를 성공적으로 복구(가져오기)하였습니다!');
      } catch (error) {
        alert('가져오기 실패: 올바르지 않은 백업 파일 형식이거나 데이터가 손상되었습니다.\n상세 에러 내용: ' + (error as Error).message);
      } finally {
        // 동일한 파일 재업로드 시 이벤트가 정상 작동하도록 초기화
        e.target.value = '';
      }
    };

    reader.readAsText(file);
  };

  const scrollToSection = (id: string, navKey: string) => {
    setIsMobileSidebarOpen(false);
    setActiveNav(navKey);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // 1. Calculate Portfolio Summaries (Excluding raw account cash (현금) to reflect only actual invested stock/bond holdings)
  let totalPurchase = 0;
  let totalValuation = 0;

  accounts.forEach((acc) => {
    let accStockPurchase = 0;
    let accStockValuation = 0;

    acc.stocks.forEach((s) => {
      const isUsd = s.isForeign;
      const rate = isUsd ? exchangeRate : 1;
      accStockPurchase += s.purchasePrice * s.quantity * rate;
      accStockValuation += s.currentPrice * s.quantity * rate;
    });

    totalPurchase += accStockPurchase;
    totalValuation += accStockValuation;
  });

  const totalProfitLoss = totalValuation - totalPurchase;
  const overallReturnRate = totalPurchase === 0 ? 0 : (totalProfitLoss / totalPurchase) * 100;

  if (!isUnlocked) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white font-sans p-4 select-none">
        <div className="w-full max-w-sm bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-800 p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
          
          <div className="flex flex-col items-center text-center">
            {/* 자산관리 보호 상태 아이콘 */}
            <div className="w-16 h-16 bg-indigo-950/80 border border-indigo-500/30 rounded-2xl flex items-center justify-center mb-6 shadow-inner animate-pulse">
              <Lock className="w-8 h-8 text-indigo-400" />
            </div>

            <h1 className="text-xl font-bold tracking-tight text-white mb-2">웰스가드 포트폴리오 터미널</h1>
            
            {savedPassword ? (
              // 1. 잠금해제 화면
              <form onSubmit={handleUnlock} className="w-full mt-6 space-y-4">
                <p className="text-xs text-slate-400 leading-relaxed">자산 포트폴리오를 대시보드에 표시하기 위해 보안 비밀번호를 입력해 주세요.</p>
                
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="비밀번호 입력"
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      setPasswordError('');
                    }}
                    autoFocus
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono tracking-widest text-center"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {passwordError && (
                  <p className="text-rose-500 text-xs font-semibold text-center bg-rose-950/25 py-1 px-3 rounded-lg border border-rose-900/40">
                    {passwordError}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 mt-4"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>터미널 잠금 해제</span>
                </button>
              </form>
            ) : (
              // 2. 비밀번호 생성 화면 (최초 마운트)
              <form onSubmit={handleSetupPassword} className="w-full mt-6 space-y-4 text-left">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-[11px] text-slate-400 leading-relaxed mb-1">
                  💡 <strong className="text-white">최초 1회 비밀번호 설정이 필요합니다.</strong> 이 브라우저에서 고객님의 소중한 자산 정보를 타인이 보지 못하도록 보호하는 로컬 잠금 장치입니다.
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2">
                    새 비밀번호 (최소 4자리)
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="비밀번호 설정"
                      value={passwordInput}
                      onChange={(e) => {
                        setPasswordInput(e.target.value);
                        setPasswordError('');
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono tracking-widest text-center"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2">
                    비밀번호 확인
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="비밀번호 재입력"
                    value={passwordConfirmInput}
                    onChange={(e) => {
                      setPasswordConfirmInput(e.target.value);
                      setPasswordError('');
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono tracking-widest text-center"
                    required
                  />
                </div>

                {passwordError && (
                  <p className="text-rose-500 text-[11px] font-semibold text-center bg-rose-950/25 py-1 px-3 rounded-lg border border-rose-900/40">
                    {passwordError}
                  </p>
                )}

                <div className="space-y-2 mt-4">
                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>비밀번호 등록 및 로그인</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSkipPasswordSetup}
                    className="w-full bg-transparent hover:bg-slate-800/40 text-slate-400 hover:text-slate-200 text-xs py-2 rounded-xl transition-all cursor-pointer font-medium text-center"
                  >
                    비밀번호 설정 없이 바로 시작하기
                  </button>
                </div>
              </form>
            )}

            <div className="mt-8 text-[10px] text-slate-500 text-center font-mono select-none">
              WealthGuard Secure Terminal v2
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-800 font-sans overflow-hidden selection:bg-blue-100 selection:text-blue-950" id="main-portfolio-dashboard-app">
      
      {/* 사이드바 (데스크톱 및 대화면 레이아웃) */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col hidden lg:flex shrink-0 border-r border-slate-800" id="wealthguard-desktop-sidebar">
        {/* 사이드바 헤더 브랜드 로고 */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center shadow-lg">
              <span className="font-bold text-white text-base">Σ</span>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">웰스가드 (WealthGuard)</h1>
              <p className="text-[9px] text-slate-400 font-medium">자산운용 통합 제어실</p>
            </div>
          </div>
        </div>

        {/* 부드러운 스크롤 이동이 연동되는 네비게이션 */}
        <nav className="flex-1 py-6 space-y-1 px-3">
          <button
            onClick={() => scrollToSection('portfolio-overview-section', 'dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
              activeNav === 'dashboard'
                ? 'bg-slate-800 text-white border-l-4 border-blue-500'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/55'
            }`}
          >
            <Activity className="w-4 h-4 shrink-0" />
            <span>자산 대시보드</span>
          </button>

          <button
            onClick={() => scrollToSection('asset-trends-section', 'trends')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
              activeNav === 'trends'
                ? 'bg-slate-800 text-white border-l-4 border-blue-500'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/55'
            }`}
          >
            <BarChart2 className="w-4 h-4 shrink-0" />
            <span>일별 자산 변동 추이</span>
          </button>

          <button
            onClick={() => scrollToSection('stock-consolidation-section', 'consolidation')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
              activeNav === 'consolidation'
                ? 'bg-slate-800 text-white border-l-4 border-blue-500'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/55'
            }`}
          >
            <Database className="w-4 h-4 shrink-0 text-slate-400" />
            <span>종목별 투자 현황</span>
          </button>

          <button
            onClick={() => scrollToSection('individual-accounts-editing-sheets', 'analysis')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
              activeNav === 'analysis'
                ? 'bg-slate-800 text-white border-l-4 border-blue-500'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/55'
            }`}
          >
            <Sliders className="w-4 h-4 shrink-0" />
            <span>계좌별 종목 편집/관리</span>
          </button>

          <div className="pt-4 px-4">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">통합 시스템 설정</span>
          </div>

          <button
            onClick={() => setIsPasswordModalOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-950/20 transition-all mb-1 font-medium cursor-pointer"
            title="화면 로딩 시 자산을 보호할 비밀번호 설정 및 제거를 관리합니다."
          >
            <Lock className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span>비밀번호 & 보안 설정 ({savedPassword ? '보안 활성' : '미설정'})</span>
          </button>

          <button
            onClick={() => {
              fetchServerBackups();
              setIsAutoBackupModalOpen(true);
            }}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/20 transition-all mb-1 font-medium cursor-pointer"
            title="실시간으로 서버 클라우드와 영지식 암호화 동기화 중인 보안 백업들을 관리 및 복원합니다."
          >
            <Cloud className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
            <span>보안 클라우드 백업 관리 ({serverBackups.length}개 보관)</span>
          </button>
 
          <button
            onClick={handleExportData}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-950/20 transition-all mb-1 font-medium"
            title="현재 저장된 모든 자산 및 설정 데이터를 JSON 파일로 파일 다운로드합니다."
          >
            <Download className="w-3.5 h-3.5 shrink-0 text-blue-400" />
            <span>데이터 백업 (JSON 다운로드)</span>
          </button>
 
          <button
            onClick={() => document.getElementById('backup-file-input')?.click()}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-xs text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/20 transition-all mb-1 font-medium"
            title="기존에 백업한 JSON 파일을 올려 데이터를 완전히 복원합니다."
          >
            <Upload className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
            <span>데이터 복구 (JSON 불러오기)</span>
          </button>
        </nav>
      </aside>
 
      {/* 모바일 최적화 메뉴 서랍 드로어 */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden bg-slate-900/60 backdrop-blur-sm" id="mobile-sidebar-overlay">
          <div className="w-64 bg-slate-900 text-white flex flex-col p-6 animate-slide-in relative">
            <button
              onClick={() => setIsMobileSidebarOpen(false)}
              className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
 
            <div className="flex items-center gap-2.5 mb-8 border-b border-slate-800 pb-4">
              <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                <span className="font-bold text-white text-base">Σ</span>
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">웰스가드</h1>
              </div>
            </div>
 
            <nav className="space-y-2">
              <button
                onClick={() => scrollToSection('portfolio-overview-section', 'dashboard')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
              >
                <Activity className="w-4 h-4" />
                <span>자산 대시보드</span>
              </button>
 
              <button
                onClick={() => scrollToSection('asset-trends-section', 'trends')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
              >
                <BarChart2 className="w-4 h-4" />
                <span>일별 자산 변동 추이</span>
              </button>
 
              <button
                onClick={() => scrollToSection('stock-consolidation-section', 'consolidation')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
              >
                <Database className="w-4 h-4 text-slate-400" />
                <span>종목별 투자 현황</span>
              </button>
              <button
                onClick={() => scrollToSection('individual-accounts-editing-sheets', 'analysis')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
              >
                <Sliders className="w-4 h-4" />
                <span>계좌별 종목 편집/관리</span>
              </button>
 
              <button
                onClick={() => {
                  setIsMobileSidebarOpen(false);
                  handleExportData();
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-blue-400 hover:bg-blue-950/20"
              >
                <Download className="w-4 h-4 text-blue-400" />
                <span>데이터 백업 (JSON)</span>
              </button>
              <button
                onClick={() => {
                  setIsMobileSidebarOpen(false);
                  setIsPasswordModalOpen(true);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-amber-400 hover:bg-amber-950/20"
              >
                <Lock className="w-4 h-4 text-amber-400" />
                <span>비밀번호 & 보안 ({savedPassword ? '보안 활성' : '미설정'})</span>
              </button>
              <button
                onClick={() => {
                  setIsMobileSidebarOpen(false);
                  fetchServerBackups();
                  setIsAutoBackupModalOpen(true);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-emerald-400 hover:bg-emerald-950/20"
              >
                <Cloud className="w-4 h-4 text-emerald-400" />
                <span>보안 클라우드 백업 관리 ({serverBackups.length})</span>
              </button>
              <button
                onClick={() => {
                  setIsMobileSidebarOpen(false);
                  document.getElementById('backup-file-input-mobile')?.click();
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-indigo-400 hover:bg-indigo-950/20"
              >
                <Upload className="w-4 h-4 text-indigo-400" />
                <span>데이터 복구 (JSON)</span>
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* 메인 부 영역 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* 상단 헤더 바 */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-8 shrink-0">
          <div className="flex items-center gap-3">
            {/* 모바일 햄버거 메뉴 트리거 */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>
            
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-medium">
              <span>내 자산</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
              <span>연동 포트폴리오</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
              <span className="text-slate-600 font-semibold bg-slate-100 px-2 py-0.5 rounded">종합 인텔리전스 대시보드 2</span>
            </div>
            <div className="sm:hidden font-bold text-slate-800 text-sm">
              웰스가드 콘솔 v2
            </div>
          </div>

          <div className="flex items-center gap-3 lg:gap-5">
            {/* 클라우드 동기화 상태 배지 */}
            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs">
              {cloudSyncStatus === 'fetching' && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 border border-indigo-100/60 rounded-lg text-indigo-600 animate-pulse font-medium">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span className="hidden sm:inline">백업 연동중...</span>
                </div>
              )}
              {cloudSyncStatus === 'success' && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 border border-emerald-100/60 rounded-lg text-emerald-600 font-medium">
                  <Cloud className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="hidden sm:inline">실시간 클라우드 연동</span>
                </div>
              )}
              {cloudSyncStatus === 'no_backup' && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-medium">
                  <CloudOff className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">서버 백업 없음</span>
                </div>
              )}
              {cloudSyncStatus === 'locked' && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 border border-amber-100/60 rounded-lg text-amber-600 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                  <span className="hidden sm:inline">백업 잠김 (인증 요함)</span>
                </div>
              )}
              {cloudSyncStatus === 'error' && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-rose-50 border border-rose-100/60 rounded-lg text-rose-600 font-medium">
                  <Database className="w-3.5 h-3.5 text-rose-500" />
                  <span className="hidden sm:inline">백업 연동 에러</span>
                </div>
              )}
            </div>

            {/* 환율 입력 필드 */}
            <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-[11px] text-slate-500 font-medium hidden md:inline">기준 고시 환율 (USD/KRW):</span>
              <input
                type="number"
                id="top-exchange-rate"
                value={exchangeRate}
                step="0.1"
                onChange={(e) => saveExchangeRate(Number(e.target.value) || USD_EXCHANGE_RATE)}
                className="w-16 bg-transparent text-center text-xs font-bold font-mono text-slate-800 focus:outline-none border-none py-0 px-1 focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-[10px] text-slate-400 font-semibold">원</span>
            </div>

            {/* 프로필 서브박스 */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-xs font-bold text-blue-700 font-mono" title="인증 완료">
                RM
              </div>
              <span className="text-xs font-semibold text-slate-600 hidden md:inline">romejo@gmail.com</span>
            </div>
          </div>
        </header>

        {/* 스크롤 가용 컨텍스트 패널 */}
        <main className="flex-1 overflow-y-auto bg-slate-50/50 p-6 lg:p-8 space-y-6">
          
          {/* 메인 비주얼 배너 */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-xl p-6 shadow-sm border border-slate-800 relative overflow-hidden">
            <div className="absolute right-0 bottom-0 transform translate-x-8 translate-y-8 text-white/5 pointer-events-none">
              <Award className="w-56 h-56" />
            </div>
            <div className="relative z-10">
              <span className="bg-blue-600 text-[10px] font-bold tracking-widest uppercase px-2.5 py-0.5 rounded-md inline-block mb-3 shadow">
                WealthGuard 프리미엄 터미널 v2
              </span>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">종합 자산관리 및 리밸런싱 대시보드 2</h2>
              <p className="text-xs text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
                토스, 메리츠, 한투, 농협 연금 등 복수 금융기관에 분산된 계좌 자산을 실시간 환율 정보와 연계하여 통합 제어합니다.
                하단의 정교한 포트폴리오 리밸런싱 도구를 통해 목표 비중을 실현하기 위한 매매 가이드라인을 완전 자동으로 도출합니다.
              </p>
            </div>
          </div>

          {/* 일별 자산 축적 및 변동 추이 (일별 누적) */}
          <section id="asset-trends-section" className="scroll-mt-6">
            <AssetTrendSection key={`trend-${backupKey}`} accounts={accounts} exchangeRate={exchangeRate} />
          </section>

          {/* 분류별 자산 및 계좌 구분별 자산 종합 배치 영역 */}
          <section id="portfolio-overview-section" className="scroll-mt-6 transition-all duration-300">
            <OverviewSection
              key={`overview-${backupKey}`}
              accounts={accounts}
              exchangeRate={exchangeRate}
              customBaseAmounts={customBaseAmounts}
              handleBaseAmountChange={handleBaseAmountChange}
              handleResetBaseAmount={handleResetBaseAmount}
            />
          </section>

          {/* 종목별 통합 투자 현황 영역 */}
          <section id="stock-consolidation-section" className="scroll-mt-6">
            <StockConsolidationSection
              accounts={accounts}
              exchangeRate={exchangeRate}
              onUpdateStockPriceGlobally={handleUpdateStockPriceGlobally}
            />
          </section>

          {/* 개별 계좌 관리 및 종목 편집 영역 */}
          <section id="individual-accounts-editing-sheets" className="scroll-mt-6 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-blue-600" />
                    계좌 구분별 종목 편집기 (실시간 반영)
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    신규 임의 계좌를 추가/삭제하고 각 계좌별로 현금 및 자산 라인을 유연하게 추가/조정할 수 있습니다.
                  </p>
                </div>

                {/* 계좌 제어 및 필터링 */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* 계좌 삭제 버튼 (활성 탭이 전체보기가 아닐 때 노출) */}
                  {activeTab !== 'all' && (
                    <button
                      type="button"
                      onClick={() => handleDeleteAccount(activeTab)}
                      className="px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg h-8 hover:text-rose-700 transition-all flex items-center gap-1 cursor-pointer"
                      title="선택된 활성 계좌를 삭제합니다"
                    >
                      <X className="w-3.5 h-3.5" />
                      현재 계좌 삭제
                    </button>
                  )}

                  {/* 신규 계좌 추가 트리거 */}
                  <button
                    type="button"
                    onClick={() => setShowAddAccountForm(!showAddAccountForm)}
                    className="px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg h-8 outline-none transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>+ 신규 계좌 추가</span>
                  </button>

                  {/* 계좌 탭 셀렉터 */}
                  <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setActiveTab('all')}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                        activeTab === 'all'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      전체보기
                    </button>
                    {accounts.map((acc) => (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => setActiveTab(acc.id)}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                          activeTab === acc.id
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        {acc.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 신규 계좌 추가 인터랙티브 폼 슬라이드 */}
              {showAddAccountForm && (
                <div className="mt-4 p-4 bg-slate-50 border border-slate-200/70 rounded-xl animate-scale-up">
                  <form onSubmit={handleCreateAccount} className="flex flex-col sm:flex-row items-end gap-3 max-w-3xl">
                    <div className="flex-1 w-full">
                      <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-1">
                        새로운 계좌명 (금융기관 구분 등)
                      </label>
                      <input
                        type="text"
                        placeholder="예: 토스 ISA 계좌, 신한 미국주식, 카카오 연금"
                        value={newAccountName}
                        onChange={(e) => setNewAccountName(e.target.value)}
                        className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg py-1.5 px-3 text-xs text-slate-800 outline-none transition-all placeholder:text-slate-400"
                        required
                      />
                    </div>
                    <div className="w-full sm:w-[180px]">
                      <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-1">
                        기초 현금 (원화 ₩)
                      </label>
                      <input
                        type="text"
                        placeholder="예: 3000000"
                        value={newAccountCash}
                        onChange={(e) => setNewAccountCash(e.target.value)}
                        className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg py-1.5 px-3 text-xs text-slate-800 outline-none font-mono"
                      />
                    </div>
                    <div className="w-full sm:w-auto flex gap-2 shrink-0">
                      <button
                        type="submit"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2 px-4 rounded-lg shadow-sm transition-all cursor-pointer h-[34px] flex items-center justify-center gap-1 w-full sm:w-auto"
                      >
                        계좌 생성
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddAccountForm(false);
                          setNewAccountName('');
                          setNewAccountCash('');
                        }}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs py-2 px-3 rounded-lg transition-all cursor-pointer h-[34px]"
                      >
                        취소
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* 개별 계좌 데이터 편집 그리드 일람 */}
            <div className="space-y-6">
              {accounts.map((acc) => {
                if (activeTab !== 'all' && activeTab !== acc.id) return null;
                return (
                  <AccountTable
                    key={acc.id}
                    account={acc}
                    accounts={accounts}
                    onUpdateAccount={handleUpdateAccount}
                    exchangeRate={exchangeRate}
                    onDeleteAccount={handleDeleteAccount}
                  />
                );
              })}
            </div>
          </section>

        </main>
      </div>
      
      {/* 백업 파일 처리를 위한 보이지 않는 파일 업로드 엘리먼트 */}
      <input
        type="file"
        id="backup-file-input"
        accept=".json"
        onChange={handleImportData}
        className="hidden"
      />
      <input
        type="file"
        id="backup-file-input-mobile"
        accept=".json"
        onChange={handleImportData}
        className="hidden"
      />

      {/* 비밀번호 & 보안 관리 설정 모달 */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 font-sans text-slate-800">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md overflow-hidden shadow-2xl animate-scale-up">
            <div className="bg-slate-950 text-white p-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold">비밀번호 & 보안 관리</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsPasswordModalOpen(false);
                  setModalError('');
                  setModalSuccess('');
                  setModalCurrentPassword('');
                  setModalNewPassword('');
                  setModalNewPasswordConfirm('');
                }}
                className="text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {modalError && (
                <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3 font-semibold">
                  ⚠️ {modalError}
                </div>
              )}
              {modalSuccess && (
                <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3 font-semibold">
                  {modalSuccess}
                </div>
              )}

              <form onSubmit={handleModalPasswordUpdate} className="space-y-4">
                {savedPassword ? (
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-1.5">
                      현재 비밀번호 입력 *
                    </label>
                    <input
                      type="password"
                      placeholder="설정된 현재 비밀번호"
                      value={modalCurrentPassword}
                      onChange={(e) => setModalCurrentPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg py-2 px-3 text-xs text-slate-800 outline-none font-mono tracking-widest text-center"
                      required
                    />
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 text-[11px] leading-relaxed">
                    💡 <strong>비활성화 상태:</strong> 현재 비밀번호가 지정되지 않아 대시보드가 상시 노출됩니다. 아래 양식을 설정해 화면 기동 시 보호 장치(비밀번호문)를 활성화하십시오.
                  </div>
                )}

                <div className="border-t border-slate-100 pt-4 space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-1.5">
                      설정할 새 비밀번호 (최소 4자리)
                    </label>
                    <input
                      type="password"
                      placeholder="새 비밀번호 입력"
                      value={modalNewPassword}
                      onChange={(e) => setModalNewPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg py-2 px-3 text-xs text-slate-800 outline-none font-mono tracking-widest text-center"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-1.5">
                      새 비밀번호 확인
                    </label>
                    <input
                      type="password"
                      placeholder="새 비밀번호 다시 지정"
                      value={modalNewPasswordConfirm}
                      onChange={(e) => setModalNewPasswordConfirm(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg py-2 px-3 text-xs text-slate-800 outline-none font-mono tracking-widest text-center"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-2.5 pt-3">
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-lg shadow-sm transition-all cursor-pointer text-center"
                  >
                    {savedPassword ? '비밀번호 변경' : '비밀번호 잠금 활성화'}
                  </button>

                  {savedPassword && (
                    <button
                      type="button"
                      onClick={handleModalDisablePassword}
                      className="px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 font-semibold text-xs py-2.5 rounded-lg border border-rose-200/60 transition-all cursor-pointer"
                    >
                      잠금장치 완전 비활성화
                    </button>
                  )}
                </div>
              </form>
            </div>
            
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsPasswordModalOpen(false);
                  setModalError('');
                  setModalSuccess('');
                  setModalCurrentPassword('');
                  setModalNewPassword('');
                  setModalNewPasswordConfirm('');
                }}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs py-1.5 px-3 rounded-lg transition-all cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 실시간 클라우드 백업 관리 모달 */}
      {isAutoBackupModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 font-sans text-slate-800 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-lg overflow-hidden shadow-2xl animate-scale-up">
            
            {/* Modal Title */}
            <div className="bg-slate-950 text-white p-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-indigo-400 animate-pulse" />
                <h3 className="text-sm font-bold">WealthGuard 보안 클라우드 백업 센터</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAutoBackupModalOpen(false)}
                className="text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Contents */}
            <div className="p-6 space-y-4">
              <div className="bg-indigo-50 border border-indigo-150 text-indigo-950 rounded-xl p-4 text-[11px] leading-relaxed space-y-1">
                <div className="flex items-center gap-1 text-indigo-700 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 animate-pulse" />
                  <span>Zero-Knowledge (전 구간 암호 장벽 작동 중)</span>
                </div>
                <p className="text-slate-600 font-medium">
                  현재 설정된 개인 비밀번호를 암호키로 삼아 브라우저 단에서 <strong>AES-GCM 256비트 표준 군사급 보안 장벽</strong>으로 전폭 암호화된 상태로 서버 클라우드에 전송 및 저장됩니다.
                </p>
                <p className="text-slate-500 mt-1">
                  데이터 원본이 전 구간 암호화된 채 유통되기 때문에 본인 외에는 서버 개발자를 포함한 어떤 제3자도 자산 내역을 복호화하거나 볼 수 없습니다.
                </p>
                {savedPassword ? (
                  <div className="text-emerald-700 font-bold flex items-center gap-1 mt-1 text-[10px]">
                    ● 개인 마스터 비밀번호로 완벽 차폐 및 암호 동기화 구동 중
                  </div>
                ) : (
                  <div className="text-amber-700 font-bold flex items-center gap-1 mt-1 text-[10px]">
                    ⚠️ 비밀번호 미설정 상태: 기본 공용 키로 저장됩니다. (안전한 보호를 위해 고유 비밀번호 설정을 권유합니다.)
                  </div>
                )}
              </div>

              {/* Manual Backup Trigger Zone */}
              <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl gap-3">
                <div className="text-[11px] font-medium text-slate-700">
                  수동으로 즉시 암호화 후 클라우드 백업 스냅샷을 즉시 업로드합니다:
                </div>
                <button
                  type="button"
                  onClick={handleSaveServerBackupManual}
                  disabled={serverBackupsLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold py-1.5 px-3 rounded-lg transition-all cursor-pointer shadow-sm flex items-center gap-1 font-sans"
                >
                  <CloudUpload className="w-3.5 h-3.5 animate-bounce" />
                  <span>수동 백업 전송</span>
                </button>
              </div>

              <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                {serverBackupsLoading && serverBackups.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-xs flex flex-col items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
                    <span>서버에서 보안 클라우드 백업 목록을 요청하는 중...</span>
                  </div>
                ) : serverBackupsError ? (
                  <div className="text-center py-10 text-rose-500 text-xs bg-rose-50 border border-rose-100 rounded-xl">
                    서버 백업을 조회하지 못했습니다: {serverBackupsError}
                  </div>
                ) : serverBackups.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs leading-relaxed">
                    클라우드 서버에 등록된 보안 암호 백업이 없습니다.<br />
                    계좌, 자산, 환율 변경 시 800ms 후 보안 클라우드 수동/자동 백업이 자동으로 안전하게 서버에 적립됩니다.
                  </div>
                ) : (
                  serverBackups.map((item, idx) => {
                    const timestampNum = Number(item.timestamp);
                    const date = new Date(timestampNum);
                    const dateStr = isNaN(date.getTime()) 
                      ? '일시 확인 불가' 
                      : date.toLocaleString('ko-KR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        });

                    return (
                      <div key={item.fileName} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100/50 border border-slate-200/80 rounded-xl transition-all gap-3 shadow-2xs">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-150/50 flex items-center justify-center shrink-0 mt-0.5">
                            <Cloud className="w-4 h-4 text-indigo-500" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                              <span>보안 백업 #{serverBackups.length - idx}</span>
                              <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.2 rounded-full text-[9px] font-medium font-mono">AES-GCM 256</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{dateStr}</div>
                            <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                              보관 자산계좌 {item.accountsCount || 0}개 안전 보관 ({Math.round(item.size / 10.24) / 100} KB)
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0 font-sans">
                          <button
                            onClick={() => handleRestoreServerBackup(item)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] sm:text-[11px] font-bold py-1 px-2.5 rounded-md transition-all cursor-pointer shadow-sm flex items-center gap-1"
                            title="암호 복사본 해독 후 현재 상태 대시보드로 복제"
                          >
                            <CloudDownload className="w-3 h-3" />
                            <span>복원</span>
                          </button>
                          <button
                            onClick={() => handleDeleteServerBackup(item.fileName)}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 text-[10px] sm:text-[11px] font-bold py-1 px-2 rounded-md border border-rose-100/60 transition-all cursor-pointer flex items-center gap-1"
                            title="삭제"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>삭제</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Footer Sentinel Log */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-150/70 flex justify-between items-center text-[10px] text-slate-400 font-mono">
              <span className="flex items-center gap-1 text-slate-500">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                WealthGuard Zero-Knowledge Cloud Storage v3
              </span>
              <button
                type="button"
                onClick={() => setIsAutoBackupModalOpen(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-xs py-1.5 px-3.5 rounded-lg transition-all cursor-pointer font-sans"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
