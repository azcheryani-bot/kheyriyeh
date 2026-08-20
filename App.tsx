import React, { useState, useEffect, createContext, useContext } from 'react';
import { dbApi } from './db-client';
import { ViewType, Admin, HostSession } from './types';
import { AdminPanel } from './components/Admin';
import { DisplayCore } from './components/Display';
import { DonorPortal } from './components/Donor';
import { HostLogin } from './components/HostLogin';
import { HostPanel } from './components/HostPanel';
import { Spinner } from './components/Shared';

export const ThemeContext = createContext({
  isDark: false,
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

type AdminTab = 'donations' | 'settings' | 'events' | 'admins' | 'stream';

const App: React.FC = () => {
  const [view, setView] = useState<ViewType>('landing');
  const [adminTab, setAdminTab] = useState<AdminTab>('donations');
  const [credentials, setCredentials] = useState({ user: '', pass: '' });
  const [currentUser, setCurrentUser] = useState<Admin | null>(null);
  const [hostSession, setHostSession] = useState<HostSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDark, setIsDark] = useState(false);

  const changeView = (newView: ViewType, newTab: AdminTab = 'donations') => {
    setView(newView);
    setAdminTab(newTab);
  };

  useEffect(() => {
    // Ensure single URL at root without subpaths
    if (window.location.pathname !== '/') {
      window.history.replaceState(null, '', '/');
    }

    // Always clear session storage & localStorage on fresh load/reload so login is required every session refresh
    try {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('admin_token');
      sessionStorage.clear();
    } catch (e) {}

    const handleUnauthorized = () => {
      setCurrentUser(null);
      setHostSession(null);
      setCredentials({ user: '', pass: '' });
      try {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('admin_token');
        sessionStorage.clear();
      } catch (e) {}
      changeView('login');
    };

    window.addEventListener('auth_unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth_unauthorized', handleUnauthorized);
    };
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    setIsDark(prev => {
      const newDark = !prev;
      if (newDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
      return newDark;
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentials.user.trim() || !credentials.pass.trim()) {
      alert('لطفاً نام کاربری و رمز عبور را وارد کنید.');
      return;
    }
    setLoading(true);
    try {
      const res = await dbApi.auth.login(credentials.user, credentials.pass);
      if (res.success && res.user) {
        setCurrentUser(res.user);
        setCredentials({ user: '', pass: '' });
        changeView('admin', 'donations');
      } else {
        alert(res.error || 'نام کاربری یا رمز عبور نامعتبر است.');
      }
    } catch (e: any) {
      alert(e.response?.data?.error || 'خطا در برقراری ارتباط با سرور.');
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    try {
      await dbApi.auth.logout();
    } catch (e) {}
    setCurrentUser(null);
    setCredentials({ user: '', pass: '' });
    localStorage.removeItem('currentUser');
    localStorage.removeItem('admin_token');
    sessionStorage.clear();
    changeView('login');
  };

  const handleTabChange = (tab: AdminTab) => {
    setAdminTab(tab);
  };

  const renderContent = () => {
    if (view === 'landing') {
      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 space-y-12 relative overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
          
          <button onClick={toggleTheme} className="absolute top-6 left-6 w-12 h-12 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-yellow-400 hover:scale-110 transition-transform z-20">
            <i className={`fas ${isDark ? 'fa-sun' : 'fa-moon'} text-xl`}></i>
          </button>

          {/* Background Effects */}
          <div className="absolute top-0 left-0 w-full h-full opacity-30 dark:opacity-10 pointer-events-none transition-opacity duration-500">
             <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-300 dark:bg-blue-600 blur-[150px] rounded-full"></div>
             <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-300 dark:bg-purple-600 blur-[150px] rounded-full"></div>
          </div>

          <div className="relative z-10 text-center space-y-6">
             <h1 className="text-6xl md:text-8xl font-black text-slate-800 dark:text-white tracking-tighter drop-shadow-xl">سامانه جامع <span className="text-yellow-500">اکرام</span></h1>
             <p className="text-slate-600 dark:text-slate-400 text-sm md:text-xl max-w-2xl mx-auto leading-relaxed">سیستم هوشمند مدیریت مراسم‌های خیریه، ثبت مبالغ پرداخت و نمایشگر زنده.</p>
          </div>

          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-7xl px-4">
             <button onClick={()=>changeView('donor')} className="group flex flex-col items-center p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] hover:bg-green-50 dark:hover:bg-slate-800 transition-all hover:-translate-y-1.5 shadow-xl hover:shadow-2xl hover:border-green-300 dark:hover:border-green-500/50 cursor-pointer">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-500/10 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-green-500 group-hover:text-white transition-all text-green-600 dark:text-green-500 shadow-inner">
                  <i className="fas fa-hand-holding-heart text-3xl"></i>
                </div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white">درگاه مشارکت</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-2.5 text-center leading-relaxed">صفحه عمومی جهت ثبت مبالغ و نذورات توسط میهمانان در بستر وب</p>
             </button>

             <button onClick={()=>changeView('display')} className="group flex flex-col items-center p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] hover:bg-yellow-50 dark:hover:bg-slate-800 transition-all hover:-translate-y-1.5 shadow-xl hover:shadow-2xl hover:border-yellow-300 dark:hover:border-yellow-500/50 cursor-pointer">
                <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-500/10 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-yellow-500 group-hover:text-black transition-all text-yellow-600 dark:text-yellow-500 shadow-inner">
                  <i className="fas fa-desktop text-3xl"></i>
                </div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white">نمایشگر سالن</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-2.5 text-center leading-relaxed">اجرای مانیتور زنده جهت نمایش نام خیّرین در سالن‌های برگزاری مراسم</p>
             </button>

             <button onClick={()=>changeView(hostSession ? 'host_panel' : 'host_login')} className="group flex flex-col items-center p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] hover:bg-purple-50 dark:hover:bg-slate-800 transition-all hover:-translate-y-1.5 shadow-xl hover:shadow-2xl hover:border-purple-300 dark:hover:border-purple-500/50 cursor-pointer">
                <div className="w-16 h-16 bg-purple-100 dark:bg-purple-500/10 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-purple-600 group-hover:text-white transition-all text-purple-600 dark:text-purple-400 shadow-inner">
                  <i className="fas fa-user-shield text-3xl"></i>
                </div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white">پنل صاحبان عزا</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-2.5 text-center leading-relaxed">ورود اختصاصی جهت مشاهده، چاپ و دانلود لیست خیرین مراسم</p>
             </button>

             <button onClick={()=>changeView(currentUser ? 'admin' : 'login', 'donations')} className="group flex flex-col items-center p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] hover:bg-blue-50 dark:hover:bg-slate-800 transition-all hover:-translate-y-1.5 shadow-xl hover:shadow-2xl hover:border-blue-300 dark:hover:border-blue-500/50 cursor-pointer">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-blue-500 group-hover:text-white transition-all text-blue-600 dark:text-blue-500 shadow-inner">
                  <i className="fas fa-shield-halved text-3xl"></i>
                </div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white">پنل مدیریت</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-2.5 text-center leading-relaxed">دسترسی امن به تنظیمات سیستم، مراسم‌ها و مدیریت تراکنش‌ها</p>
             </button>
          </div>



          <div className="mt-12 text-slate-400 dark:text-slate-600 text-xs tracking-widest font-black uppercase z-10">کلیه حقوق مادی و معنوی متعلق به مرکز نیکوکاری حضرت ابالفضل (ع) می‌باشد</div>
        </div>
      );
    }

    if (view === 'login') {
      return (
        <div className="min-h-screen w-full flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 transition-colors duration-500 relative">
           <button onClick={toggleTheme} className="absolute top-6 left-6 w-12 h-12 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-yellow-400 hover:scale-110 transition-transform">
            <i className={`fas ${isDark ? 'fa-sun' : 'fa-moon'} text-xl`}></i>
          </button>
           <form onSubmit={handleLogin} className="bg-white dark:bg-slate-900 p-10 md:p-12 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 space-y-8 relative z-10">
              <div className="text-center space-y-3">
                 <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-3xl mx-auto flex items-center justify-center mb-4">
                    <i className="fas fa-lock text-3xl"></i>
                 </div>
                 <h2 className="text-3xl font-black text-slate-900 dark:text-white">احراز هویت</h2>
                 <p className="text-sm text-slate-500 dark:text-slate-400">جهت دسترسی به پنل مدیریت اطلاعات خود را وارد کنید</p>
              </div>
              <div className="space-y-5">
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mr-2">نام کاربری</label>
                    <input className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white" autoFocus value={credentials.user} onChange={e=>setCredentials({...credentials, user: e.target.value})} dir="ltr" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mr-2">رمز عبور</label>
                    <input type="password" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white" value={credentials.pass} onChange={e=>setCredentials({...credentials, pass: e.target.value})} dir="ltr" />
                 </div>
              </div>
              <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl hover:shadow-blue-500/30 transition-all flex items-center justify-center">
                 {loading ? <Spinner /> : 'ورود به سامانه'}
              </button>
              <button type="button" onClick={()=>changeView('landing')} className="w-full text-sm text-slate-400 dark:text-slate-500 font-bold hover:text-slate-600 dark:hover:text-slate-300 transition-colors">بازگشت به صفحه اصلی</button>
           </form>
           
           <div className="absolute top-0 left-0 w-full h-full opacity-30 dark:opacity-10 pointer-events-none transition-opacity duration-500">
             <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-300 dark:bg-blue-600 blur-[150px] rounded-full"></div>
           </div>
        </div>
      );
    }

    if (view === 'admin') {
      if (!currentUser) {
        return (
          <div className="min-h-screen w-full flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 transition-colors duration-500 relative">
            <button onClick={toggleTheme} className="absolute top-6 left-6 w-12 h-12 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-yellow-400 hover:scale-110 transition-transform">
              <i className={`fas ${isDark ? 'fa-sun' : 'fa-moon'} text-xl`}></i>
            </button>
            <form onSubmit={handleLogin} className="bg-white dark:bg-slate-900 p-10 md:p-12 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 space-y-8 relative z-10">
              <div className="text-center space-y-3">
                 <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-3xl mx-auto flex items-center justify-center mb-4">
                    <i className="fas fa-lock text-3xl"></i>
                 </div>
                 <h2 className="text-3xl font-black text-slate-900 dark:text-white">ورود به بخش مدیریت</h2>
                 <p className="text-sm text-slate-500 dark:text-slate-400">برای مشاهده این صفحه ابتدا وارد حساب کاربری خود شوید</p>
              </div>
              <div className="space-y-5">
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mr-2">نام کاربری</label>
                    <input className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white" autoFocus value={credentials.user} onChange={e=>setCredentials({...credentials, user: e.target.value})} dir="ltr" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mr-2">رمز عبور</label>
                    <input type="password" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white" value={credentials.pass} onChange={e=>setCredentials({...credentials, pass: e.target.value})} dir="ltr" />
                 </div>
              </div>
              <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl hover:shadow-blue-500/30 transition-all flex items-center justify-center">
                 {loading ? <Spinner /> : 'ورود به سامانه'}
              </button>
              <button type="button" onClick={()=>changeView('landing')} className="w-full text-sm text-slate-400 dark:text-slate-500 font-bold hover:text-slate-600 dark:hover:text-slate-300 transition-colors">بازگشت به صفحه اصلی</button>
            </form>
          </div>
        );
      }

      return (
        <AdminPanel
          currentUser={currentUser}
          onLogout={handleLogout}
          onShowDisplay={() => changeView('display')}
          activeTab={adminTab}
          onTabChange={handleTabChange}
        />
      );
    }

    if (view === 'display') {
      return <DisplayCore onExit={() => changeView('landing')} />;
    }

    if (view === 'donor') {
      return <DonorPortal onExit={() => changeView('landing')} onShowDisplay={() => changeView('display')} />;
    }

    if (view === 'host_login') {
      return (
        <HostLogin
          onLoginSuccess={(session) => {
            setHostSession(session);
            changeView('host_panel');
          }}
          onCancel={() => changeView('landing')}
        />
      );
    }

    if (view === 'host_panel') {
      if (!hostSession) {
        return (
          <HostLogin
            onLoginSuccess={(session) => {
              setHostSession(session);
              changeView('host_panel');
            }}
            onCancel={() => changeView('landing')}
          />
        );
      }
      return (
        <HostPanel
          session={hostSession}
          onLogout={() => {
            setHostSession(null);
            changeView('landing');
          }}
        />
      );
    }

    return null;
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {renderContent()}
    </ThemeContext.Provider>
  );
};

export default App;

