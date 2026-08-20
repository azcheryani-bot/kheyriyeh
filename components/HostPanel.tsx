import React, { useState, useEffect, useMemo } from 'react';
import { HostSession, HostDonation } from '../types';
import { dbApi } from '../db-client';
import { Spinner } from './Shared';
import { formatJalaliDateTime } from '../persian-utils';

interface HostPanelProps {
  session: HostSession;
  onLogout: () => void;
}

export const HostPanel: React.FC<HostPanelProps> = ({ session, onLogout }) => {
  const [donations, setDonations] = useState<HostDonation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDonations = async (showRefreshSpinner = false) => {
    if (showRefreshSpinner) setIsRefreshing(true);
    setError(null);
    try {
      const res = await dbApi.host.getDonations();
      if (res?.success && Array.isArray(res.donations)) {
        setDonations(res.donations);
      } else {
        setError(res?.error || 'خطا در دریافت لیست خیرین.');
      }
    } catch (err: any) {
      console.error('Error fetching host donations:', err);
      setError(err.response?.data?.error || 'خطا در برقراری ارتباط با سرور.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDonations();
    // Realtime update listener if available
    const cleanup = dbApi.subscribe(() => {
      fetchDonations();
    });
    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, []);

  // Filtered donations based on search query
  const filteredDonations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return donations;
    return donations.filter(d => {
      const name = (d.donorName || '').toLowerCase();
      const father = (d.fatherName || '').toLowerCase();
      const mobile = (d.mobile || '').toLowerCase();
      const desc = (d.description || '').toLowerCase();
      return name.includes(q) || father.includes(q) || mobile.includes(q) || desc.includes(q);
    });
  }, [donations, searchQuery]);

  // Print list function
  const handlePrint = () => {
    window.print();
  };

  // Download list as CSV (Excel compatible with UTF-8 BOM)
  const handleDownloadCSV = () => {
    if (donations.length === 0) {
      alert('لیست خیرین خالی است.');
      return;
    }

    const headers = ['ردیف', 'نام و نام خانوادگی خیر', 'نام پدر', 'شماره موبایل', 'توضیحات / بابت', 'تاریخ و ساعت ثبت'];
    const rows = donations.map((d, index) => {
      const dateInfo = formatJalaliDateTime(d.createdAt);
      return [
        index + 1,
        `"${(d.donorName || '').replace(/"/g, '""')}"`,
        `"${(d.fatherName || '').replace(/"/g, '""')}"`,
        `"${(d.mobile || '').replace(/"/g, '""')}"`,
        `"${(d.description || '').replace(/"/g, '""')}"`,
        `"${dateInfo.full}"`,
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const cleanTitle = (session.eventTitle || 'مراسم').replace(/[\/\\?%*:|"<>]/g, '-');
    link.setAttribute('href', url);
    link.setAttribute('download', `لیست_خیرین_${cleanTitle}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download list as text file
  const handleDownloadTXT = () => {
    if (donations.length === 0) {
      alert('لیست خیرین خالی است.');
      return;
    }

    let text = `========================================\n`;
    text += `لیست خیرین و احسان‌کنندگان مراسم: ${session.eventTitle}\n`;
    text += `تعداد کل خیرین: ${donations.length} نفر\n`;
    text += `تاریخ دریافت گزارش: ${new Date().toLocaleDateString('fa-IR')}\n`;
    text += `========================================\n\n`;

    donations.forEach((d, index) => {
      const dateInfo = formatJalaliDateTime(d.createdAt);
      text += `${index + 1}. نام خیر: ${d.donorName || '-'}\n`;
      text += `   نام پدر: ${d.fatherName || '-'}\n`;
      text += `   شماره تماس: ${d.mobile || '-'}\n`;
      if (d.description) text += `   توضیحات: ${d.description}\n`;
      text += `   تاریخ ثبت: ${dateInfo.full}\n`;
      text += `----------------------------------------\n`;
    });

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const cleanTitle = (session.eventTitle || 'مراسم').replace(/[\/\\?%*:|"<>]/g, '-');
    link.setAttribute('href', url);
    link.setAttribute('download', `لیست_خیرین_${cleanTitle}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('host_session');
    dbApi.host.logout();
    onLogout();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans pb-16">
      {/* Print-Only Formal Header */}
      <div className="hidden print:block p-8 border-b-2 border-slate-900 mb-6">
        <div className="text-center">
          <h1 className="text-2xl font-black text-slate-900 mb-2">
            لیست خیرین و احسان‌کنندگان
          </h1>
          <h2 className="text-lg font-bold text-slate-700 mb-2">
            {session.eventTitle}
          </h2>
          <div className="flex justify-between text-xs text-slate-600 mt-4 pt-2 border-t border-slate-300">
            <span>تعداد کل ثبت‌شده‌ها: {donations.length} نفر</span>
            <span>تاریخ چاپ گزارش: {new Date().toLocaleDateString('fa-IR')}</span>
          </div>
        </div>
      </div>

      {/* Screen Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xl shrink-0 shadow-sm">
              <i className="fas fa-user-shield"></i>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-bold px-2 py-0.5 rounded-md">
                  پنل اختصاصی صاحب عزا
                </span>
                <span className="text-xs text-slate-400">
                  کاربر: <b>{session.hostUsername}</b>
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-0.5">
                {session.eventTitle}
              </h1>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => fetchDonations(true)}
              disabled={isRefreshing}
              className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="بروزرسانی لیست خیرین"
            >
              <i className={`fas fa-sync-alt ${isRefreshing ? 'animate-spin' : ''}`}></i>
              <span>بروزرسانی</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={donations.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-600/20 disabled:opacity-50"
              title="چاپ لیست خیرین"
            >
              <i className="fas fa-print"></i>
              <span>چاپ لیست</span>
            </button>

            <button
              onClick={handleDownloadCSV}
              disabled={donations.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-600/20 disabled:opacity-50"
              title="دانلود فایل اکسل (CSV)"
            >
              <i className="fas fa-file-excel"></i>
              <span>دانلود اکسل</span>
            </button>

            <button
              onClick={handleDownloadTXT}
              disabled={donations.length === 0}
              className="bg-teal-600 hover:bg-teal-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-teal-600/20 disabled:opacity-50"
              title="دانلود فایل متنی (TXT)"
            >
              <i className="fas fa-file-alt"></i>
              <span>دانلود متن</span>
            </button>

            <button
              onClick={handleLogout}
              className="bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60 px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="خروج از پنل مراسم"
            >
              <i className="fas fa-sign-out-alt"></i>
              <span>خروج</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Controls Card */}
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
          <div className="w-full sm:max-w-md relative">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="جستجو بر اساس نام خیر، نام پدر، شماره موبایل..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-white rounded-xl py-2.5 pr-10 pl-4 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-purple-500"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <i className="fas fa-search"></i>
            </span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
              >
                <i className="fas fa-times-circle"></i>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end text-xs text-slate-500 dark:text-slate-400">
            <span>
              تعداد خیرین: <b className="text-slate-800 dark:text-white font-bold text-sm">{donations.length}</b> نفر
            </span>
            {searchQuery && (
              <span className="bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 px-2.5 py-1 rounded-lg font-bold">
                نتایج فیلتر: {filteredDonations.length} نفر
              </span>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-2xl text-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <i className="fas fa-exclamation-triangle text-base"></i>
              <span>{error}</span>
            </div>
            <button
              onClick={() => fetchDonations(true)}
              className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold"
            >
              تلاش مجدد
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <Spinner size="w-8 h-8" color="border-purple-600" />
            <p className="text-xs text-slate-400 mt-3 font-bold">در حال بارگذاری لیست خیرین...</p>
          </div>
        ) : filteredDonations.length === 0 ? (
          <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 text-2xl mx-auto mb-3">
              <i className="fas fa-users-slash"></i>
            </div>
            <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">
              {searchQuery ? 'هیچ خیری با مشخصات وارد شده یافت نشد.' : 'هنوز خیری برای این مراسم ثبت نشده است.'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              به محض ثبت احسان توسط مسئولین، اطلاعات خیرین در این بخش نمایش داده خواهد شد.
            </p>
          </div>
        ) : (
          /* Table of Donors (Without Monetary Amounts) */
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 text-xs font-bold border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3.5 px-4 w-12 text-center">ردیف</th>
                    <th className="py-3.5 px-4">نام و نام خانوادگی خیر</th>
                    <th className="py-3.5 px-4">نام پدر</th>
                    <th className="py-3.5 px-4">شماره تماس / موبایل</th>
                    <th className="py-3.5 px-4">توضیحات و بابت</th>
                    <th className="py-3.5 px-4 text-center">تاریخ و زمان ثبت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs sm:text-sm">
                  {filteredDonations.map((item, index) => {
                    const dateInfo = formatJalaliDateTime(item.createdAt);
                    return (
                      <tr
                        key={item.id || index}
                        className="hover:bg-purple-50/40 dark:hover:bg-purple-950/20 transition-colors"
                      >
                        <td className="py-3.5 px-4 text-center text-slate-400 font-bold text-xs">
                          {index + 1}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                          {item.donorName || '-'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                          {item.fatherName ? `فرزند ${item.fatherName}` : '-'}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-mono text-xs ltr text-right">
                          {item.mobile ? (
                            <span className="inline-block bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                              {item.mobile}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                          {item.description || '-'}
                        </td>
                        <td className="py-3.5 px-4 text-center text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          <div>{dateInfo.date}</div>
                          <div className="text-[10px] text-slate-400">{dateInfo.time}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Footer inside Card */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between flex-wrap gap-2 print:hidden">
              <span>
                نمایش <b>{filteredDonations.length}</b> از <b>{donations.length}</b> خیر ثبت‌شده
              </span>
              <span className="text-[11px] text-purple-600 dark:text-purple-400">
                <i className="fas fa-shield-alt ml-1"></i> این پنل فاقد مبالغ مالی بوده و صرفاً جهت تکریم و مشاهده اسامی خیرین گرامی می‌باشد.
              </span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
