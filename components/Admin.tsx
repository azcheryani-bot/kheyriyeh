
import React, { useState, useEffect } from 'react';
import { dbApi } from '../db-client';
import { Donation, Event, Admin, DisplaySettings } from '../types';
import { Spinner, CurrencyInput, ConfirmDialog } from './Shared';
import { useTheme } from '../App';
import { LiveStreamSection } from './LiveStreamSection';
import { ReceiptPrintModal } from './ReceiptPrintModal';
import { EventsArchiveManager } from './EventsArchiveManager';
import { formatJalaliDateTime, formatJalaliDate, formatJalaliTime } from '../persian-utils';

export const DEFAULT_SETTINGS: DisplaySettings = {
  fontSize: 40,
  scrollSpeed: 20,
  highThreshold: 5000000,
  midThreshold: 1000000,
  fontHigh: 'Vazirmatn',
  fontMid: 'Vazirmatn',
  fontLow: 'Vazirmatn',
  showAnnouncement: false,
  eventTitle: 'مراسم ترحیم',
  titleColor: '#ffffff',
  titleSize: 3.5,
  deceasedLabel: 'شادروان',
  deceasedLabelColor: '#fef3c7',
  deceasedLabelSize: 12,
  footerText: 'شادی روح درگذشتگان صلوات',
  footerColor: '#ffffff',
  footerSize: 14,
  smsUser: '',
  smsPass: '',
  smsFrom: '',
  smsDefaultText: '',
  obsFileLow: 'خط پايين.txt',
  obsFileMid: 'خط وسط.txt',
  obsFileHigh: 'خط بالا.txt',
  obsCapLow: 16,
  obsCapMid: 20,
  obsCapHigh: 10,
  obsSeparator: '-',
  obsFormat: '{donorName}({fatherName}){separator}',
  obsThresholdMid: 60000,
  obsThresholdHigh: 150000,
  githubToken: '',
  githubRepo: 'hudsonparker87/kheyriyeh2',
  githubWorkflow: 'streamer.yml',
  streamTargetUrl: 'https://kheyriyeh2.hudsonparker87.workers.dev/display',
  streamWorkerUrl: '',
  streamNeonUrl: 'https://br-lucky-wave-axbfuzrm.storage.c-4.us-east-2.aws.neon.tech/m3u8-streamer/live.m3u8',
  streamQuality: '720p',
  streamFps: 30,
  streamDuration: 60,
};

