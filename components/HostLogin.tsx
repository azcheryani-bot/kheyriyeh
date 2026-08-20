import React, { useState } from 'react';
import { dbApi } from '../db-client';
import { Spinner } from './Shared';
import { HostSession } from '../types';

interface HostLoginProps {
  onLoginSuccess: (session: HostSession) => void;
  onCancel: () => void;
}

export const HostLogin: React.FC<HostLoginProps> = ({ onLoginSuccess, onCancel }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('لطفاً نام کاربری و رمز عبور را وارد نمایید.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await dbApi.host.login(username.trim(), password.trim());
      if (res?.success && res.event) {
        const session: HostSession = {
          eventId: res.event.id,
          eventTitle: res.event.title,
          hostUsername: res.event.hostUsername || username.trim(),
        };
        sessionStorage.setItem('host_session', JSON.stringify(session));
        onLoginSuccess(session);
      } else {
        setError(res?.error || 'نام کاربری یا رمز عبور اشتباه است.');
      }
    } catch (err: any) {
      console.error('Host login error:', err);
      setError(err.response?.data?.error || 'خطا در ارتباط با سرور. لطفاً مجدداً تلاش نمایید.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden">
        {/* Top Decorative Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-purple-900/40 border border-purple-500/30 text-purple-400 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4 shadow-lg shadow-purple-950/50">
            <i className="fas fa-user-shield"></i>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white mb-2">
            ورود اختصاصی صاحبان عزا
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            جهت مشاهده، چاپ و دانلود لیست خیرین مراسم، اطلاعات کاربری خود را وارد فرمایید.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-red-950/60 border border-red-800/80 text-red-300 rounded-2xl text-xs sm:text-sm flex items-center gap-2">
            <i className="fas fa-exclamation-circle text-base shrink-0"></i>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              نام کاربری مراسم:
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="نام کاربری تعریف شده برای مراسم"
                disabled={loading}
                className="w-full bg-slate-800/90 border border-slate-700 focus:border-purple-500 text-white rounded-xl py-3 px-4 text-sm outline-none transition-all focus:ring-2 focus:ring-purple-500/20"
                autoFocus
              />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                <i className="fas fa-user"></i>
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              رمز عبور:
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="رمز عبور"
                disabled={loading}
                className="w-full bg-slate-800/90 border border-slate-700 focus:border-purple-500 text-white rounded-xl py-3 px-4 text-sm outline-none transition-all focus:ring-2 focus:ring-purple-500/20 font-mono"
              />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                <i className="fas fa-lock"></i>
              </span>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 active:scale-[0.99] text-white font-black py-3.5 px-4 rounded-xl shadow-lg shadow-purple-900/40 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <Spinner size="w-5 h-5" />
              ) : (
                <>
                  <i className="fas fa-sign-in-alt"></i>
                  <span>ورود به پنل مراسم</span>
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-800 text-center">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5 mx-auto"
          >
            <i className="fas fa-arrow-right"></i>
            <span>بازگشت به صفحه اصلی</span>
          </button>
        </div>
      </div>
    </div>
  );
};
