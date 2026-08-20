import React, { useState, useEffect, useRef } from 'react';
import { DisplaySettings } from '../types';
import { Spinner } from './Shared';

interface LiveStreamSectionProps {
  settings: DisplaySettings;
  onUpdateSettings: (newSettings: Partial<DisplaySettings>) => void;
  isSuperAdmin?: boolean;
}

export const LiveStreamSection: React.FC<LiveStreamSectionProps> = ({
  settings,
  onUpdateSettings,
  isSuperAdmin = false
}) => {
  // Dispatch parameters
  const [quality, setQuality] = useState<string>(settings.streamQuality || '720p');
  const [fps, setFps] = useState<number>(settings.streamFps || 30);
  const [duration, setDuration] = useState<number>(settings.streamDuration || 60);

  // Status & loading states
  const [isStarting, setIsStarting] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isTestingStream, setIsTestingStream] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnoseResult, setDiagnoseResult] = useState<any>(null);
  const [statusData, setStatusData] = useState<any>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const githubToken = settings.githubToken || '';
  const githubRepo = settings.githubRepo || 'hudsonparker87-cmd/kheyriyeh2';
  const githubWorkflow = settings.githubWorkflow || 'streamer.yml';
  const currentHostOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://kheyriyeh2.hudsonparker87.workers.dev';
  const workerUrl = settings.streamWorkerUrl || `${currentHostOrigin}/live.m3u8`;
  const neonUrl = settings.streamNeonUrl || 'https://br-lucky-wave-axbfuzrm.storage.c-4.us-east-2.aws.neon.tech/m3u8-streamer/live.m3u8';
  const targetDisplayUrl = settings.streamTargetUrl || `${currentHostOrigin}/display`;

  // Effective playback URL: prioritize Cloudflare worker proxy, fallback to direct neon S3
  const activeStreamUrl = workerUrl.trim() 
    ? (workerUrl.endsWith('.m3u8') ? workerUrl : `${workerUrl.replace(/\/$/, '')}/live.m3u8`) 
    : `${currentHostOrigin}/live.m3u8`;

  const fetchStatus = async (silent = false) => {
    if (!githubToken || !githubRepo) return;
    if (!silent) setIsCheckingStatus(true);
    try {
      const res = await fetch('/api/stream/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: githubToken,
          repo: githubRepo,
          workflow: githubWorkflow
        })
      });
      const data = await res.json();
      if (data.success) {
        setStatusData(data);
      }
    } catch (err: any) {
      if (!silent) {
        setFeedback({
          type: 'error',
          message: isSuperAdmin ? `خطا در دریافت وضعیت: ${err.message}` : 'خطا در بررسی وضعیت پخش زنده'
        });
      }
    } finally {
      if (!silent) setIsCheckingStatus(false);
    }
  };

  // Poll status when autoRefresh is enabled
  useEffect(() => {
    if (githubToken && githubRepo) {
      fetchStatus(true);
    }
  }, [githubToken, githubRepo, githubWorkflow]);

  useEffect(() => {
    if (!autoRefresh || !githubToken || !githubRepo) return;
    const interval = setInterval(() => {
      fetchStatus(true);
    }, 12000);
    return () => clearInterval(interval);
  }, [autoRefresh, githubToken, githubRepo, githubWorkflow]);

  const handleStartStream = async () => {
    if (!githubToken.trim()) {
      setFeedback({
        type: 'error',
        message: isSuperAdmin
          ? 'لطفاً ابتدا توکن دسترسی گیت‌هاب (Personal Access Token) را در تنظیمات وارد نمایید.'
          : 'تنظیمات اتصال پخش زنده توسط مدیر ارشد تکمیل نشده است. لطفاً با مدیر ارشد هماهنگ فرمایید.'
      });
      return;
    }
    if (!githubRepo.trim()) {
      setFeedback({
        type: 'error',
        message: isSuperAdmin
          ? 'لطفاً نام ریپازیتوری گیت‌هاب را وارد کنید (مثال: username/repo).'
          : 'تنظیمات سرور پخش زنده تکمیل نشده است. لطفاً با مدیر ارشد هماهنگ فرمایید.'
      });
      return;
    }

    setIsStarting(true);
    setFeedback(null);
    setTestResult(null);

    // Save selected params to settings
    onUpdateSettings({
      streamQuality: quality,
      streamFps: fps,
      streamDuration: duration
    });

    try {
      const res = await fetch('/api/stream/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: githubToken,
          repo: githubRepo,
          workflow: githubWorkflow,
          quality,
          fps,
          duration
        })
      });

      const data = await res.json();
      if (data.success) {
        setFeedback({
          type: 'success',
          message: isSuperAdmin
            ? '🚀 دستور اجرای استریم با موفقیت ارسال شد! ورکفلو در گیت‌هاب در حال آماده‌سازی و شروع است.'
            : '🚀 دستور اجرای پخش زنده با موفقیت ارسال شد! لطفاً چند لحظه صبر نمایید.'
        });
        // Check status after 3 seconds
        setTimeout(() => fetchStatus(true), 3500);
      } else {
        setFeedback({
          type: 'error',
          message: isSuperAdmin
            ? `❌ خطا در راه‌اندازی استریم: ${data.error || 'خطای ناشناخته'}`
            : '❌ خطا در راه‌اندازی پخش زنده. لطفاً دقایقی دیگر مجدداً تلاش نمایید.'
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: isSuperAdmin
          ? `❌ خطا در برقراری ارتباط با سرور: ${err.message}`
          : '❌ خطا در برقراری ارتباط با سرور.'
      });
    } finally {
      setIsStarting(false);
    }
  };

  const handleCancelStream = async (runId: number) => {
    if (!confirm('آیا از قطع و لغو این استریم در حال اجرا اطمینان دارید؟')) return;
    setIsCanceling(true);
    try {
      const res = await fetch('/api/stream/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: githubToken,
          repo: githubRepo,
          run_id: runId
        })
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({
          type: 'success',
          message: isSuperAdmin
            ? '🛑 دستور قطع استریم با موفقیت به گیت‌هاب ارسال شد.'
            : '🛑 دستور توقف پخش زنده با موفقیت ارسال شد.'
        });
        setTimeout(() => fetchStatus(true), 2500);
      } else {
        setFeedback({
          type: 'error',
          message: isSuperAdmin ? `خطا در لغو استریم: ${data.error}` : 'خطا در توقف پخش زنده'
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: isSuperAdmin ? `خطا: ${err.message}` : 'خطا در ارتباط با سرور'
      });
    } finally {
      setIsCanceling(false);
    }
  };

  const handleTestStreamHealth = async () => {
    setIsTestingStream(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/stream/test-hls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamUrl: activeStreamUrl })
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setIsTestingStream(false);
    }
  };

  const handleDiagnoseGitHub = async () => {
    if (!githubToken.trim() || !githubRepo.trim()) {
      setFeedback({
        type: 'error',
        message: 'لطفاً ابتدا توکن گیت‌هاب و نام ریپازیتوری را وارد نمایید.'
      });
      return;
    }
    setIsDiagnosing(true);
    setDiagnoseResult(null);
    try {
      const res = await fetch('/api/stream/diagnose-github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: githubToken, repo: githubRepo })
      });
      const data = await res.json();
      setDiagnoseResult(data);
      if (data.success) {
        setFeedback({
          type: 'success',
          message: `اتصال به کاربر ${data.user} و مخزن ${data.repo} تایید شد. (${data.workflows.length} ورکفلو شناسایی شد)`
        });
      } else {
        setFeedback({
          type: 'error',
          message: data.error || 'خطا در ارزیابی دسترسی گیت‌هاب'
        });
      }
    } catch (err: any) {
      setDiagnoseResult({ success: false, error: err.message });
    } finally {
      setIsDiagnosing(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(label);
    setTimeout(() => setCopiedLink(null), 2500);
  };

  const latestRun = statusData?.latestRun;
  const isRunning = latestRun && (latestRun.status === 'in_progress' || latestRun.status === 'queued');

  return (
    <div className="space-y-6">
      {/* Top Banner Card: Stream Status & Quick Launch */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 md:p-8 border border-indigo-500/30 shadow-2xl relative overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="px-3.5 py-1 rounded-full text-xs font-black bg-red-600/30 border border-red-500/50 text-red-300 flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-red-500 animate-ping' : 'bg-slate-400'}`} />
                {isRunning ? 'پخش زنده فعال (در حال اجرا)' : 'پخش زنده متوقف است'}
              </span>

              {isSuperAdmin && latestRun && (
                <span className="text-xs font-mono bg-white/10 px-2.5 py-1 rounded-lg text-slate-300">
                  Run #{latestRun.run_number} ({latestRun.status})
                </span>
              )}
            </div>

            <h2 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
              <i className="fas fa-satellite-dish text-red-400 text-2xl animate-pulse"></i>
              {isSuperAdmin ? 'مرکز کنترل و راه‌اندازی پخش زنده (M3U8 Streamer)' : 'مرکز کنترل و راه‌اندازی پخش زنده'}
            </h2>

            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              {isSuperAdmin
                ? 'با این قابلیت می‌توانید صفحه نمایشگر آنلاین را از طریق سرورهای قدرتمند گیت‌هاب (GitHub Actions) ضبط کرده، به فرمت ویدیویی HLS تبدیل نموده و از طریق باکت ابری نئون و پروکسی ضدفیلتر کلودفلر در سراسر ایران پخش زنده نمایید.'
                : 'با این قابلیت می‌توانید صفحه نمایشگر آنلاین را به صورت زنده برای مخاطبان در سراسر کشور پخش نمایید.'}
            </p>
          </div>

          {/* Quick Launch Control Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-shrink-0">
            {isRunning ? (
              <button
                onClick={() => handleCancelStream(latestRun.id)}
                disabled={isCanceling}
                className="px-6 py-4 rounded-2xl bg-red-600 hover:bg-red-700 active:scale-95 text-white font-black text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-red-600/40 transition-all cursor-pointer"
              >
                {isCanceling ? <Spinner size="w-5 h-5" color="border-white" /> : <><i className="fas fa-stop-circle text-lg"></i> توقف و قطع استریم</>}
              </button>
            ) : (
              <button
                onClick={handleStartStream}
                disabled={isStarting}
                className="px-8 py-4 rounded-2xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 active:scale-95 text-white font-black text-base flex items-center justify-center gap-3 shadow-xl shadow-red-500/30 transition-all cursor-pointer group"
              >
                {isStarting ? (
                  <>
                    <Spinner size="w-5 h-5" color="border-white" />
                    <span>در حال ارسال دستور...</span>
                  </>
                ) : (
                  <>
                    <i className="fas fa-play-circle text-xl group-hover:scale-110 transition-transform"></i>
                    <span>{isSuperAdmin ? 'شروع پخش زنده (Run Workflow)' : 'شروع پخش زنده'}</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={() => fetchStatus(false)}
              disabled={isCheckingStatus}
              className="px-4 py-4 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-slate-200 text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
              title="بازخوانی وضعیت"
            >
              {isCheckingStatus ? <Spinner size="w-4 h-4" color="border-white" /> : <i className="fas fa-sync-alt"></i>}
              <span className="hidden sm:inline">بروزرسانی</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div className={`mt-6 p-4 rounded-2xl text-sm font-bold flex items-center justify-between gap-3 animate-fade-in ${
            feedback.type === 'success' 
              ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-200' 
              : feedback.type === 'error' 
              ? 'bg-red-500/20 border border-red-500/40 text-red-200' 
              : 'bg-blue-500/20 border border-blue-500/40 text-blue-200'
          }`}>
            <div className="flex items-center gap-2.5">
              <i className={`fas ${feedback.type === 'success' ? 'fa-check-circle text-emerald-400' : 'fa-exclamation-triangle text-red-400'} text-lg`}></i>
              <span>{feedback.message}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-white/60 hover:text-white">
              <i className="fas fa-times"></i>
            </button>
          </div>
        )}
      </div>

      {/* Grid: 1. Launch Parameters & 2. Live URLs & Player */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Launch Parameters */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="font-black text-slate-800 dark:text-slate-100 text-base flex items-center gap-2">
              <i className="fas fa-sliders-h text-indigo-600"></i>
              {isSuperAdmin ? 'تنظیمات پارامترهای استریم' : 'تنظیمات پخش زنده'}
            </h3>
            <span className="text-xs text-slate-400">
              {isSuperAdmin ? 'پارامترهای ارسالی به ورکفلو' : 'کیفیت، فریم ریت و مدت زمان پخش'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                کیفیت تصویر
              </label>
              <select
                value={quality}
                onChange={e => setQuality(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="240p">240p (بسیار سبک)</option>
                <option value="360p">360p (سبک)</option>
                <option value="480p">480p (متوسط)</option>
                <option value="720p">720p (استاندارد HD) ⭐</option>
                <option value="1080p">1080p (Full HD)</option>
                <option value="1440p">1440p (2K)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                نرخ فریم (FPS)
              </label>
              <select
                value={fps}
                onChange={e => setFps(parseInt(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value={15}>15 فریم (مصرف کمتر)</option>
                <option value={20}>20 فریم</option>
                <option value={30}>30 فریم (روان و استاندارد) ⭐</option>
                <option value={60}>60 فریم (فوق‌العاده روان)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                مدت زمان (دقیقه)
              </label>
              <select
                value={duration}
                onChange={e => setDuration(parseInt(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm font-bold text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value={15}>۱۵ دقیقه (تست سریع)</option>
                <option value={30}>۳۰ دقیقه</option>
                <option value={60}>۶۰ دقیقه (۱ ساعت) ⭐</option>
                <option value={120}>۱۲۰ دقیقه (۲ ساعت)</option>
                <option value={180}>۱۸۰ دقیقه (۳ ساعت)</option>
                <option value={360}>{isSuperAdmin ? '۳۶۰ دقیقه (۶ ساعت - حداکثر گیت‌هاب)' : '۳۶۰ دقیقه (۶ ساعت)'}</option>
              </select>
            </div>
          </div>

          {/* Workflow Status Details - Super Admin Only */}
          {isSuperAdmin && (
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">آخرین وضعیت لاگ گیت‌هاب:</span>
                {latestRun && (
                  <a
                    href={latestRun.html_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-bold"
                  >
                    <span>مشاهده لاگ زنده در گیت‌هاب</span>
                    <i className="fas fa-external-link-alt text-[10px]"></i>
                  </a>
                )}
              </div>

              {latestRun ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block mb-0.5">وضعیت اجرا</span>
                    <span className={`text-xs font-black ${
                      latestRun.status === 'in_progress' ? 'text-amber-500' :
                      latestRun.status === 'completed' && latestRun.conclusion === 'success' ? 'text-green-500' :
                      latestRun.status === 'completed' && latestRun.conclusion === 'failure' ? 'text-red-500' :
                      'text-slate-600 dark:text-slate-300'
                    }`}>
                      {latestRun.status === 'in_progress' ? '⏳ در حال اجرا' :
                       latestRun.status === 'completed' && latestRun.conclusion === 'success' ? '✔ موفق' :
                       latestRun.status === 'completed' && latestRun.conclusion === 'failure' ? '✖ ناموفق' :
                       latestRun.status}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block mb-0.5">نتیجه نهایی</span>
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                      {latestRun.conclusion || 'در جریان...'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block mb-0.5">شماره اجرا</span>
                    <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200">
                      #{latestRun.run_number}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 block mb-0.5">زمان شروع</span>
                    <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                      {new Date(latestRun.created_at).toLocaleTimeString('fa-IR')}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic text-center py-2">
                  اطلاعاتی از اجرای ورکفلو دریافت نشد یا توکن گیت‌هاب تنظیم نشده است.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Card 2: Stream Output Links & Preview */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="font-black text-slate-800 dark:text-slate-100 text-base flex items-center gap-2">
              <i className="fas fa-link text-emerald-600"></i>
              {isSuperAdmin ? 'آدرس‌های خروجی و لینک استریم' : 'لینک و پلیر پخش زنده'}
            </h3>
            {isSuperAdmin && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTestStreamHealth}
                  disabled={isTestingStream}
                  className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {isTestingStream ? <Spinner size="w-3 h-3" color="border-emerald-600" /> : <i className="fas fa-heartbeat"></i>}
                  <span>تست سلامت لینک</span>
                </button>
              </div>
            )}
          </div>

          {/* Test Health Result (Super Admin) */}
          {isSuperAdmin && testResult && (
            <div className={`p-3 rounded-2xl text-xs font-bold ${
              testResult.success 
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' 
                : 'bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'
            }`}>
              <div className="flex items-center justify-between">
                <span>{testResult.success ? '✔ ارتباط با فایل live.m3u8 برقرار است و پخش زنده آماده دریافت است.' : `❌ خطا در ارتباط: ${testResult.error || 'فایل استریم یافت نشد (کد ' + testResult.statusCode + ')'}`}</span>
                <span className="font-mono text-[11px]">{testResult.isM3U8 ? 'Valid HLS Stream' : ''}</span>
              </div>
            </div>
          )}

          {/* Live Stream Link Section */}
          {isSuperAdmin ? (
            <>
              {/* SuperAdmin Link 1: Cloudflare Anti-Sanction Proxy Link */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    لینک پروکسی کلودفلر (ضدتحریم و بدون فیلتر در ایران - توصیه شده)
                  </label>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">CORS + No-Cache</span>
                </div>
                <div className="flex gap-2">
                  <input
                    readOnly
                    dir="ltr"
                    value={workerUrl ? (workerUrl.endsWith('.m3u8') ? workerUrl : `${workerUrl.replace(/\/$/, '')}/live.m3u8`) : 'هنوز آدرس ورکر کلودفلر در تنظیمات وارد نشده است'}
                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-mono text-slate-700 dark:text-slate-300 select-all"
                  />
                  <button
                    onClick={() => copyToClipboard(workerUrl ? (workerUrl.endsWith('.m3u8') ? workerUrl : `${workerUrl.replace(/\/$/, '')}/live.m3u8`) : '', 'worker')}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer flex-shrink-0"
                  >
                    <i className={`fas ${copiedLink === 'worker' ? 'fa-check text-green-400' : 'fa-copy'}`}></i>
                    <span>{copiedLink === 'worker' ? 'کپی شد' : 'کپی'}</span>
                  </button>
                </div>
              </div>

              {/* SuperAdmin Link 2: Direct Neon S3 Storage Link */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  لینک مستقیم باکت استوریج نئون (Neon S3 Endpoint)
                </label>
                <div className="flex gap-2">
                  <input
                    readOnly
                    dir="ltr"
                    value={neonUrl}
                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-mono text-slate-700 dark:text-slate-300 select-all"
                  />
                  <button
                    onClick={() => copyToClipboard(neonUrl, 'neon')}
                    className="px-3.5 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer flex-shrink-0"
                  >
                    <i className={`fas ${copiedLink === 'neon' ? 'fa-check text-green-500' : 'fa-copy'}`}></i>
                    <span>{copiedLink === 'neon' ? 'کپی شد' : 'کپی'}</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Normal Admin: Clean Live Stream Link Only (No technical terms) */
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  لینک پخش زنده
                </label>
              </div>
              <div className="flex gap-2">
                <input
                  readOnly
                  dir="ltr"
                  value={activeStreamUrl}
                  className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-xs font-mono text-slate-700 dark:text-slate-300 select-all"
                />
                <button
                  onClick={() => copyToClipboard(activeStreamUrl, 'stream')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer flex-shrink-0"
                >
                  <i className={`fas ${copiedLink === 'stream' ? 'fa-check text-green-300' : 'fa-copy'}`}></i>
                  <span>{copiedLink === 'stream' ? 'کپی شد' : 'کپی لینک'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Preview Toggle & Video Element */}
          <div className="pt-2">
            <button
              onClick={() => setShowPlayer(!showPlayer)}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border border-indigo-200 dark:border-indigo-800/50"
            >
              <i className={`fas ${showPlayer ? 'fa-eye-slash' : 'fa-play'}`}></i>
              <span>{showPlayer ? 'بستن پلیر پیش‌نمایش' : 'نمایش پلیر پیش‌نمایش زنده'}</span>
            </button>

            {showPlayer && (
              <div className="mt-3 p-3 bg-black rounded-2xl overflow-hidden shadow-inner">
                <video
                  ref={videoRef}
                  src={activeStreamUrl}
                  controls
                  autoPlay
                  playsInline
                  className="w-full max-h-64 rounded-xl object-contain bg-black"
                >
                  مرورگر شما از پخش ویدیو زنده پشتیبانی نمی‌کند.
                </video>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 px-1">
                  <span>{isSuperAdmin ? `منبع در حال پخش: ${workerUrl ? 'پروکسی کلودفلر' : 'استوریج نئون'}` : 'پیش‌نمایش زنده'}</span>
                  <a href={activeStreamUrl} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">
                    باز کردن در تب جدید
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Settings & Credentials Accordion - Super Admin Only */}
      {isSuperAdmin && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-black text-slate-800 dark:text-slate-100 text-base flex items-center gap-2">
                <i className="fab fa-github text-slate-900 dark:text-white"></i>
                تنظیمات اتصال به گیت‌هاب و سرور پروکسی
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">این مقادیر در دیتابیس برنامه ذخیره می‌شوند تا بدون نیاز به کدنویسی مجدد، پخش زنده با یک کلیک اجرا شود.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* GitHub PAT */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                توکن شخصی گیت‌هاب (Personal Access Token - PAT) *
              </label>
              <input
                type="password"
                dir="ltr"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={settings.githubToken || ''}
                onChange={e => onUpdateSettings({ githubToken: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-slate-400 block">
                توکن باید دسترسی <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">workflow</code> و <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">repo</code> داشته باشد.
              </span>
            </div>

            {/* GitHub Repo */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                نام ریپازیتوری در گیت‌هاب (Owner/Repo) *
              </label>
              <input
                type="text"
                dir="ltr"
                placeholder="username/repo-name"
                value={settings.githubRepo || ''}
                onChange={e => onUpdateSettings({ githubRepo: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Workflow File */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                نام فایل ورکفلو در گیت‌هاب (Workflow File)
              </label>
              <input
                type="text"
                dir="ltr"
                placeholder="streamer.yml"
                value={settings.githubWorkflow || 'streamer.yml'}
                onChange={e => onUpdateSettings({ githubWorkflow: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Target Display URL */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                آدرس صفحه‌ای که باید استریم شود (Target Display URL)
              </label>
              <input
                type="url"
                dir="ltr"
                placeholder="https://.../display"
                value={settings.streamTargetUrl || 'https://kheyriyeh2.hudsonparker87.workers.dev/display'}
                onChange={e => onUpdateSettings({ streamTargetUrl: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Cloudflare Worker Proxy URL */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                آدرس دامنه ورکر کلودفلر (Cloudflare Worker Proxy URL)
              </label>
              <input
                type="url"
                dir="ltr"
                placeholder="https://live-proxy.yourname.workers.dev"
                value={settings.streamWorkerUrl || ''}
                onChange={e => onUpdateSettings({ streamWorkerUrl: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-slate-400 block">
                ورکر کلودفلر تحریم‌های ایران را دور می‌زند و کش را صفر نگه می‌دارد تا تصویر با تاخیر کم پخش شود.
              </span>
            </div>
          </div>

          {/* Diagnostics Button & Results */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <button
                onClick={handleDiagnoseGitHub}
                disabled={isDiagnosing}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
              >
                {isDiagnosing ? <Spinner size="w-4 h-4" color="border-white" /> : <i className="fas fa-stethoscope text-indigo-400"></i>}
                <span>تست و عیب‌یابی دقیق اتصال به گیت‌هاب (Diagnose)</span>
              </button>

              <span className="text-[11px] text-slate-400">
                بررسی وجود ورکفلوها، دسترسی توکن و شاخه فعال در ریپازیتوری
              </span>
            </div>

            {diagnoseResult && (
              <div className={`p-4 rounded-2xl text-xs font-mono border ${
                diagnoseResult.success 
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              }`}>
                {diagnoseResult.success ? (
                  <div className="space-y-1.5 font-sans">
                    <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-300">
                      <i className="fas fa-check-circle"></i>
                      <span>اتصال با موفقیت برقرار شد!</span>
                    </div>
                    <div>👤 <strong>کاربر:</strong> {diagnoseResult.user}</div>
                    <div>📁 <strong>ریپازیتوری:</strong> {diagnoseResult.repo} (شاخه پیش‌فرض: {diagnoseResult.default_branch})</div>
                    <div>🔑 <strong>مجوزهای توکن:</strong> {diagnoseResult.scopes || 'دسترسی Fine-grained'}</div>
                    <div className="pt-1">
                      ⚙️ <strong>ورکفلوهای شناسایی‌شده روی گیت‌هاب ({diagnoseResult.workflows?.length || 0}):</strong>
                      {diagnoseResult.workflows?.length > 0 ? (
                        <ul className="list-disc list-inside mt-1 font-mono text-[11px] space-y-0.5">
                          {diagnoseResult.workflows.map((w: any) => (
                            <li key={w.id}>
                              {w.name} ({w.path}) - <span className="text-emerald-600 dark:text-emerald-400">{w.state}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-amber-600 dark:text-amber-400 text-xs mt-1 font-bold">
                          ⚠️ هیچ ورکفلویی در این ریپازیتوری روی گیت‌هاب یافت نشد! لطفاً فایل‌های این پروژه را در گیت‌هاب Commit کنید.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 font-sans">
                    <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-300">
                      <i className="fas fa-exclamation-triangle"></i>
                      <span>خطا در بررسی گیت‌هاب:</span>
                    </div>
                    <p className="text-xs">{diagnoseResult.error}</p>
                    <div className="text-[11px] bg-white dark:bg-slate-900 p-3 rounded-xl border border-rose-200 dark:border-rose-900/50 space-y-1 text-slate-700 dark:text-slate-300">
                      <strong>راهنما برای رفع مشکل Not Found:</strong>
                      <ol className="list-decimal list-inside space-y-1 mt-1">
                        <li>مطمئن شوید تغییرات این پروژه را از همین محیط در گیت‌هاب <strong>Commit</strong> کرده‌اید تا فایل <code className="text-indigo-600">.github/workflows/streamer.yml</code> به گیت‌هاب منتقل شود.</li>
                        <li>هنگام ساخت Personal Access Token در گیت‌هاب، تیک‌های <strong>repo</strong> و <strong>workflow</strong> را زده باشید.</li>
                        <li>نام ریپازیتوری را دقیقا به صورت <code className="text-indigo-600">username/repo-name</code> وارد کرده باشید.</li>
                      </ol>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