const AccordionSection: React.FC<{
  title: string;
  subtitle?: string;
  icon: string;
  isOpen: boolean;
  onToggle: () => void;
  badge?: React.ReactNode;
  children: React.ReactNode;
  colorTheme?: 'blue' | 'indigo' | 'purple' | 'amber' | 'emerald' | 'slate';
}> = ({ title, subtitle, icon, isOpen, onToggle, badge, children, colorTheme = 'slate' }) => {
  const iconBgStyles = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400',
    indigo: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400',
    amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400',
    emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400',
    slate: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  }[colorTheme];

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl border transition-all duration-200 shadow-sm overflow-hidden ${isOpen ? 'ring-2 ring-blue-500/20 border-blue-400 dark:border-blue-800' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}`}>
      <button
        onClick={onToggle}
        type="button"
        className="w-full p-4 md:p-5 flex items-center justify-between gap-4 text-right cursor-pointer select-none focus:outline-none group"
      >
        <div className="flex items-center gap-3 md:gap-4 min-w-0">
          <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105 shadow-sm ${iconBgStyles}`}>
            <i className={`fas ${icon} text-lg md:text-xl`}></i>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-slate-900 dark:text-white text-base md:text-lg">{title}</h3>
              {badge}
            </div>
            {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${isOpen ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'}`}>
            <span>{isOpen ? 'بستن' : 'نمایش تنظیمات'}</span>
            <i className={`fas ${isOpen ? 'fa-chevron-up' : 'fa-chevron-down'} text-[10px]`}></i>
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="p-4 md:p-6 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900/40 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
};

const SmsProxyManager: React.FC<{ settings: any; isSuperAdmin: boolean }> = ({ settings, isSuperAdmin }) => {
  const [loading, setLoading] = useState(false);
  const [statusResult, setStatusResult] = useState<any>(null);
  const [message, setMessage] = useState<{text: string; type: 'success'|'error'} | null>(null);

  const checkStatus = async () => {
    try {
      if (!settings?.githubToken || !settings?.githubRepo) {
        setStatusResult({ online: false });
        return;
      }
      const res = await fetch('/api/stream/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: settings.githubToken,
          repo: settings.githubRepo,
          workflow: 'sms-bridge.yml'
        })
      });
      const data = await res.json();
      if (data.success && data.latestRun) {
        const isRunning = data.latestRun.status === 'in_progress' || data.latestRun.status === 'queued';
        setStatusResult({ online: isRunning, updatedAt: data.latestRun.updated_at });
      } else {
        setStatusResult({ online: false });
      }
    } catch (err) {
      console.error(err);
      setStatusResult({ online: false });
    }
  };

  useEffect(() => {
    checkStatus();
    
    // Auto-refresh status every 15 seconds
    const interval = setInterval(() => {
      checkStatus();
    }, 15000);
    
    return () => clearInterval(interval);
  }, [settings?.githubToken, settings?.githubRepo]);

  const handleStart = async () => {
    if (!settings.githubToken || !settings.githubRepo) {
       setMessage({ 
         text: isSuperAdmin 
           ? 'برای روشن کردن سرور پیامک، لطفاً ابتدا توکن و نام مخزن گیت‌هاب را در بخش «پخش زنده» تنظیم کنید.' 
           : 'امکان روشن کردن سرور پیامک وجود ندارد. لطفاً با مدیر ارشد هماهنگ نمایید.', 
         type: 'error' 
       });
       return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const origin = window.location.origin;
      const callbackUrl = `${origin}/api/stream/sms-bridge-callback`;
      const res = await fetch('/api/stream/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: settings.githubToken,
          repo: settings.githubRepo,
          workflow: 'sms-bridge.yml',
          ref: 'main',
          callback_url: callbackUrl
        })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ 
          text: isSuperAdmin 
            ? 'دستور روشن شدن سرور به گیت‌هاب ارسال شد. سرور طی ۱-۲ دقیقه آینده روشن می‌شود. روی دکمه رفرش کلیک کنید تا وضعیت آپدیت شود.' 
            : 'دستور روشن شدن سرور پیامک با موفقیت ارسال شد. لطفاً حدود ۲ دقیقه صبر کرده و سپس روی دکمه بروزرسانی کلیک کنید.', 
          type: 'success' 
        });
      } else {
        setMessage({ text: data.error || 'خطا در ارسال دستور', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 mb-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-2">
            <i className="fas fa-server text-indigo-500"></i> {isSuperAdmin ? 'وضعیت سرور پیامک (پراکسی ضد تحریم)' : 'وضعیت سرور ارسال پیامک'}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
            {isSuperAdmin 
              ? 'برای دور زدن محدودیت‌های آی‌پی نیازپرداز، درخواست‌ها از طریق سرور گیت‌هاب ارسال می‌شوند. این سرور پس از روشن شدن حداکثر ۶ ساعت کار می‌کند.' 
              : 'وضعیت ارتباط با سرور پیامک. برای ارسال موفقیت‌آمیز پیامک‌ها، این سرور باید در وضعیت روشن قرار داشته باشد.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs font-bold flex items-center gap-2">
            {statusResult?.online ? (
              <span className="text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-md border border-emerald-200 dark:border-emerald-800/50"><i className="fas fa-circle text-[8px] animate-pulse"></i> روشن (متصل)</span>
            ) : (
              <span className="text-rose-600 bg-rose-50 dark:bg-rose-900/30 px-2 py-1 rounded-md border border-rose-200 dark:border-rose-800/50"><i className="fas fa-circle text-[8px]"></i> خاموش</span>
            )}
          </div>
          <button onClick={handleStart} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-2">
            {loading ? <Spinner size="w-3 h-3" /> : <i className="fas fa-power-off"></i>} روشن کردن سرور
          </button>
          <button onClick={checkStatus} className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-xs px-3 py-2 rounded-lg transition-all">
            <i className="fas fa-sync-alt"></i>
          </button>
        </div>
      </div>
      {message && (
        <div className={`mt-3 p-3 rounded-lg text-xs font-bold ${message.type === 'error' ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
          {message.text}
        </div>
      )}
    </div>
  );
};

type SettingsSubTab = 'general' | 'images' | 'fonts' | 'thresholds_obs' | 'sms' | 'admins' | 'stream';

export const AdminPanel: React.FC<{ 
  currentUser: Admin; 
  onLogout: () => void; 
  onShowDisplay: () => void;
  activeTab?: 'donations' | 'settings' | 'events' | 'admins' | 'stream';
  onTabChange?: (tab: 'donations' | 'settings' | 'events' | 'admins' | 'stream') => void;
}> = ({ currentUser, onLogout, onShowDisplay, activeTab: externalTab, onTabChange }) => {
  const { isDark, toggleTheme } = useTheme();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [internalTab, setInternalTab] = useState<'donations' | 'settings' | 'events'>('donations');
  const [settingsSubTab, setSettingsSubTab] = useState<SettingsSubTab>('general');

  // Normalize activeTab so that 'admins' and 'stream' navigate to settings sub-tabs
  const activeTab: 'donations' | 'settings' | 'events' = 
    externalTab === 'admins' || externalTab === 'stream' 
      ? 'settings' 
      : (externalTab || internalTab);

  const setActiveTab = (tab: 'donations' | 'settings' | 'events' | 'admins' | 'stream') => {
    if (tab === 'admins') {
      setInternalTab('settings');
      setSettingsSubTab('admins');
      if (onTabChange) onTabChange('settings');
    } else if (tab === 'stream') {
      setInternalTab('settings');
      setSettingsSubTab('stream');
      if (onTabChange) onTabChange('settings');
    } else {
      setInternalTab(tab as 'donations' | 'settings' | 'events');
      if (onTabChange) onTabChange(tab);
    }
  };

  useEffect(() => {
    if (externalTab === 'admins') {
      setSettingsSubTab('admins');
    } else if (externalTab === 'stream') {
      setSettingsSubTab('stream');
    }
  }, [externalTab]);

  const [loading, setLoading] = useState(false);
  const [actionIds, setActionIds] = useState<Record<string, boolean>>({});
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Forms
  const [donationForm, setDonationForm] = useState({ name: '', father: '', mobile: '', amount: '', desc: '', type: 'pos' as any, hide: false });
  const [settings, setSettings] = useState<DisplaySettings>(DEFAULT_SETTINGS);
  const [directoryHandle, setDirectoryHandle] = useState<any>(null);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newAdmin, setNewAdmin] = useState({ username: '', displayName: '', password: '' });
  const [editingAdmin, setEditingAdmin] = useState<{ id: string; username: string; displayName: string; password?: string } | null>(null);
  const [viewReceipt, setViewReceipt] = useState<string | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [printReceiptDonation, setPrintReceiptDonation] = useState<Donation | null>(null);
  const [showEventsArchiveManager, setShowEventsArchiveManager] = useState(false);

  // Edit Event state
  const [editingEvent, setEditingEvent] = useState<{ id: string; title: string } | null>(null);

  // Edit Donation state
  const [editingDonation, setEditingDonation] = useState<Donation | null>(null);
  const [editDonationForm, setEditDonationForm] = useState<{
    donorName: string;
    fatherName: string;
    mobile: string;
    amount: string;
    paymentType: any;
    description: string;
    hideName: boolean;
    event_id: string;
  } | null>(null);

  const openReceipt = async (id: string) => {
    setReceiptLoading(true);
    try {
      const res = await dbApi.donations.getReceipt(id);
      if (res?.receiptImage) {
        setViewReceipt(res.receiptImage);
      } else {
        alert('تصویر رسید برای این تراکنش یافت نشد.');
      }
    } catch (err) {
      alert('مشکلی در بارگذاری تصویر رسید پیش آمد.');
    } finally {
      setReceiptLoading(false);
    }
  };

  const handleUpdateEvent = async () => {
    if (!editingEvent || !editingEvent.title.trim()) return;
    setLoading(true);
    try {
      await dbApi.events.update(editingEvent.id, { title: editingEvent.title.trim() });
      if (activeEventId === editingEvent.id) {
        handleUpdateSettings({ eventTitle: editingEvent.title.trim() });
      }
      setEditingEvent(null);
      await loadEvents();
    } catch (err) {
      alert('خطا در ویرایش مراسم.');
    }
    setLoading(false);
  };

  const openEditDonation = (donation: Donation) => {
    setEditingDonation(donation);
    setEditDonationForm({
      donorName: donation.donorName || '',
      fatherName: donation.fatherName || '',
      mobile: donation.mobile || '',
      amount: String(donation.amount || ''),
      paymentType: donation.paymentType || 'pos',
      description: donation.description || '',
      hideName: !!donation.hideName,
      event_id: donation.event_id || activeEventId || (events[0]?.id || '')
    });
  };

  const handleSaveDonationEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDonation || !editDonationForm || !editDonationForm.donorName || !editDonationForm.amount) return;
    setActionIds(p => ({ ...p, [`edit_${editingDonation.id}`]: true }));
    try {
      await dbApi.donations.update(editingDonation.id, {
        donorName: editDonationForm.donorName,
        fatherName: editDonationForm.fatherName,
        mobile: editDonationForm.mobile,
        amount: parseInt(editDonationForm.amount),
        paymentType: editDonationForm.paymentType,
        description: editDonationForm.description,
        hideName: editDonationForm.hideName,
        event_id: editDonationForm.event_id
      });
      setEditingDonation(null);
      setEditDonationForm(null);
      await loadDonations(selectedEventId);
    } catch (err) {
      alert('خطا در ویرایش تراکنش.');
    }
    setActionIds(p => ({ ...p, [`edit_${editingDonation.id}`]: false }));
  };

  // SMS Test & Credit States
  const [testMobile, setTestMobile] = useState('');
  const [testSmsLoading, setTestSmsLoading] = useState(false);
  const [testSmsResult, setTestSmsResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [creditLoading, setCreditLoading] = useState(false);
  const [creditResult, setCreditResult] = useState<string | null>(null);

  // New SMS Features States
  const [senderNumbers, setSenderNumbers] = useState<string[]>([]);
  const [fetchingSenders, setFetchingSenders] = useState(false);
  const [blacklistMobile, setBlacklistMobile] = useState('');
  const [blacklistLoading, setBlacklistLoading] = useState(false);
  const [blacklistResult, setBlacklistResult] = useState<string | null>(null);
  const [contentChecking, setContentChecking] = useState(false);
  const [contentCheckResult, setContentCheckResult] = useState<string | null>(null);

  // Group SMS Modal State
  const [groupSmsModalOpen, setGroupSmsModalOpen] = useState(false);
  const [groupSmsText, setGroupSmsText] = useState('');
  const [groupSmsSending, setGroupSmsSending] = useState(false);
  const [groupSmsProgress, setGroupSmsProgress] = useState<{ total: number; sent: number; failed: number } | null>(null);

  // Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const requestConfirmation = (title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        onConfirm();
      }
    });
  };

  // Selected Event Filter State (defaults to 'all' or saved event ID)
  const [selectedEventId, setSelectedEventId] = useState<string>(() => {
    return localStorage.getItem('admin_selected_event_id') || 'all';
  });

  const changeSelectedEvent = (id: string) => {
    setSelectedEventId(id);
    localStorage.setItem('admin_selected_event_id', id);
    loadDonations(id);
  };

  useEffect(() => {
    loadEvents();
    loadSettings();
    if (currentUser.role === 'superadmin') loadAdmins();
  }, []);

  useEffect(() => {
    if (directoryHandle) {
      generateObsFiles(directoryHandle);
    }
  }, [donations, directoryHandle, settings]);

  useEffect(() => {
    // Initial fetch
    loadDonations(selectedEventId);
    loadEvents();
    if (currentUser.role === 'superadmin') loadAdmins();

    // Real-time SSE Subscription (now using Socket.io)
    const unsubscribe = dbApi.subscribe(() => {
      loadDonations(selectedEventId);
      loadEvents();
      if (currentUser.role === 'superadmin') loadAdmins();
    });

    return () => {
      unsubscribe();
    };
  }, [selectedEventId]);

  const handleApiError = (err: any) => {
    if (err?.response?.status === 401) {
      onLogout();
    } else {
      console.error(err);
    }
  };

  const loadEvents = async () => {
    try {
      const data = await dbApi.events.getAll();
      if (Array.isArray(data)) {
        setEvents(data);
        const active = data.find(e => e.isactive);
        if (active) {
          setActiveEventId(active.id);
        } else if (data.length > 0) {
          setActiveEventId(data[0].id);
        }
      } else {
        setEvents([]);
      }
    } catch (err) {
      handleApiError(err);
    }
  };

  const loadDonations = async (id: string) => {
    try {
      const data = await dbApi.donations.getByEvent(id || selectedEventId || 'all');
      if (Array.isArray(data)) {
        setDonations(data);
      } else {
        setDonations([]);
      }
    } catch (err) {
      handleApiError(err);
    }
  };

  const loadSettings = async () => {
    try {
      const data = await dbApi.config.get('displaySettings');
      if (data?.value && typeof data.value === 'object') {
        setSettings(prev => ({ ...DEFAULT_SETTINGS, ...data.value }));
      } else {
        await dbApi.config.upsert('displaySettings', DEFAULT_SETTINGS);
      }
    } catch (err) {
      handleApiError(err);
    }
  };

  const loadAdmins = async () => {
    try {
      const data = await dbApi.admins.getAll();
      if (Array.isArray(data)) {
        setAdmins(data);
      } else {
        setAdmins([]);
      }
    } catch (err) {
      handleApiError(err);
    }
  };

  const handleUpdateSettings = async (updates: Partial<DisplaySettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
    await dbApi.config.upsert('displaySettings', updates);
  };

  const downloadFile = (filename: string, content: string) => {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,%EF%BB%BF' + encodeURIComponent(content));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const selectDirectory = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      setDirectoryHandle(handle);
      alert("پوشه با موفقیت انتخاب شد. فایل‌ها خودکار ذخیره می‌شوند.");
      generateObsFiles(handle);
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error(error);
        alert("خطا در انتخاب پوشه. مرورگر شما ممکن است پشتیبانی نکند.");
      }
    }
  };

  const writeFile = async (handle: any, filename: string, content: string) => {
    try {
      const fileHandle = await handle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(new Uint8Array([0xEF, 0xBB, 0xBF]));
      await writable.write(content);
      await writable.close();
      return true;
    } catch (error) {
      console.error("Error writing file", error);
      return false;
    }
  };

  const generateObsFiles = async (handle = directoryHandle) => {
    let bottomStr = '';
    let middleStr = '';
    let topStr = '';
    
    let cnt1 = 0, cnt2 = 0, cnt3 = 0;
    
    // Sort oldest to newest or keep as is (original HTML had reversed array, but we order by createdAt descending, so we might need to reverse to show oldest first or keep them newest first)
    // Actually HTML used reverse on an array that was oldest first, making it newest first. Since our DB returns newest first, we don't need to reverse.
    const activeDonations = [...donations].filter(d => d.status === 'approved' && !d.hideName);
    
    const midThreshold = settings?.obsThresholdMid || 60000;
    const highThreshold = settings?.obsThresholdHigh || 150000;
    const capLow = settings?.obsCapLow || 16;
    const capMid = settings?.obsCapMid || 20;
    const capHigh = settings?.obsCapHigh || 10;
    
    for (let d of activeDonations) {
      let formatStr = '';
      if (settings?.obsFormat) {
          formatStr = settings.obsFormat
            .replace(/{donorName}/g, d.donorName || '')
            .replace(/{fatherName}/g, d.fatherName || '')
            .replace(/{separator}/g, settings?.obsSeparator || '-');
      } else {
          formatStr = `${d.donorName || ''}(${d.fatherName || ''})-`;
      }
      
      const amt = d.amount || 0;
      
      if (amt < midThreshold && cnt1 < capLow) {
         bottomStr += formatStr;
         cnt1++;
      } else if (amt >= midThreshold && amt < highThreshold && cnt2 < capMid) {
         middleStr += formatStr;
         cnt2++;
      } else if (amt >= highThreshold && cnt3 < capHigh) {
         topStr += formatStr;
         cnt3++;
      }
    }
    
    if (handle) {
      await writeFile(handle, settings?.obsFileLow || 'خط پايين.txt', bottomStr);
      await writeFile(handle, settings?.obsFileMid || 'خط وسط.txt', middleStr);
      await writeFile(handle, settings?.obsFileHigh || 'خط بالا.txt', topStr);
    } else {
      downloadFile(settings?.obsFileLow || 'خط پايين.txt', bottomStr);
      downloadFile(settings?.obsFileMid || 'خط وسط.txt', middleStr);
      downloadFile(settings?.obsFileHigh || 'خط بالا.txt', topStr);
    }
  };

  const exportExcel = async () => {
    if (donations.length === 0) return alert('داده‌ای وجود ندارد.');
    const ExcelJS = (await import('exceljs')).default || await import('exceljs');
    const workbook = new (ExcelJS as any).Workbook();
    const worksheet = workbook.addWorksheet('Sheet1', { views: [{ rightToLeft: true }] });

    worksheet.columns = [
        { key: 'id', width: 8 },
        { key: 'donorName', width: 25 },
        { key: 'father', width: 15 },
        { key: 'mobile', width: 18 },
        { key: 'amount', width: 18 },
        { key: 'payment_type', width: 15 },
        { key: 'jalaliDate', width: 22 },
        { key: 'registeredBy', width: 18 },
        { key: 'desc', width: 35 },
        { key: 'status', width: 15 },
    ];

    const titleCell = worksheet.getCell('A1');
    worksheet.mergeCells('A1:J1');
    titleCell.value = settings?.eventTitle || 'لیست تراکنش‌ها';
    titleCell.font = { name: 'Tahoma', size: 12, bold: true };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    const headerRow = worksheet.getRow(2);
    headerRow.values = ['ردیف', 'نام خیّر', 'نام پدر', 'موبایل', 'مبلغ(تومان)', 'نوع پرداخت', 'تاریخ و ساعت شمسی', 'مدیر ثبت‌کننده', 'توضیحات', 'وضعیت'];
    headerRow.eachCell((cell: any) => {
        cell.font = { name: 'Tahoma', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    donations.forEach((d, index) => {
        const jalali = formatJalaliDateTime(d.createdAt);
        const row = worksheet.addRow({
            id: donations.length - index,
            donorName: d.donorName,
            father: d.fatherName,
            mobile: d.mobile,
            amount: d.amount,
            payment_type: {'pos': 'کارتخوان', 'cash': 'نقدی', 'card': 'کارت به کارت', 'online': 'درگاه آنلاین', 'card_cash': 'کارت+نقدی', 'mock': 'صوری', 'transfer': 'حواله‌ای'}[d.paymentType] || d.paymentType,
            jalaliDate: jalali.full,
            registeredBy: d.registeredBy || 'مدیریت',
            desc: d.description,
            status: d.status === 'approved' ? 'تایید شده' : 'در انتظار'
        });
        row.eachCell((cell: any, colNumber: number) => {
            cell.font = { name: 'Tahoma', size: 10 };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = { top: { style: 'dotted' }, left: { style: 'dotted' }, bottom: { style: 'dotted' }, right: { style: 'dotted' } };
            if (colNumber === 5) cell.numFmt = '#,##0';
        });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "donations_list.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleCreateEvent = async () => {
    if (!newEventTitle) return;
    setLoading(true);
    const data = await dbApi.events.create(newEventTitle);
    if (data) {
      setNewEventTitle('');
      loadEvents();
      setActiveEventId(data.id);
      handleUpdateSettings({ eventTitle: data.title });
    }
    setLoading(false);
  };

  const handleDeleteEvent = (id: string, title: string) => {
    requestConfirmation(
      'حذف مراسم',
      `آیا مراسم «${title}» حذف شود؟ تمام تراکنش‌ها نیز حذف می‌شوند. این عملیات غیرقابل بازگشت است.`,
      async () => {
        setActionIds(p => ({ ...p, [id]: true }));
        await dbApi.events.delete(id);
        loadEvents();
        setActionIds(p => ({ ...p, [id]: false }));
      }
    );
  };

  const [rejectPrompt, setRejectPrompt] = useState<{ id: string, text: string, mobile: string } | null>(null);

  const getSmsApiUrl = () => {
    const baseApi = import.meta.env.VITE_API_URL || '/api';
    let clean = baseApi.endsWith('/db') ? baseApi.replace(/\/db$/, '') : baseApi;
    return clean.replace(/\/+$/, '');
  };

  const sendSms = async (mobile: string, text?: string, id?: string): Promise<{ success: boolean; error?: string; message?: string; batchId?: number }> => {
    const user = settings?.smsUser?.trim();
    const pass = settings?.smsPass?.trim();
    const from = settings?.smsFrom?.trim();
    const finalMsg = text || settings?.smsDefaultText?.trim();

    if (!user || !pass || !from) {
      const errMsg = 'تنظیمات پیامک (نام کاربری، رمز یا شماره فرستنده) در بخش تنظیمات کامل نشده است.';
      if (id) await dbApi.donations.update(id, { smsStatus: 'failed', smsError: errMsg });
      return { success: false, error: errMsg };
    }

    if (!mobile || mobile === '-') {
      const errMsg = 'شماره موبایل نامعتبر یا وارد نشده است.';
      if (id) await dbApi.donations.update(id, { smsStatus: 'failed', smsError: errMsg });
      return { success: false, error: errMsg };
    }

    if (!finalMsg) {
      const errMsg = 'متن پیش‌فرض پیامک مشخص نشده است.';
      if (id) await dbApi.donations.update(id, { smsStatus: 'failed', smsError: errMsg });
      return { success: false, error: errMsg };
    }

    try {
      const apiUrl = getSmsApiUrl();
      const res = await fetch(`${apiUrl}/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user,
          password: pass,
          from: from,
          to: mobile,
          text: finalMsg
        })
      });
      let data: any = {};
      try {
        data = await res.json();
      } catch (jsonErr) {
        data = { success: false, error: `خطا در دریافت پاسخ از سرور (کد ${res.status})` };
      }

      if (data.success) {
        if (id) {
          await dbApi.donations.update(id, {
            smsStatus: 'sent',
            batchSmsId: data.batchId ? String(data.batchId) : undefined,
            smsError: undefined
          });
        }
        return { success: true, message: data.message, batchId: data.batchId };
      } else {
        const errMsg = data.error || `خطا در ارسال پیامک (کد ${data.code || -1})`;
        if (id) await dbApi.donations.update(id, { smsStatus: 'failed', smsError: errMsg });
        return { success: false, error: errMsg };
      }
    } catch (e: any) {
      const errMsg = e.message || 'خطا در شبکه سرور';
      if (id) await dbApi.donations.update(id, { smsStatus: 'failed', smsError: errMsg });
      return { success: false, error: errMsg };
    }
  };

  const handleTestSms = async () => {
    if (!settings.smsUser || !settings.smsPass || !settings.smsFrom) {
      setTestSmsResult({ type: 'error', msg: 'لطفاً نام کاربری، رمز عبور و شماره فرستنده را در بخش تنظیمات پیامک وارد نمایید.' });
      return;
    }
    if (!testMobile) {
      setTestSmsResult({ type: 'error', msg: 'لطفاً شماره موبایل گیرنده را برای تست وارد کنید.' });
      return;
    }
    setTestSmsLoading(true);
    setTestSmsResult(null);
    try {
      const res = await sendSms(testMobile, settings.smsDefaultText || 'تست ارسال پیامک سامانه اکرام');
      if (res.success) {
        setTestSmsResult({ type: 'success', msg: '✔ پیامک تست با موفقیت به سامانه پیامک تحویل داده شد.' });
      } else {
        setTestSmsResult({ type: 'error', msg: `❌ ${res.error}` });
      }
    } catch (e: any) {
      setTestSmsResult({ type: 'error', msg: `❌ ${e.message || String(e)}` });
    }
    setTestSmsLoading(false);
  };

  const handleCheckCredit = async () => {
    if (!settings.smsUser || !settings.smsPass) {
      setCreditResult('نام کاربری و رمز عبور وارد نشده است.');
      return;
    }
    setCreditLoading(true);
    setCreditResult(null);
    try {
      const apiUrl = getSmsApiUrl();
      const res = await fetch(`${apiUrl}/sms/credit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: settings.smsUser.trim(), password: settings.smsPass.trim() })
      });
      let data: any = {};
      try {
        data = await res.json();
      } catch {
        data = { success: false, error: `پاسخ نامعتبر از سرور (کد ${res.status})` };
      }
      if (data.success) {
        setCreditResult(`✔ اعتبار باقیمانده پنل: ${(data.credit || 0).toLocaleString('fa-IR')} پیامک (داده سرور: ${JSON.stringify(data)})`);
      } else {
        setCreditResult(`❌ خطا: ${data.error}`);
      }
    } catch (e: any) {
      setCreditResult(`❌ خطا در ارتباط: ${e.message || String(e)}`);
    }
    setCreditLoading(false);
  };

  const handleGetSenders = async () => {
    if (!settings.smsUser || !settings.smsPass) {
      alert('لطفاً ابتدا نام کاربری و رمز عبور پنل را وارد نمایید.');
      return;
    }
    setFetchingSenders(true);
    try {
      const apiUrl = getSmsApiUrl();
      const res = await fetch(`${apiUrl}/sms/senders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: settings.smsUser.trim(), password: settings.smsPass.trim() })
      });
      let data: any = {};
      try {
        data = await res.json();
      } catch {
        data = { success: false, error: `پاسخ نامعتبر از سرور (کد ${res.status})` };
      }
      if (data.success && Array.isArray(data.numbers)) {
        setSenderNumbers(data.numbers);
        if (data.numbers.length === 1) {
          handleUpdateSettings({ smsFrom: data.numbers[0] });
        }
        alert(`تعداد ${data.numbers.length} شماره خط اختصاصی یافت شد:\n${data.numbers.join('\n')}`);
      } else {
        alert(data.error || 'خطایی در دریافت لیست خطوط رخ داد.');
      }
    } catch (e: any) {
      alert(`خطا: ${e.message || String(e)}`);
    }
    setFetchingSenders(false);
  };

  const handleCheckBlacklist = async () => {
    if (!settings.smsUser || !settings.smsPass) {
      setBlacklistResult('نام کاربری و رمز عبور پنل پیامک را در تنظیمات وارد نمایید.');
      return;
    }
    if (!blacklistMobile) {
      setBlacklistResult('لطفاً شماره موبایل را وارد کنید.');
      return;
    }
    setBlacklistLoading(true);
    setBlacklistResult(null);
    try {
      const apiUrl = getSmsApiUrl();
      const res = await fetch(`${apiUrl}/sms/check-blacklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: settings.smsUser.trim(),
          password: settings.smsPass.trim(),
          mobile: blacklistMobile
        })
      });
      let data: any = {};
      try {
        data = await res.json();
      } catch {
        data = { success: false, error: `پاسخ نامعتبر از سرور (کد ${res.status})` };
      }
      if (data.success) {
        setBlacklistResult(data.message);
      } else {
        setBlacklistResult(`❌ ${data.error}`);
      }
    } catch (e: any) {
      setBlacklistResult(`❌ خطا: ${e.message || String(e)}`);
    }
    setBlacklistLoading(false);
  };

  const handleCheckContent = async () => {
    if (!settings.smsUser || !settings.smsPass) {
      setContentCheckResult('نام کاربری و رمز عبور پنل پیامک را وارد کنید.');
      return;
    }
    if (!settings.smsDefaultText) {
      setContentCheckResult('متن پیامک خالی است.');
      return;
    }
    setContentChecking(true);
    setContentCheckResult(null);
    try {
      const apiUrl = getSmsApiUrl();
      const res = await fetch(`${apiUrl}/sms/check-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: settings.smsUser.trim(),
          password: settings.smsPass.trim(),
          content: settings.smsDefaultText
        })
      });
      let data: any = {};
      try {
        data = await res.json();
      } catch {
        data = { success: false, error: `پاسخ نامعتبر از سرور (کد ${res.status})` };
      }
      if (data.success) {
        setContentCheckResult(data.message);
      } else {
        setContentCheckResult(`❌ ${data.error}`);
      }
    } catch (e: any) {
      setContentCheckResult(`❌ خطا: ${e.message || String(e)}`);
    }
    setContentChecking(false);
  };

  const handleQueryDeliveryStatus = async (donation: Donation) => {
    if (!settings.smsUser || !settings.smsPass) {
      return alert('اطلاعات پنل پیامک در تنظیمات وارد نشده است.');
    }
    const batchId = donation.batchSmsId || (donation as any).batchId;
    if (!batchId || batchId === '0' || batchId === 0) {
      return alert('شناسه ارسال (batchSmsId) برای این تراکنش ثبت نشده است.');
    }

    setActionIds(p => ({ ...p, [`delivery_${donation.id}`]: true }));
    try {
      const apiUrl = getSmsApiUrl();
      const res = await fetch(`${apiUrl}/sms/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: settings.smsUser.trim(),
          password: settings.smsPass.trim(),
          batchSmsId: batchId,
          mobile: donation.mobile
        })
      });
      let data: any = {};
      try {
        data = await res.json();
      } catch {
        data = { success: false, error: `پاسخ نامعتبر از سرور (کد ${res.status})` };
      }
      if (data.success) {
        if (data.status === 1) {
          await dbApi.donations.update(donation.id, { smsStatus: 'sent', smsError: 'تحویل داده شده به گوشی (Delivered) ✓' });
        } else if (data.status > 1 && data.status <= 11) {
          await dbApi.donations.update(donation.id, { smsStatus: 'failed', smsError: data.statusText });
        }
        alert(`وضعیت تحویل پیامک به ${donation.donorName} (${donation.mobile}):\n\n📌 شناسه ارسال: ${batchId}\n📌 وضعیت: ${data.statusText}`);
        await loadDonations(selectedEventId);
      } else {
        alert(`اطلاعات تحویل (شناسه ${batchId}):\n${data.statusText || data.error || 'یافت نشد'}`);
      }
    } catch (e: any) {
      alert(`خطا در استعلام: ${e.message || String(e)}`);
    }
    setActionIds(p => ({ ...p, [`delivery_${donation.id}`]: false }));
  };

  const handleSendGroupSms = async () => {
    if (!settings.smsUser || !settings.smsPass || !settings.smsFrom) {
      return alert('اطلاعات نام کاربری، رمز عبور و شماره فرستنده پیامک ناقص است.');
    }
    if (!groupSmsText) {
      return alert('لطفاً متن پیامک را وارد نمایید.');
    }

    const donorsWithMobile = donations.filter(d => d.mobile && d.mobile.trim().length >= 10);
    if (donorsWithMobile.length === 0) {
      return alert('هیچ اهداکننده‌ای با شماره موبایل معتبر یافت نشد.');
    }

    requestConfirmation(
      'ارسال پیامک گروهی',
      `آیا از ارسال پیامک گروهی به ${donorsWithMobile.length} اهداکننده اطمینان دارید؟`,
      async () => {
        setGroupSmsSending(true);
        setGroupSmsProgress({ total: donorsWithMobile.length, sent: 0, failed: 0 });

        let sentCount = 0;
        let failedCount = 0;

        for (const d of donorsWithMobile) {
          const res = await sendSms(d.mobile!, groupSmsText, d.id);
          if (res.success) {
            sentCount++;
          } else {
            failedCount++;
          }
          setGroupSmsProgress({ total: donorsWithMobile.length, sent: sentCount, failed: failedCount });
        }

        setGroupSmsSending(false);
        alert(`ارسال گروهی پایان یافت.\nموفق: ${sentCount}\nناموفق: ${failedCount}`);
        if (activeEventId) await loadDonations(activeEventId);
      }
    );
  };

  const handleResendSms = async (donation: Donation) => {
    if (!donation.mobile || donation.mobile === '-') return alert('شماره موبایلی برای این تراکنش ثبت نشده است.');
    setActionIds(p => ({ ...p, [`resend_sms_${donation.id}`]: true }));
    const msg = settings?.smsDefaultText || 'تراکنش شما ثبت شد. با تشکر، مرکز اکرام';
    const res = await sendSms(donation.mobile, msg, donation.id);
    if (activeEventId) await loadDonations(activeEventId);
    setActionIds(p => ({ ...p, [`resend_sms_${donation.id}`]: false }));
    if (res.success) {
      alert('پیامک با موفقیت ارسال شد.');
    } else {
      alert(`خطا در ارسال پیامک:\n${res.error}`);
    }
  };

  const handleAddDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveEventId = activeEventId || events.find(e => e.isactive)?.id || events[0]?.id;
    if (!effectiveEventId || !donationForm.name || !donationForm.amount) {
      if (!effectiveEventId) {
        alert('لطفاً ابتدا یک مراسم ایجاد یا فعال نمایید.');
      }
      return;
    }
    setLoading(true);
    let data = null;
    let error = null;
    try {
      data = await dbApi.donations.create({
        event_id: effectiveEventId,
        donorName: donationForm.name,
        fatherName: donationForm.father,
        mobile: donationForm.mobile,
        amount: parseInt(donationForm.amount),
        description: donationForm.desc,
        paymentType: donationForm.type,
        hideName: donationForm.hide,
        registeredBy: currentUser.displayName || currentUser.username,
        status: 'approved',
        smsStatus: donationForm.mobile ? 'pending' : 'not_sent'
      });
    } catch(e: any) { 
      error = e; 
      alert('خطا در ثبت تراکنش: ' + (e?.response?.data?.error || e.message || 'خطای سرور'));
    }
    if (!error && data) {
        setDonationForm({ name: '', father: '', mobile: '', amount: '', desc: '', type: 'pos', hide: false });
        if (window.innerWidth < 768) setMobileMenuOpen(false);
        if (data.mobile && data.mobile !== '-') {
          await sendSms(data.mobile, settings?.smsDefaultText, data.id);
        }
        changeSelectedEvent(effectiveEventId);
    }
    setLoading(false);
  };

  const handleToggleDonationStatus = async (donation: Donation, action: 'approve' | 'reject' | 'pending') => {
    if (action === 'reject') {
      // Rejection flow
      if (donation.mobile && donation.mobile !== '-') {
        setRejectPrompt({ id: donation.id, text: 'پرداخت شما تایید نشد. لطفا پیگیری نمایید.', mobile: donation.mobile });
      } else {
        setActionIds(p => ({ ...p, [`status_${donation.id}`]: true }));
        await dbApi.donations.update(donation.id, { status: 'pending' });
        await dbApi.donations.delete(donation.id);
        await loadDonations(selectedEventId);
        setActionIds(p => ({ ...p, [`status_${donation.id}`]: false }));
      }
    } else if (action === 'approve') {
      // Approval flow
      setActionIds(p => ({ ...p, [`status_${donation.id}`]: true }));
      await dbApi.donations.update(donation.id, { status: 'approved' });
      if (donation.mobile && donation.mobile !== '-' && donation.smsStatus !== 'sent') {
        await sendSms(donation.mobile, settings?.smsDefaultText, donation.id);
      }
      await loadDonations(selectedEventId);
      setActionIds(p => ({ ...p, [`status_${donation.id}`]: false }));
    } else if (action === 'pending') {
      // Revert to pending
      setActionIds(p => ({ ...p, [`status_${donation.id}`]: true }));
      await dbApi.donations.update(donation.id, { status: 'pending' });
      await loadDonations(selectedEventId);
      setActionIds(p => ({ ...p, [`status_${donation.id}`]: false }));
    }
  };

  const submitRejectSms = async (send: boolean) => {
    if (!rejectPrompt) return;
    const { id, text, mobile } = rejectPrompt;
    setActionIds(p => ({ ...p, [`status_${id}`]: true }));
    setRejectPrompt(null);
    await dbApi.donations.delete(id);
    if (send) {
      await sendSms(mobile, text, id);
    }
    await loadDonations(selectedEventId);
    setActionIds(p => ({ ...p, [`status_${id}`]: false }));
  };

  const handleDeleteDonation = (id: string) => {
    requestConfirmation(
      'حذف تراکنش',
      'آیا از حذف این تراکنش اطمینان دارید؟',
      async () => {
        setActionIds(p => ({ ...p, [`del_${id}`]: true }));
        await dbApi.donations.delete(id);
        await loadDonations(selectedEventId);
        setActionIds(p => ({ ...p, [`del_${id}`]: false }));
      }
    );
  };

  const handleFileUpload = (file: File, field: keyof DisplaySettings) => {
    setActionIds(prev => ({ ...prev, [`upload_${field}`]: true }));
    const reader = new FileReader();
    reader.onload = (e) => {
      // For fonts, we use dataURL directly. For images, we compress.
      if (field === 'customFontData') {
        handleUpdateSettings({ [field]: e.target?.result as string });
        setActionIds(prev => ({ ...prev, [`upload_${field}`]: false }));
        return;
      }

      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const scale = 800 / img.width;
        canvas.width = 800;
        canvas.height = img.height * scale;
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        handleUpdateSettings({ [field]: dataUrl });
        setActionIds(prev => ({ ...prev, [`upload_${field}`]: false }));
      };
    };
    reader.readAsDataURL(file);
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdmin.username.trim() || !newAdmin.password.trim()) return;
    setLoading(true);
    try {
      await dbApi.admins.create({
        username: newAdmin.username.trim(),
        displayName: newAdmin.displayName.trim() || newAdmin.username.trim(),
        password: newAdmin.password.trim(),
        role: 'admin'
      });
      setNewAdmin({ username: '', displayName: '', password: '' });
      await loadAdmins();
    } catch (err: any) {
      alert('خطا در افزودن مدیر: ' + (err?.response?.data?.error || err.message || 'خطای سرور'));
    }
    setLoading(false);
  };

  const handleSaveEditAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;
    setLoading(true);
    try {
      await dbApi.admins.update(editingAdmin.id, {
        displayName: editingAdmin.displayName.trim() || editingAdmin.username,
        password: editingAdmin.password?.trim() ? editingAdmin.password.trim() : undefined
      });
      setEditingAdmin(null);
      await loadAdmins();
    } catch (err: any) {
      alert('خطا در ویرایش اطلاعات مدیر: ' + (err?.response?.data?.error || err.message || 'خطای سرور'));
    }
    setLoading(false);
  };

  const handlePrint = (showAmount: boolean) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    let tableHeader = '', tableBody = '';
    if (showAmount) {
        tableHeader = `<tr><th style="width:4%">ردیف</th><th style="width:16%">نام خیِّر</th><th style="width:12%">نام پدر</th><th style="width:12%">موبایل</th><th style="width:13%">مبلغ (تومان)</th><th style="width:9%">نوع</th><th style="width:14%">تاریخ و ساعت</th><th style="width:10%">ثبت‌کننده</th><th>توضیحات</th></tr>`;
        tableBody = donations.map((d, i) => {
          const pType = {
            'pos': 'کارتخوان',
            'cash': 'نقدی',
            'card': 'کارت به کارت',
            'online': 'درگاه آنلاین',
            'card_cash': 'کارت+نقدی',
            'mock': 'صوری',
            'transfer': 'حواله‌ای'
          }[d.paymentType] || d.paymentType;
          const jalali = formatJalaliDateTime(d.createdAt);
          return `<tr><td>${i + 1}</td><td>${d.donorName||'-'}</td><td>${d.fatherName||'-'}</td><td>${d.mobile||'-'}</td><td>${(d.amount||0).toLocaleString()}</td><td>${pType}</td><td>${jalali.full}</td><td>${d.registeredBy||'مدیریت'}</td><td>${d.description||'-'}</td></tr>`;
        }).join('');
    } else {
        tableHeader = `<tr><th style="width:10%">ردیف</th><th style="width:50%">نام خیِّر</th><th style="width:40%">نام پدر</th></tr>`;
        tableBody = donations.map((d, i) => `<tr><td>${i + 1}</td><td>${d.donorName||'-'}</td><td>${d.fatherName||'-'}</td></tr>`).join('');
    }
    
    const html = `
      <html dir="rtl">
      <head>
        <title>لیست پرداخت‌ها</title>
        <style>
          body{font-family:Tahoma;padding:20px}
          table{width:100%;border-collapse:collapse;margin-top:20px;font-size:14px}
          th,td{border:1px solid #ccc;padding:8px;text-align:right}
          th{background:#eee}
          .header{text-align:center;margin-bottom:30px}
          @media print{.no-print{display:none}}
        </style>
      </head>
      <body>
        <div class="header">
          <h2>${settings?.eventTitle||'لیست پرداخت‌های مردمی'}</h2>
          <p>تاریخ چاپ: ${new Date().toLocaleDateString('fa-IR')}</p>
        </div>
        <table><thead>${tableHeader}</thead><tbody>${tableBody}</tbody></table>
        ${showAmount ? `<div style="margin-top:20px;font-weight:bold;">جمع کل: ${donations.reduce((a,b)=>a+(b.amount||0),0).toLocaleString()} تومان</div>` : ''}
        <script>window.onload=function(){window.print();window.close()}<\/script>
      </body>
      </html>`;
      
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const activeEventTitle = events.find(e => e.id === activeEventId)?.title || 'نامشخص';

  const fonts = ['Vazirmatn', 'Lalezar', 'Noto Nastaliq Urdu', 'CustomUploaded'];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 dark:bg-slate-950 font-sans relative transition-colors duration-300">
      
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(p => ({ ...p, isOpen: false }))}
      />

      {/* Mobile Menu Backdrop */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar / Drawer */}
      <div className={`
        fixed inset-y-0 right-0 z-50 w-72 bg-slate-900 text-white flex flex-col border-l border-slate-700
        transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none
        md:relative md:translate-x-0 md:flex
        ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <div>
             <h2 className="text-xl font-black text-yellow-500">پنل مدیریت اکرام</h2>
             <p className="text-xs text-slate-400 mt-1">خوش آمدید، {currentUser.displayName || currentUser.username}</p>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-white transition-all">
             <i className="fas fa-times text-xl"></i>
          </button>
        </div>
        
        <div className="p-4 flex-1 space-y-2 overflow-y-auto custom-scroll">
          <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 mb-4">
            <span className="text-[10px] uppercase text-slate-500 font-bold block mb-1">مراسم فعال</span>
            <span className="text-sm font-bold text-slate-200">{activeEventTitle}</span>
          </div>

          <form onSubmit={handleAddDonation} className="space-y-4 mt-2">
            <div>
              <label className="text-[10px] font-bold text-slate-400 mb-1 block">نام پرداخت کننده *</label>
              <input required className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-yellow-500 text-white placeholder-slate-500 transition-all" placeholder="مثال: علی رضایی" value={donationForm.name} onChange={e=>setDonationForm({...donationForm, name: e.target.value})} />
            </div>
            
            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 mb-1 block">مبلغ (تومان) *</label>
                <CurrencyInput required className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-yellow-500 text-white placeholder-slate-500 transition-all" placeholder="0" value={donationForm.amount} onChange={val=>setDonationForm({...donationForm, amount: val})} />
              </div>
              
              <div>
                <label className="text-[10px] font-bold text-slate-400 mb-1 block">نوع پرداخت *</label>
                <select className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-yellow-500 text-white transition-all" value={donationForm.type} onChange={e=>setDonationForm({...donationForm, type: e.target.value as any})}>
                  <option value="pos">کارتخوان (POS)</option>
                  <option value="cash">نقدی</option>
                  <option value="card">کارت به کارت</option>
                  <option value="online">درگاه آنلاین</option>
                  <option value="card_cash">کارت + نقدی</option>
                  <option value="mock">صوری</option>
                  <option value="transfer">حواله‌ای</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="w-1/2">
                 <label className="text-[10px] font-bold text-slate-400 mb-1 block">موبایل</label>
                 <input className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-yellow-500 text-white placeholder-slate-500 transition-all" placeholder="09..." value={donationForm.mobile} onChange={e=>setDonationForm({...donationForm, mobile: e.target.value})} dir="ltr" />
              </div>
              <div className="w-1/2">
                 <label className="text-[10px] font-bold text-slate-400 mb-1 block">نام پدر</label>
                 <input className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-yellow-500 text-white placeholder-slate-500 transition-all" placeholder="اختیاری" value={donationForm.father} onChange={e=>setDonationForm({...donationForm, father: e.target.value})} />
              </div>
            </div>
            
            <div>
              <label className="text-[10px] font-bold text-slate-400 mb-1 block">توضیحات</label>
              <textarea className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm h-16 focus:ring-2 focus:ring-yellow-500 text-white placeholder-slate-500 transition-all resize-none" placeholder="توضیحات تکمیلی..." value={donationForm.desc} onChange={e=>setDonationForm({...donationForm, desc: e.target.value})} />
            </div>
            
            <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-800/80 border border-transparent hover:border-slate-700 rounded-lg transition-all">
              <input type="checkbox" checked={donationForm.hide} onChange={e=>setDonationForm({...donationForm, hide: e.target.checked})} className="accent-yellow-500 w-4 h-4" />
              <span className="text-xs text-slate-300">مخفی سازی نام در نمایشگر</span>
            </label>
            
            <button type="submit" disabled={loading} className="w-full bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-black py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-yellow-500/20 active:scale-95 mt-2">
              {loading ? <Spinner color="border-slate-900" /> : <><i className="fas fa-plus"></i> ثبت تراکنش</>}
            </button>
          </form>
        </div>

        <div className="p-4 border-t border-slate-800 flex flex-col gap-2">
           <button onClick={onLogout} className="text-sm text-red-400 hover:bg-red-950 p-2 rounded transition-all flex items-center gap-2">
             <i className="fas fa-sign-out-alt"></i> خروج از سیستم
           </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <div className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 flex items-center justify-between shadow-sm gap-4 transition-colors">
          <div className="flex items-center gap-2 overflow-hidden flex-1">
            <button onClick={()=>setMobileMenuOpen(true)} className="md:hidden text-slate-700 dark:text-slate-300 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex-shrink-0">
               <i className="fas fa-bars text-xl"></i>
            </button>

            <div className="flex gap-1.5 overflow-x-auto flex-1 no-scrollbar pb-1">
                <button onClick={()=>setActiveTab('donations')} className={`px-3.5 py-2 rounded-xl font-bold text-xs md:text-sm whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${activeTab==='donations'?'bg-blue-600 text-white shadow-md shadow-blue-500/20':'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                  <i className="fas fa-hand-holding-heart"></i>
                  <span>مدیریت تراکنش‌ها و مراسم‌ها ({donations.length})</span>
                </button>
                <button onClick={()=>setActiveTab('settings')} className={`px-3.5 py-2 rounded-xl font-bold text-xs md:text-sm whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${activeTab==='settings'?'bg-slate-800 text-white dark:bg-slate-700 shadow-md':'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                  <i className="fas fa-sliders-h"></i>
                  <span>تنظیمات</span>
                </button>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
             {currentUser.role === 'superadmin' && (
               <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-500/20 text-xs font-bold" title="اتصال زنده و همگام‌سازی خودکار دیتابیس فعال است">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <span>ارتباط زنده دیتابیس</span>
               </div>
             )}
             <div className="hidden lg:flex items-center gap-2 px-4 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full border border-green-100 dark:border-green-800/50 font-black text-sm">
                <span>جمع کل:</span>
                <span>{donations.reduce((a, b) => a + (b.amount || 0), 0).toLocaleString()} تومان</span>
             </div>
             <button onClick={toggleTheme} className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-yellow-400 rounded-lg transition-all flex items-center justify-center border border-slate-200 dark:border-slate-700" title="تغییر تم (شب / روز)">
               <i className={`fas ${isDark ? 'fa-sun' : 'fa-moon'} text-base`}></i>
             </button>
             <button onClick={onShowDisplay} className="bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 text-white px-3 py-2 md:px-4 rounded-lg text-sm font-black shadow-lg shadow-red-200 dark:shadow-none transition-all flex items-center gap-2">
               <i className="fas fa-desktop"></i> <span className="hidden md:inline">نمایشگر</span>
             </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scroll">
          {activeTab === 'donations' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-full transition-colors">
              <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-300">
                    <i className="fas fa-bullhorn text-indigo-500"></i>
                    <span>مراسم فعال مانیتور:</span>
                    <strong className="text-indigo-950 dark:text-indigo-100">{activeEventTitle}</strong>
                  </div>

                  <button
                    onClick={() => setShowEventsArchiveManager(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                    title="مدیریت، تغییر مراسم فعال، تعریف مراسم جدید و بایگانی مراسم‌های قبلی"
                  >
                    <i className="fas fa-calendar-alt"></i>
                    <span>مدیریت و بایگانی مراسم‌ها</span>
                    <span className="bg-indigo-800 text-white text-[10px] px-1.5 py-0.5 rounded-full font-mono">
                      {events.filter(e => !e.isArchived).length} فعال / {events.filter(e => e.isArchived).length} بایگانی
                    </span>
                  </button>

                  <div className="flex items-center gap-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <i className="fas fa-filter text-blue-500"></i> فیلتر:
                    </label>
                    <select
                      value={selectedEventId}
                      onChange={e => changeSelectedEvent(e.target.value)}
                      className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm cursor-pointer"
                    >
                      <option value="all">🌐 همه مراسم‌ها (کل تراکنش‌های دیتابیس)</option>
                      <optgroup label="مراسم‌های جاری و فعال">
                        {events.filter(e => !e.isArchived).map(ev => (
                          <option key={ev.id} value={ev.id}>
                            {ev.title} {ev.isactive ? ' (فعال روی مانیتور)' : ''}
                          </option>
                        ))}
                      </optgroup>
                      {events.filter(e => e.isArchived).length > 0 && (
                        <optgroup label="بایگانی مراسم‌های خاتمه‌یافته">
                          {events.filter(e => e.isArchived).map(ev => (
                            <option key={ev.id} value={ev.id}>
                              📦 {ev.title} (بایگانی شده)
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 items-center flex-wrap">
                  <button onClick={selectDirectory} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-sm whitespace-nowrap ${directoryHandle ? 'bg-slate-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse'}`}>
                    <i className="fas fa-folder-open"></i> {directoryHandle ? '✔ پوشه متصل شد' : '۱. انتخاب پوشه ذخیره (OBS)'}
                  </button>
                  <button onClick={exportExcel} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-700 flex items-center gap-2 transition-all shadow-sm whitespace-nowrap"><i className="fas fa-file-excel"></i> خروجی اکسل</button>
                  <button onClick={()=>handlePrint(true)} className="bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-600 flex items-center gap-2 transition-all shadow-sm whitespace-nowrap"><i className="fas fa-print"></i> چاپ با مبلغ</button>
                  <button onClick={()=>handlePrint(false)} className="bg-slate-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-600 flex items-center gap-2 transition-all shadow-sm whitespace-nowrap"><i className="fas fa-print"></i> چاپ بدون مبلغ</button>
                </div>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-right border-collapse min-w-[1000px]">
                  <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 font-bold uppercase sticky top-0">
                    <tr>
                      <th className="p-3">خیر</th>
                      <th className="p-3">پدر</th>
                      <th className="p-3">موبایل (پیامک)</th>
                      <th className="p-3">مبلغ (تومان)</th>
                      <th className="p-3">نوع</th>
                      <th className="p-3">تاریخ و ساعت شمسی</th>
                      <th className="p-3">مدیر ثبت‌کننده</th>
                      <th className="p-3">توضیحات</th>
                      <th className="p-3">وضعیت</th>
                      <th className="p-3">پیوست</th>
                      <th className="p-3">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {donations.length === 0 ? (
                      <tr><td colSpan={11} className="p-10 text-center text-slate-400 dark:text-slate-500 italic">تراکنشی یافت نشد.</td></tr>
                    ) : donations.map(d => {
                      const jalali = formatJalaliDateTime(d.createdAt);
                      return (
                      <tr key={d.id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-all ${d.status==='pending'?'bg-orange-50/30 dark:bg-orange-900/10':''}`}>
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{d.donorName} {d.hideName && <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1 rounded">مخفی</span>}</td>
                        <td className="p-3 text-slate-500 dark:text-slate-400">{d.fatherName || '-'}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">
                          <div dir="ltr" className="text-right font-mono font-medium">{d.mobile || '-'}</div>
                          {d.mobile && (
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {d.smsStatus === 'sent' && (
                                <span className="text-[10px] font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <span>ارسال شده</span> ✓
                                </span>
                              )}
                              {d.smsStatus === 'failed' && (
                                <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded max-w-[180px] truncate" title={d.smsError || 'خطا در ارسال'}>
                                  {d.smsError || 'خطا در ارسال'}
                                </span>
                              )}
                              {d.smsStatus === 'pending' && (
                                <span className="text-[10px] font-bold text-orange-500 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30 px-1.5 py-0.5 rounded">
                                  در انتظار ارسال
                                </span>
                              )}
                              <button
                                onClick={() => handleResendSms(d)}
                                disabled={actionIds[`resend_sms_${d.id}`]}
                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-xs flex items-center gap-1"
                                title="ارسال / تکرار ارسال پیامک"
                              >
                                {actionIds[`resend_sms_${d.id}`] ? <Spinner size="w-3 h-3" color="border-blue-600" /> : <><i className="fas fa-paper-plane"></i> <span className="text-[9px]">ارسال پیامک</span></>}
                              </button>
                              <button
                                onClick={() => handleQueryDeliveryStatus(d)}
                                disabled={actionIds[`delivery_${d.id}`]}
                                className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 p-1 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all text-xs flex items-center gap-1"
                                title="استعلام وضعیت تحویل دقیق پیامک از نیازپرداز"
                              >
                                {actionIds[`delivery_${d.id}`] ? <Spinner size="w-3 h-3" color="border-purple-600" /> : <><i className="fas fa-info-circle"></i> <span className="text-[9px]">استعلام تحویل</span></>}
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="p-3 font-mono font-bold text-blue-700 dark:text-blue-400">{d.amount.toLocaleString()}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${d.paymentType==='online'?'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400':'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                            {{
                              'pos': 'کارتخوان',
                              'cash': 'نقدی',
                              'card': 'کارت به کارت',
                              'online': 'درگاه آنلاین',
                              'card_cash': 'کارت+نقدی',
                              'mock': 'صوری',
                              'transfer': 'حواله‌ای'
                            }[d.paymentType] || d.paymentType}
                          </span>
                        </td>
                        <td className="p-3 text-xs">
                          <div className="font-bold text-slate-800 dark:text-slate-200">{jalali.date}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">{jalali.time}</div>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40">
                            <i className="fas fa-user-check text-[10px]"></i>
                            <span>{d.registeredBy || 'مدیریت سامانه'}</span>
                          </span>
                        </td>
                        <td className="p-3 text-xs text-slate-500 dark:text-slate-400 max-w-[140px] truncate" title={d.description}>{d.description || '-'}</td>
                        <td className="p-3">
                        {d.status === 'pending' ? (
                          <div className="flex items-center gap-1">
                            <button onClick={()=>handleToggleDonationStatus(d, 'approve')} disabled={actionIds[`status_${d.id}`]} className={`px-3 py-1 rounded-full text-[10px] font-black transition-all bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50`}>
                              {actionIds[`status_${d.id}`] ? <Spinner size="w-3 h-3" color="border-current" /> : 'تایید'}
                            </button>
                            <button onClick={()=>handleToggleDonationStatus(d, 'reject')} disabled={actionIds[`status_${d.id}`]} className={`px-3 py-1 rounded-full text-[10px] font-black transition-all bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50`}>
                                رد
                            </button>
                          </div>
                        ) : (
                          <button onClick={()=>handleToggleDonationStatus(d, 'pending')} disabled={actionIds[`status_${d.id}`]} className={`px-3 py-1 rounded-full text-[10px] font-black transition-all bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50`}>
                            {actionIds[`status_${d.id}`] ? <Spinner size="w-3 h-3" color="border-current" /> : 'در حال نمایش (لغو)'}
                          </button>
                        )}
                        </td>
                        <td className="p-3">
                          {d.hasReceipt ? (
                            <button onClick={()=>openReceipt(d.id)} className="text-blue-500 dark:text-blue-400 hover:scale-110 transition-all"><i className="fas fa-file-invoice text-xl"></i></button>
                          ) : '-'}
                        </td>
                        <td className="p-3">
                           <div className="flex items-center gap-1.5">
                             <button
                               onClick={() => setPrintReceiptDonation(d)}
                               className="bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm whitespace-nowrap"
                               title="چاپ رسید رسمی تراکنش در قطع A6"
                             >
                               <i className="fas fa-receipt"></i>
                               <span>چاپ رسید A6</span>
                             </button>

                             <button onClick={()=>openEditDonation(d)} className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition-all cursor-pointer p-1" title="ویرایش تراکنش">
                               <i className="fas fa-edit text-base"></i>
                             </button>
                             <button onClick={()=>handleDeleteDonation(d.id)} disabled={actionIds[`del_${d.id}`]} className="text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-all cursor-pointer p-1" title="حذف تراکنش">
                               <i className="fas fa-trash-alt text-base"></i>
                             </button>
                           </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'events' && (
            <div className="max-w-5xl mx-auto space-y-6 pb-20">
              <EventsArchiveManager
                events={events}
                activeEventId={activeEventId}
                selectedEventId={selectedEventId}
                onSelectEvent={(id) => { changeSelectedEvent(id); setActiveTab('donations'); }}
                onEventsUpdated={() => { loadEvents(); loadDonations(selectedEventId); }}
              />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-5xl mx-auto space-y-6 pb-20">
              {/* Header card */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center text-xl">
                    <i className="fas fa-sliders-h"></i>
                  </div>
                  <div>
                    <h2 className="font-black text-slate-800 dark:text-slate-100 text-lg">تنظیمات و پیکربندی سامانه</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">پیکربندی نمایشگر، تصاویر، قلم‌ها، سطوح و OBS، پیامک، مدیران و پخش زنده</p>
                  </div>
                </div>
              </div>

              {/* Tabbed Navigation Bar */}
              <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar p-1">
                  {[
                    { id: 'general', label: 'عمومی', icon: 'fa-sliders-h' },
                    { id: 'images', label: 'تصاویر', icon: 'fa-image' },
                    { id: 'fonts', label: 'فونت‌ها', icon: 'fa-font' },
                    { id: 'thresholds_obs', label: 'سطوح و OBS', icon: 'fa-layer-group' },
                    { id: 'sms', label: 'پیامک', icon: 'fa-sms' },
                    { id: 'stream', label: 'پخش زنده', icon: 'fa-satellite-dish' },
                    ...(currentUser.role === 'superadmin' ? [
                      { id: 'admins', label: 'مدیران', icon: 'fa-user-shield' },
                    ] : []),
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSettingsSubTab(tab.id as SettingsSubTab)}
                      className={`px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer flex-shrink-0 ${
                        settingsSubTab === tab.id
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80'
                      }`}
                    >
                      <i className={`fas ${tab.icon} text-sm`}></i>
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sub-tab 1: General (عمومی) */}
              {settingsSubTab === 'general' && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                  <div>
                    <h3 className="font-black text-slate-800 dark:text-slate-100 text-base flex items-center gap-2 mb-1">
                      <i className="fas fa-sliders-h text-blue-500"></i> تنظیمات عمومی و متون نمایشگر
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">عنوان مراسم، سرعت حرکت اسامی، سایز فونت‌ها و برچسب‌های نمایشگر</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">عنوان اصلی مراسم</label>
                      <input className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={settings.eventTitle} onChange={e=>handleUpdateSettings({eventTitle: e.target.value})} placeholder="مثال: یادبود مرحوم حاج علی حسینی" />
                    </div>

                    <div className="flex gap-4 items-center bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400">رنگ عنوان:</label>
                        <input type="color" className="w-9 h-9 rounded cursor-pointer border-0" value={settings.titleColor || '#ffffff'} onChange={e=>handleUpdateSettings({titleColor: e.target.value})} />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400">سایز عنوان:</label>
                        <input type="number" step="0.1" className="w-16 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white rounded-lg p-1.5 text-center text-sm font-mono" value={settings.titleSize || 3.5} onChange={e=>handleUpdateSettings({titleSize: parseFloat(e.target.value)})} />
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                      <div>
                        <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                          <span>سایز قلم اسامی لیست:</span>
                          <span className="font-mono text-blue-600 dark:text-blue-400">{settings.fontSize}px</span>
                        </div>
                        <input type="range" min="20" max="100" className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer" value={settings.fontSize} onChange={e=>handleUpdateSettings({fontSize: parseInt(e.target.value)})} />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                          <span>سرعت حرکت نمایشگر:</span>
                          <span className="font-mono text-blue-600 dark:text-blue-400">{settings.scrollSpeed}</span>
                        </div>
                        <input type="range" min="5" max="100" className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer" style={{direction: 'ltr'}} value={settings.scrollSpeed} onChange={e=>handleUpdateSettings({scrollSpeed: parseInt(e.target.value)})} />
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">متن زیر عکس (مثال: شادروان)</label>
                      <input className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white rounded-lg p-2.5 text-sm" value={settings.deceasedLabel} onChange={e=>handleUpdateSettings({deceasedLabel: e.target.value})} />
                      <div className="flex gap-4 pt-1">
                        <div className="flex items-center gap-2"><span className="text-xs font-bold text-slate-500">رنگ:</span><input type="color" className="w-7 h-7 rounded border-0 cursor-pointer" value={settings.deceasedLabelColor || '#fef3c7'} onChange={e=>handleUpdateSettings({deceasedLabelColor: e.target.value})} /></div>
                        <div className="flex items-center gap-2"><span className="text-xs font-bold text-slate-500">سایز:</span><input type="number" className="w-16 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white rounded-lg p-1 text-center font-mono text-sm" value={settings.deceasedLabelSize || 12} onChange={e=>handleUpdateSettings({deceasedLabelSize: parseInt(e.target.value)})} /></div>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">متن فوتر (مثال: شادی روح درگذشتگان صلوات)</label>
                      <input className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white rounded-lg p-2.5 text-sm" value={settings.footerText} onChange={e=>handleUpdateSettings({footerText: e.target.value})} />
                      <div className="flex gap-4 pt-1">
                        <div className="flex items-center gap-2"><span className="text-xs font-bold text-slate-500">رنگ:</span><input type="color" className="w-7 h-7 rounded border-0 cursor-pointer" value={settings.footerColor || '#ffffff'} onChange={e=>handleUpdateSettings({footerColor: e.target.value})} /></div>
                        <div className="flex items-center gap-2"><span className="text-xs font-bold text-slate-500">سایز:</span><input type="number" className="w-16 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white rounded-lg p-1 text-center font-mono text-sm" value={settings.footerSize || 14} onChange={e=>handleUpdateSettings({footerSize: parseInt(e.target.value)})} /></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-tab 2: Images (تصاویر) */}
              {settingsSubTab === 'images' && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                  <div>
                    <h3 className="font-black text-slate-800 dark:text-slate-100 text-base flex items-center gap-2 mb-1">
                      <i className="fas fa-image text-emerald-500"></i> تصاویر و پس‌زمینه سالن
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">عکس مرحوم، تصویر زمینه نمایشگر سالن و تصویر اطلاعیه تمام‌صفحه</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400">عکس مرحوم</label>
                      <div className="h-44 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-all bg-white dark:bg-slate-900">
                        {settings.deceasedImage ? <img src={settings.deceasedImage} className="w-full h-full object-cover" /> : <div className="text-center p-4"><i className="fas fa-camera text-slate-300 dark:text-slate-600 text-3xl mb-2 block"></i><span className="text-xs text-slate-400">برای آپلود کلیک کنید</span></div>}
                        <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e=>e.target.files && handleFileUpload(e.target.files[0], 'deceasedImage')} />
                        {settings.deceasedImage && <button onClick={()=>handleUpdateSettings({deceasedImage: ''})} className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-md"><i className="fas fa-times text-xs"></i></button>}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400">تصویر پس‌زمینه</label>
                      <div className="h-44 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-all bg-white dark:bg-slate-900">
                        {settings.bgImage ? <img src={settings.bgImage} className="w-full h-full object-cover" /> : <div className="text-center p-4"><i className="fas fa-image text-slate-300 dark:text-slate-600 text-3xl mb-2 block"></i><span className="text-xs text-slate-400">برای آپلود کلیک کنید</span></div>}
                        <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e=>e.target.files && handleFileUpload(e.target.files[0], 'bgImage')} />
                        {settings.bgImage && <button onClick={()=>handleUpdateSettings({bgImage: ''})} className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-md"><i className="fas fa-times text-xs"></i></button>}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400">تصویر اطلاعیه (Full Screen)</label>
                      <div className="h-44 border-2 border-dashed border-orange-300 dark:border-orange-800 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer hover:bg-orange-50/50 dark:hover:bg-orange-950/20 transition-all bg-white dark:bg-slate-900">
                        {settings.announcementImage ? <img src={settings.announcementImage} className="w-full h-full object-cover" /> : <div className="text-center p-4"><i className="fas fa-scroll text-orange-300 dark:text-orange-700 text-3xl mb-2 block"></i><span className="text-xs text-orange-400">برای آپلود کلیک کنید</span></div>}
                        <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={e=>e.target.files && handleFileUpload(e.target.files[0], 'announcementImage')} />
                        {settings.announcementImage && <button onClick={()=>handleUpdateSettings({announcementImage: ''})} className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-md"><i className="fas fa-times text-xs"></i></button>}
                        <div className="absolute bottom-2 right-2 bg-white/90 dark:bg-slate-900/90 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
                          <input type="checkbox" checked={settings.showAnnouncement} onChange={(e)=>{e.stopPropagation(); handleUpdateSettings({showAnnouncement: e.target.checked})}} className="w-4 h-4 accent-orange-600 cursor-pointer" id="show-announcement-chk" />
                          <label htmlFor="show-announcement-chk" className="text-[10px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer">نمایش در سالن</label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-tab 3: Fonts (فونت‌ها) */}
              {settingsSubTab === 'fonts' && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                  <div>
                    <h3 className="font-black text-slate-800 dark:text-slate-100 text-base flex items-center gap-2 mb-1">
                      <i className="fas fa-font text-blue-500"></i> مدیریت قلم‌ها و فونت‌ها
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">آپلود فونت سفارشی و تعیین فونت اختصاصی برای هر کدام از سطوح مبالغ</p>
                  </div>

                  <div className="space-y-4">
                    <div className="bg-blue-50/70 dark:bg-blue-950/30 p-5 rounded-2xl border border-blue-200 dark:border-blue-800/60">
                      <label className="text-xs font-bold text-blue-800 dark:text-blue-300 block mb-2">آپلود فونت سفارشی (.ttf, .woff, .woff2)</label>
                      <div className="flex gap-3 items-center">
                        <input type="file" accept=".ttf,.woff,.woff2" onChange={(e)=>e.target.files && handleFileUpload(e.target.files[0], 'customFontData')} className="text-xs w-full bg-white dark:bg-slate-900 dark:text-white rounded-xl border border-blue-200 dark:border-blue-800 p-3 cursor-pointer" />
                        {actionIds['upload_customFontData'] && <Spinner size="w-5 h-5" color="border-blue-600" />}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">فونت سطح بالا (High)</label>
                        <select className="w-full text-xs font-bold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white rounded-xl p-3" value={settings.fontHigh} onChange={e=>handleUpdateSettings({fontHigh: e.target.value})}>{fonts.map(f=><option key={f}>{f}</option>)}</select>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">فونت سطح متوسط (Mid)</label>
                        <select className="w-full text-xs font-bold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white rounded-xl p-3" value={settings.fontMid} onChange={e=>handleUpdateSettings({fontMid: e.target.value})}>{fonts.map(f=><option key={f}>{f}</option>)}</select>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">فونت سطح پایین (Low)</label>
                        <select className="w-full text-xs font-bold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white rounded-xl p-3" value={settings.fontLow} onChange={e=>handleUpdateSettings({fontLow: e.target.value})}>{fonts.map(f=><option key={f}>{f}</option>)}</select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-tab 4: Thresholds & OBS (سطوح و OBS) - Merged */}
              {settingsSubTab === 'thresholds_obs' && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                  <div>
                    <h3 className="font-black text-slate-800 dark:text-slate-100 text-base flex items-center gap-2 mb-1">
                      <i className="fas fa-layer-group text-amber-500"></i> مرزبندی مبالغ، سطوح و تنظیمات خروجی OBS
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">تنظیم آستانه مبالغ برای دسته‌بندی در نمایشگر سالن و همچنین تولید فایل‌های متنی آنلاین برای OBS</p>
                  </div>

                  {/* Section 1: Thresholds for Display */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <i className="fas fa-chart-line text-emerald-500"></i> مرزبندی مبالغ نمایشگر سالن
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/60 space-y-1">
                        <label className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block">مرز سطح ویژه (High)</label>
                        <CurrencyInput className="w-full border-none bg-transparent font-black text-emerald-900 dark:text-emerald-200 text-lg outline-none" value={settings.highThreshold} onChange={val=>handleUpdateSettings({highThreshold: parseInt(val)})} />
                      </div>
                      <div className="p-4 bg-blue-50/70 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800/60 space-y-1">
                        <label className="text-xs font-bold text-blue-800 dark:text-blue-300 block">مرز سطح متوسط (Mid)</label>
                        <CurrencyInput className="w-full border-none bg-transparent font-black text-blue-900 dark:text-blue-200 text-lg outline-none" value={settings.midThreshold} onChange={val=>handleUpdateSettings({midThreshold: parseInt(val)})} />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: OBS Text Files Configuration */}
                  <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <i className="fas fa-file-export text-amber-500"></i> تنظیمات خروجی فایل‌های متنی OBS
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">نام فایل خط پایین</label>
                        <input className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white rounded-lg p-2.5 text-left font-mono text-sm" dir="ltr" value={settings.obsFileLow || 'خط پايين.txt'} onChange={e=>handleUpdateSettings({obsFileLow: e.target.value})} />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">نام فایل خط وسط</label>
                        <input className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white rounded-lg p-2.5 text-left font-mono text-sm" dir="ltr" value={settings.obsFileMid || 'خط وسط.txt'} onChange={e=>handleUpdateSettings({obsFileMid: e.target.value})} />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">نام فایل خط بالا</label>
                        <input className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white rounded-lg p-2.5 text-left font-mono text-sm" dir="ltr" value={settings.obsFileHigh || 'خط بالا.txt'} onChange={e=>handleUpdateSettings({obsFileHigh: e.target.value})} />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">ظرفیت خط پایین (نفر)</label>
                        <input type="number" className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white rounded-lg p-2.5 text-center font-bold" value={settings.obsCapLow || 16} onChange={e=>handleUpdateSettings({obsCapLow: parseInt(e.target.value)})} />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">ظرفیت خط وسط (نفر)</label>
                        <input type="number" className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white rounded-lg p-2.5 text-center font-bold" value={settings.obsCapMid || 20} onChange={e=>handleUpdateSettings({obsCapMid: parseInt(e.target.value)})} />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">ظرفیت خط بالا (نفر)</label>
                        <input type="number" className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white rounded-lg p-2.5 text-center font-bold" value={settings.obsCapHigh || 10} onChange={e=>handleUpdateSettings({obsCapHigh: parseInt(e.target.value)})} />
                      </div>
                      <div className="md:col-span-3">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">کاراکتر جداکننده بین اسامی در خروجی متنی</label>
                        <input className="w-32 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white rounded-lg p-2.5 text-center font-bold" value={settings.obsSeparator || '-'} onChange={e=>handleUpdateSettings({obsSeparator: e.target.value})} />
                      </div>
                      <div className="md:col-span-3">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">فرمت متنی هر آیتم</label>
                        <span className="text-[10px] text-slate-400 block mb-2">متغیرها: {'{donorName}'} (نام خیّر)، {'{fatherName}'} (نام پدر)، {'{separator}'} (جداکننده). مثال: {'{donorName}({fatherName}){separator}'}</span>
                        <input dir="ltr" className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white rounded-lg p-2.5 text-left font-mono text-sm" placeholder="{donorName}({fatherName}){separator}" value={settings.obsFormat ?? '{donorName}({fatherName}){separator}'} onChange={e=>handleUpdateSettings({obsFormat: e.target.value})} />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">مرز مبلغ خط متوسط برای فایل</label>
                        <CurrencyInput className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white rounded-lg p-2.5 text-center font-bold" value={settings.obsThresholdMid ?? 60000} onChange={val=>handleUpdateSettings({obsThresholdMid: parseInt(val)})} />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 block mb-1">مرز مبلغ خط بالا برای فایل</label>
                        <CurrencyInput className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white rounded-lg p-2.5 text-center font-bold" value={settings.obsThresholdHigh ?? 150000} onChange={val=>handleUpdateSettings({obsThresholdHigh: parseInt(val)})} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-tab 5: SMS (پیامک) */}
              {settingsSubTab === 'sms' && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                  <div>
                    <h3 className="font-black text-slate-800 dark:text-slate-100 text-base flex items-center gap-2 mb-1">
                      <i className="fas fa-sms text-purple-500"></i> تنظیمات پنل پیامک (نیازپرداز)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {currentUser.role === 'superadmin' 
                        ? 'نام کاربری، رمز عبور، خط فرستنده، استعلام اعتبار، ارسال گروهی و تست پیامک' 
                        : 'مشاهده وضعیت سرور پیامک، روشن کردن سرور و ویرایش متن پیش‌فرض'}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <SmsProxyManager settings={settings} isSuperAdmin={currentUser.role === 'superadmin'} />
                    {currentUser.role === 'superadmin' ? (
                      <>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-xs font-bold text-purple-700 dark:text-purple-300">امکانات پنل پیامک:</span>
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => { setGroupSmsText(settings.smsDefaultText || ''); setGroupSmsModalOpen(true); }}
                              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 font-bold cursor-pointer shadow-sm"
                            >
                              <i className="fas fa-users"></i> ارسال پیامک گروهی
                            </button>
                            <button
                              onClick={handleCheckCredit}
                              disabled={creditLoading}
                              className="text-xs bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800 transition-all flex items-center gap-1.5 font-bold cursor-pointer"
                            >
                              {creditLoading ? <Spinner size="w-3 h-3" color="border-purple-600" /> : <><i className="fas fa-wallet"></i> بررسی اعتبار پنل</>}
                            </button>
                          </div>
                        </div>

                        {(!settings.smsUser || !settings.smsPass || !settings.smsFrom) && (
                          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                            <i className="fas fa-exclamation-triangle text-amber-500 text-sm flex-shrink-0"></i>
                            <span>تنظیمات پیامک هنوز کامل نشده است. برای ارسال پیامک خودکار، نام کاربری، رمز عبور و شماره فرستنده خط اختصاصی پنل نیازپرداز را وارد نمایید.</span>
                          </div>
                        )}

                        {creditResult && (
                          <div className={`p-3 rounded-xl text-xs font-bold leading-relaxed ${creditResult.startsWith('❌') ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                            {creditResult}
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                           <div>
                              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">نام کاربری پنل (Username)</label>
                              <input className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white rounded-lg p-2.5 text-left font-mono" dir="ltr" value={settings.smsUser || ''} onChange={e=>handleUpdateSettings({smsUser: e.target.value})} placeholder="مثال: myusername" />
                           </div>
                           <div>
                              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">رمز عبور (Password)</label>
                              <input type="password" className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white rounded-lg p-2.5 text-left font-mono" dir="ltr" value={settings.smsPass || ''} onChange={e=>handleUpdateSettings({smsPass: e.target.value})} placeholder="••••••••" />
                           </div>
                           <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block">شماره فرستنده (From)</label>
                                <button
                                  onClick={handleGetSenders}
                                  disabled={fetchingSenders}
                                  className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                                  title="استعلام شماره‌های خطوط اختصاصی شما در نیازپرداز"
                                >
                                  {fetchingSenders ? <Spinner size="w-3 h-3" color="border-purple-600" /> : <><i className="fas fa-list-ol"></i> دریافت شماره‌ها</>}
                                </button>
                              </div>
                              {senderNumbers.length > 0 ? (
                                <select
                                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white rounded-lg p-2.5 text-left font-mono text-sm"
                                  value={settings.smsFrom || ''}
                                  onChange={e => handleUpdateSettings({ smsFrom: e.target.value })}
                                  dir="ltr"
                                >
                                  {senderNumbers.map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                              ) : (
                                <input className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white rounded-lg p-2.5 text-left font-mono" dir="ltr" value={settings.smsFrom || ''} onChange={e=>handleUpdateSettings({smsFrom: e.target.value})} placeholder="مثال: 5000..." />
                              )}
                           </div>
                           <div className="md:col-span-3">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block">متن پیش‌فرض پیامک تشکر</label>
                                <button
                                  onClick={handleCheckContent}
                                  disabled={contentChecking}
                                  className="text-[10px] bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-1 rounded hover:bg-purple-100 transition-all font-bold flex items-center gap-1 cursor-pointer"
                                >
                                  {contentChecking ? <Spinner size="w-3 h-3" color="border-purple-600" /> : <><i className="fas fa-shield-alt"></i> بررسی فیلتر کلمات</>}
                                </button>
                              </div>
                              <textarea className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white rounded-lg p-2.5 text-sm" rows={2} value={settings.smsDefaultText || ''} onChange={e=>handleUpdateSettings({smsDefaultText: e.target.value})} placeholder="باسلام، پرداخت شما با موفقیت ثبت شد. با تشکر" />
                              {contentCheckResult && (
                                <div className={`mt-1.5 p-2 rounded-lg text-xs font-bold ${contentCheckResult.startsWith('✔') ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                                  {contentCheckResult}
                                </div>
                              )}
                           </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl space-y-3 border border-slate-200 dark:border-slate-700/60">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              <i className="fas fa-vial text-purple-600 dark:text-purple-400"></i> تست ارسال پیامک
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="tel"
                                dir="ltr"
                                placeholder="09121234567"
                                value={testMobile}
                                onChange={e => setTestMobile(e.target.value)}
                                className="flex-1 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white rounded-lg p-2 text-xs font-mono text-left"
                              />
                              <button
                                onClick={handleTestSms}
                                disabled={testSmsLoading}
                                className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap cursor-pointer"
                              >
                                {testSmsLoading ? <Spinner size="w-3 h-3" color="border-white" /> : <><i className="fas fa-paper-plane"></i> ارسال تست</>}
                              </button>
                            </div>

                            {testSmsResult && (
                              <div className={`p-2.5 rounded-lg text-xs font-bold leading-relaxed ${testSmsResult.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'}`}>
                                {testSmsResult.msg}
                              </div>
                            )}
                          </div>

                          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl space-y-3 border border-slate-200 dark:border-slate-700/60">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              <i className="fas fa-user-slash text-purple-600 dark:text-purple-400"></i> استعلام لیست سیاه مخابرات (Blacklist)
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="tel"
                                dir="ltr"
                                placeholder="09121234567"
                                value={blacklistMobile}
                                onChange={e => setBlacklistMobile(e.target.value)}
                                className="flex-1 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white rounded-lg p-2 text-xs font-mono text-left"
                              />
                              <button
                                onClick={handleCheckBlacklist}
                                disabled={blacklistLoading}
                                className="bg-slate-700 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold px-4 py-2 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap cursor-pointer"
                              >
                                {blacklistLoading ? <Spinner size="w-3 h-3" color="border-white" /> : <><i className="fas fa-search"></i> استعلام</>}
                              </button>
                            </div>

                            {blacklistResult && (
                              <div className={`p-2.5 rounded-lg text-xs font-bold leading-relaxed ${blacklistResult.includes('✔') ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                                {blacklistResult}
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/50 rounded-xl text-xs text-purple-800 dark:text-purple-300 flex items-center gap-2">
                          <i className="fas fa-info-circle text-purple-500 text-sm flex-shrink-0"></i>
                          <span>تنظیمات عمومی پنل پیامک (نام کاربری، رمز عبور، شماره فرستنده و ارسال گروهی) مخصوص مدیر ارشد (سوپر ادمین) می‌باشد. شما می‌توانید متن پیش‌فرض پیامک تشکر را ویرایش نمایید.</span>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">متن پیش‌فرض پیامک تشکر</label>
                            <button
                              onClick={handleCheckContent}
                              disabled={contentChecking}
                              className="text-[10px] bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-1 rounded hover:bg-purple-100 transition-all font-bold flex items-center gap-1 cursor-pointer"
                            >
                              {contentChecking ? <Spinner size="w-3 h-3" color="border-purple-600" /> : <><i className="fas fa-shield-alt"></i> بررسی فیلتر کلمات</>}
                            </button>
                          </div>
                          <textarea
                            className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white rounded-lg p-2.5 text-sm"
                            rows={3}
                            value={settings.smsDefaultText || ''}
                            onChange={e => handleUpdateSettings({ smsDefaultText: e.target.value })}
                            placeholder="باسلام، پرداخت شما با موفقیت ثبت شد. با تشکر"
                          />
                          {contentCheckResult && (
                            <div className={`mt-1.5 p-2 rounded-lg text-xs font-bold ${contentCheckResult.startsWith('✔') ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                              {contentCheckResult}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sub-tab 6: Admins (مدیران) - for superadmin */}
              {settingsSubTab === 'admins' && currentUser.role === 'superadmin' && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <h3 className="font-black text-slate-800 dark:text-slate-100 text-base flex items-center gap-2 mb-1">
                        <i className="fas fa-user-shield text-purple-500"></i> مدیریت مدیران و دسترسی‌های سامانه
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">مشاهده لیست مدیران، تعریف نام نمایشی جهت چاپ رسیدها، ایجاد حساب جدید و تغییر اطلاعات</p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/50 px-3.5 py-1.5 rounded-xl text-xs font-bold text-purple-700 dark:text-purple-300 flex items-center gap-2">
                      <i className="fas fa-users text-purple-500"></i>
                      <span>تعداد کل مدیران: <strong>{admins.length} نفر</strong></span>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-2">
                      <i className="fas fa-user-plus text-purple-500"></i> تعریف مدیر جدید
                    </h4>
                    <form onSubmit={handleAddAdmin} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <input
                        required
                        className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white rounded-xl p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                        placeholder="نام کاربری (جهت ورود) *"
                        value={newAdmin.username}
                        onChange={e => setNewAdmin({ ...newAdmin, username: e.target.value })}
                      />
                      <input
                        className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white rounded-xl p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                        placeholder="نام نمایشی (چاپ رسیدها)"
                        value={newAdmin.displayName}
                        onChange={e => setNewAdmin({ ...newAdmin, displayName: e.target.value })}
                        title="نام نمایشی مدیر که در رسید چاپی و تراکنش‌ها درج می‌شود (مثال: علی رضایی)"
                      />
                      <input
                        required
                        type="password"
                        className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white rounded-xl p-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                        placeholder="رمز عبور *"
                        value={newAdmin.password}
                        onChange={e => setNewAdmin({ ...newAdmin, password: e.target.value })}
                      />
                      <button
                        type="submit"
                        disabled={loading}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl transition-all flex items-center justify-center gap-2 text-sm cursor-pointer p-3 shadow-md shadow-purple-500/20"
                      >
                        {loading ? <Spinner /> : <><i className="fas fa-user-plus"></i> افزودن مدیر</>}
                      </button>
                    </form>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      💡 <strong>نکته:</strong> در صورتی که «نام نمایشی» خالی بماند، به صورت پیش‌فرض از «نام کاربری» برای چاپ رسید استفاده خواهد شد.
                    </p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-4 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 font-black text-xs text-slate-700 dark:text-slate-300">
                      لیست مدیران سیستم ({admins.length})
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-right">
                        <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 font-bold">
                          <tr>
                            <th className="p-4">نام کاربری</th>
                            <th className="p-4">نام نمایشی (در چاپ رسید)</th>
                            <th className="p-4">سطح دسترسی</th>
                            <th className="p-4 text-center">عملیات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                          {admins.map(admin => (
                            <tr key={admin.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="p-4 font-bold text-slate-800 dark:text-slate-200">
                                <div className="flex items-center gap-2">
                                  <i className="fas fa-user-circle text-slate-400 text-lg"></i>
                                  <span>{admin.username}</span>
                                </div>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-1.5 font-bold text-indigo-600 dark:text-indigo-400">
                                  <i className="fas fa-id-badge text-xs"></i>
                                  <span>{admin.displayName || admin.username}</span>
                                  {!admin.displayName && (
                                    <span className="text-[10px] text-slate-400 font-normal">(همان نام کاربری)</span>
                                  )}
                                </div>
                              </td>
                              <td className="p-4">
                                <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase ${admin.role === 'superadmin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                                  {admin.role === 'superadmin' ? 'مدیر ارشد (Superadmin)' : 'مدیر (Admin)'}
                                </span>
                              </td>
                              <td className="p-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  {currentUser.role === 'superadmin' && (
                                    <button
                                      type="button"
                                      onClick={() => setEditingAdmin({
                                        id: admin.id,
                                        username: admin.username,
                                        displayName: admin.displayName || admin.username,
                                        password: ''
                                      })}
                                      className="text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 p-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-all cursor-pointer"
                                      title="ویرایش نام نمایشی و رمز عبور"
                                    >
                                      <i className="fas fa-edit"></i>
                                    </button>
                                  )}
                                  {currentUser.role === 'superadmin' && admin.username !== 'admin' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        requestConfirmation(
                                          'حذف مدیر',
                                          `آیا از حذف مدیر «${admin.displayName || admin.username}» اطمینان دارید؟`,
                                          async () => {
                                            await dbApi.admins.delete(admin.id);
                                            loadAdmins();
                                          }
                                        );
                                      }}
                                      className="text-red-400 hover:text-red-600 dark:hover:text-red-300 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-all cursor-pointer"
                                      title="حذف مدیر"
                                    >
                                      <i className="fas fa-trash-alt"></i>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Edit Admin Modal */}
                  {editingAdmin && (
                    <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm flex items-center justify-center p-4">
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in">
                        <div className="p-4 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                            <i className="fas fa-user-edit text-indigo-500"></i>
                            <span>ویرایش مشخصات مدیر: <strong>{editingAdmin.username}</strong></span>
                          </h3>
                          <button
                            onClick={() => setEditingAdmin(null)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                        <form onSubmit={handleSaveEditAdmin} className="p-5 space-y-4">
                          <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 block">
                              نام کاربری (غیرقابل تغییر)
                            </label>
                            <input
                              disabled
                              className="w-full bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed"
                              value={editingAdmin.username}
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 block">
                              نام نمایشی مدیر (جهت چاپ در رسیدها و گزارشات) *
                            </label>
                            <input
                              required
                              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                              placeholder="مثال: علی رضایی یا اپراتور شماره ۱"
                              value={editingAdmin.displayName}
                              onChange={e => setEditingAdmin({ ...editingAdmin, displayName: e.target.value })}
                            />
                            <p className="text-[10px] text-slate-400 mt-1">این نام در قسمت «مدیر ثبت‌کننده» روی رسید چاپی A6 قرار می‌گیرد.</p>
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 block">
                              رمز عبور جدید (اختیاری - در صورت عدم نیاز خالی بگذارید)
                            </label>
                            <input
                              type="password"
                              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                              placeholder="رمز عبور جدید..."
                              value={editingAdmin.password || ''}
                              onChange={e => setEditingAdmin({ ...editingAdmin, password: e.target.value })}
                            />
                          </div>

                          <div className="flex gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => setEditingAdmin(null)}
                              className="w-1/2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer"
                            >
                              انصراف
                            </button>
                            <button
                              type="submit"
                              disabled={loading}
                              className="w-1/2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-500/20"
                            >
                              {loading ? <Spinner /> : <><i className="fas fa-save"></i> ذخیره تغییرات</>}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab 7: Live Stream (پخش زنده) */}
              {settingsSubTab === 'stream' && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                  <div>
                    <h3 className="font-black text-slate-800 dark:text-slate-100 text-base flex items-center gap-2 mb-1">
                      <i className="fas fa-satellite-dish text-indigo-500"></i> {currentUser.role === 'superadmin' ? 'مرکز کنترل پخش زنده و استریم اینترنتی (M3U8 Streamer)' : 'مرکز کنترل و پخش زنده'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {currentUser.role === 'superadmin' 
                        ? 'اجرای مستقیم ورکفلو گیت‌هاب، ضبط خودکار صفحه، تبدیل به HLS و پروکسی بدون فیلتر کلودفلر' 
                        : 'شروع و پایان پخش زنده، دریافت لینک و پیش‌نمایش تصویر'}
                    </p>
                  </div>
                  <LiveStreamSection
                    settings={settings}
                    onUpdateSettings={handleUpdateSettings}
                    isSuperAdmin={currentUser.role === 'superadmin'}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SMS Reject Prompt */}
      {rejectPrompt && (
        <div className="fixed inset-0 bg-slate-900/50 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm" onClick={()=>setRejectPrompt(null)}>
           <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800" onClick={e=>e.stopPropagation()}>
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 mb-2">رد درخواست پرداخت</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">آیا می‌خواهید به خیّر پیامی مبنی بر رد درخواست ارسال کنید؟</p>
              
              <textarea 
                 className="w-full border border-slate-200 dark:border-slate-700 bg-transparent dark:text-white rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" 
                 rows={3} 
                 value={rejectPrompt.text} 
                 onChange={e=>setRejectPrompt({...rejectPrompt, text: e.target.value})} 
              />
              
              <div className="flex gap-3">
                 <button onClick={() => submitRejectSms(true)} className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-bold py-2 rounded-xl transition-all">ارسال پیامک و رد</button>
                 <button onClick={() => submitRejectSms(false)} className="flex-1 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 font-bold py-2 rounded-xl transition-all">رد بدون پیامک</button>
              </div>
           </div>
        </div>
      )}

      {/* Group SMS Modal */}
      {groupSmsModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => !groupSmsSending && setGroupSmsModalOpen(false)}>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <i className="fas fa-users text-indigo-600"></i> ارسال پیامک گروهی به اهداکنندگان
              </h3>
              {!groupSmsSending && (
                <button onClick={() => setGroupSmsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <i className="fas fa-times text-lg"></i>
                </button>
              )}
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-400 bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between">
              <span>تعداد دریافت‌کنندگان دارای شماره معتبر:</span>
              <span className="font-bold text-indigo-700 dark:text-indigo-300 font-mono text-sm">
                {donations.filter(d => d.mobile && d.mobile.trim().length >= 10).length} نفر
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">متن پیامک گروهی:</label>
              <textarea
                disabled={groupSmsSending}
                className="w-full border border-slate-300 dark:border-slate-700 bg-transparent dark:text-white rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                rows={4}
                value={groupSmsText}
                onChange={e => setGroupSmsText(e.target.value)}
                placeholder="متن اطلاع‌رسانی یا تشکر عمومی را وارد کنید..."
              />
            </div>

            {groupSmsProgress && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span>پیشرفت ارسال:</span>
                  <span>{groupSmsProgress.sent + groupSmsProgress.failed} از {groupSmsProgress.total}</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full transition-all duration-300"
                    style={{ width: `${((groupSmsProgress.sent + groupSmsProgress.failed) / groupSmsProgress.total) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span className="text-green-600 font-bold">موفق: {groupSmsProgress.sent}</span>
                  <span className="text-red-500 font-bold">ناموفق: {groupSmsProgress.failed}</span>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSendGroupSms}
                disabled={groupSmsSending}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {groupSmsSending ? <Spinner size="w-4 h-4" color="border-white" /> : <><i className="fas fa-paper-plane"></i> شروع ارسال گروهی</>}
              </button>
              {!groupSmsSending && (
                <button
                  onClick={() => setGroupSmsModalOpen(false)}
                  className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold px-5 py-2.5 rounded-xl transition-all cursor-pointer"
                >
                  انصراف
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Event Modal */}
      {editingEvent && (
        <div className="fixed inset-0 bg-slate-900/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setEditingEvent(null)}>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <i className="fas fa-edit text-indigo-600"></i> ویرایش عنوان مراسم
              </h3>
              <button onClick={() => setEditingEvent(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">عنوان جدید مراسم:</label>
              <input
                className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                value={editingEvent.title}
                onChange={e => setEditingEvent({ ...editingEvent, title: e.target.value })}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleUpdateEvent}
                disabled={loading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? <Spinner size="w-4 h-4" color="border-white" /> : 'ذخیره تغییرات'}
              </button>
              <button
                onClick={() => setEditingEvent(null)}
                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold px-5 py-2.5 rounded-xl transition-all cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Donation Modal */}
      {editingDonation && editDonationForm && (
        <div className="fixed inset-0 bg-slate-900/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => { setEditingDonation(null); setEditDonationForm(null); }}>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <i className="fas fa-edit text-blue-600"></i> ویرایش تراکنش
              </h3>
              <button onClick={() => { setEditingDonation(null); setEditDonationForm(null); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>

            <form onSubmit={handleSaveDonationEdit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">نام خیّر *</label>
                <input
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                  value={editDonationForm.donorName}
                  onChange={e => setEditDonationForm({ ...editDonationForm, donorName: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">نام پدر</label>
                  <input
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                    value={editDonationForm.fatherName}
                    onChange={e => setEditDonationForm({ ...editDonationForm, fatherName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">موبایل</label>
                  <input
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                    dir="ltr"
                    value={editDonationForm.mobile}
                    onChange={e => setEditDonationForm({ ...editDonationForm, mobile: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">مبلغ (تومان) *</label>
                  <CurrencyInput
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                    value={editDonationForm.amount}
                    onChange={val => setEditDonationForm({ ...editDonationForm, amount: val })}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">نوع پرداخت *</label>
                  <select
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                    value={editDonationForm.paymentType}
                    onChange={e => setEditDonationForm({ ...editDonationForm, paymentType: e.target.value as any })}
                  >
                    <option value="pos">کارتخوان (POS)</option>
                    <option value="cash">نقدی</option>
                    <option value="card">کارت به کارت</option>
                    <option value="online">درگاه آنلاین</option>
                    <option value="card_cash">کارت + نقدی</option>
                    <option value="mock">صوری</option>
                    <option value="transfer">حواله‌ای</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">مراسم مربوطه</label>
                <select
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                  value={editDonationForm.event_id}
                  onChange={e => setEditDonationForm({ ...editDonationForm, event_id: e.target.value })}
                >
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>{ev.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1 block">توضیحات</label>
                <textarea
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none dark:text-white"
                  rows={2}
                  value={editDonationForm.description}
                  onChange={e => setEditDonationForm({ ...editDonationForm, description: e.target.value })}
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-all">
                <input
                  type="checkbox"
                  checked={editDonationForm.hideName}
                  onChange={e => setEditDonationForm({ ...editDonationForm, hideName: e.target.checked })}
                  className="accent-blue-500 w-4 h-4"
                />
                <span className="text-xs text-slate-600 dark:text-slate-300">مخفی سازی نام در نمایشگر</span>
              </label>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={actionIds[`edit_${editingDonation.id}`]}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {actionIds[`edit_${editingDonation.id}`] ? <Spinner size="w-4 h-4" color="border-white" /> : 'ذخیره تغییرات'}
                </button>
                <button
                  type="button"
                  onClick={() => { setEditingDonation(null); setEditDonationForm(null); }}
                  className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold px-5 py-2.5 rounded-xl transition-all cursor-pointer"
                >
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Loading Overlay */}
      {receiptLoading && (
        <div className="fixed inset-0 bg-slate-900/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-2xl flex items-center gap-4 border border-slate-200 dark:border-slate-800">
            <Spinner size="w-6 h-6" color="border-blue-600" />
            <span className="text-sm font-black text-slate-800 dark:text-slate-100">در حال دریافت رسید، لطفاً صبر کنید...</span>
          </div>
        </div>
      )}

      {/* Fullscreen Receipt Modal */}
      {viewReceipt && (
        <div className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm" onClick={()=>setViewReceipt(null)}>
           <button className="absolute top-6 left-6 text-white text-4xl hover:scale-125 transition-all"><i className="fas fa-times"></i></button>
           <img src={viewReceipt} className="max-w-full max-h-full rounded-2xl shadow-2xl border-4 border-white/10" />
        </div>
      )}

      {/* A6 Printable Transaction Receipt Modal */}
      {printReceiptDonation && (
        <ReceiptPrintModal
          donation={printReceiptDonation}
          eventTitle={events.find(e => e.id === (printReceiptDonation.event_id || activeEventId))?.title || activeEventTitle}
          onClose={() => setPrintReceiptDonation(null)}
        />
      )}

      {/* Events and Archive Manager Modal */}
      {showEventsArchiveManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-4xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowEventsArchiveManager(false)}
              className="absolute top-5 left-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer text-lg"
              title="بستن"
            >
              <i className="fas fa-times"></i>
            </button>
            <EventsArchiveManager
              events={events}
              activeEventId={activeEventId}
              selectedEventId={selectedEventId}
              onSelectEvent={(id) => {
                changeSelectedEvent(id);
                setShowEventsArchiveManager(false);
              }}
              onEventsUpdated={() => {
                loadEvents();
                loadDonations(selectedEventId);
              }}
              onClose={() => setShowEventsArchiveManager(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

