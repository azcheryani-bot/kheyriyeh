import React, { useState } from 'react';
import { Event } from '../types';
import { dbApi } from '../db-client';
import { Spinner } from './Shared';
import { formatJalaliDateTime } from '../persian-utils';

interface EventsArchiveManagerProps {
  events: Event[];
  activeEventId: string | null;
  selectedEventId: string;
  onSelectEvent: (id: string) => void;
  onEventsUpdated: () => void;
  onClose?: () => void;
}

export const EventsArchiveManager: React.FC<EventsArchiveManagerProps> = ({
  events,
  activeEventId,
  selectedEventId,
  onSelectEvent,
  onEventsUpdated,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'active_events' | 'archived_events'>('active_events');
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newHostUsername, setNewHostUsername] = useState('');
  const [newHostPassword, setNewHostPassword] = useState('');
  const [showHostFields, setShowHostFields] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionIds, setActionIds] = useState<Record<string, boolean>>({});
  const [editingEvent, setEditingEvent] = useState<{ id: string; title: string; hostUsername: string; hostPassword: string } | null>(null);

  // Archive confirmation modal state
  const [archiveTarget, setArchiveTarget] = useState<Event | null>(null);

  const activeList = events.filter(e => !e.isArchived);
  const archivedList = events.filter(e => !!e.isArchived);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) return;
    setLoading(true);
    try {
      const created = await dbApi.events.create(
        newEventTitle.trim(),
        newHostUsername.trim() || undefined,
        newHostPassword.trim() || undefined
      );
      if (created) {
        setNewEventTitle('');
        setNewHostUsername('');
        setNewHostPassword('');
        setShowHostFields(false);
        onEventsUpdated();
        onSelectEvent(created.id);
      }
    } catch (err: any) {
      alert('خطا در ثبت مراسم: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleActivateEvent = async (id: string) => {
    setActionIds(p => ({ ...p, [`act_${id}`]: true }));
    try {
      await dbApi.events.activate(id);
      onEventsUpdated();
      onSelectEvent(id);
    } catch (err: any) {
      alert('خطا در فعال‌سازی مراسم: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionIds(p => ({ ...p, [`act_${id}`]: false }));
    }
  };

  const handleUpdateEvent = async () => {
    if (!editingEvent || !editingEvent.title.trim()) return;
    setActionIds(p => ({ ...p, [`edit_${editingEvent.id}`]: true }));
    try {
      await dbApi.events.update(editingEvent.id, {
        title: editingEvent.title.trim(),
        hostUsername: editingEvent.hostUsername.trim() || '',
        hostPassword: editingEvent.hostPassword.trim() || '',
      });
      setEditingEvent(null);
      onEventsUpdated();
    } catch (err: any) {
      alert('خطا در ویرایش مراسم: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionIds(p => ({ ...p, [`edit_${editingEvent.id}`]: false }));
    }
  };

  const handleConfirmArchive = async () => {
    if (!archiveTarget) return;
    const targetId = archiveTarget.id;
    setActionIds(p => ({ ...p, [`arch_${targetId}`]: true }));
    try {
      const res = await dbApi.events.archive(targetId);
      setArchiveTarget(null);
      onEventsUpdated();
      alert(res?.message || 'مراسم با موفقیت بایگانی شد و فایل‌های پیوست آن پاک شدند.');
    } catch (err: any) {
      alert('خطا در بایگانی مراسم: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionIds(p => ({ ...p, [`arch_${targetId}`]: false }));
    }
  };

  const handleUnarchive = async (id: string) => {
    setActionIds(p => ({ ...p, [`unarch_${id}`]: true }));
    try {
      const res = await dbApi.events.unarchive(id);
      onEventsUpdated();
      alert(res?.message || 'مراسم از حالت بایگانی خارج شد.');
    } catch (err: any) {
      alert('خطا در بازگردانی مراسم: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionIds(p => ({ ...p, [`unarch_${id}`]: false }));
    }
  };

  const handleDeleteEvent = async (id: string, title: string) => {
    const ok = window.confirm(`آیا از حذف کامل مراسم «${title}» و کلیه تراکنش‌های مربوط به آن اطمینان دارید؟`);
    if (!ok) return;

    setActionIds(p => ({ ...p, [`del_${id}`]: true }));
    try {
      await dbApi.events.delete(id);
      onEventsUpdated();
    } catch (err: any) {
      alert('خطا در حذف مراسم: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionIds(p => ({ ...p, [`del_${id}`]: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center text-xl">
            <i className="fas fa-calendar-alt"></i>
          </div>
          <div>
            <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg">مدیریت و بایگانی مراسم‌ها</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              تعریف مراسم جدید، تغییر مراسم فعال، و بایگانی مراسم‌های پایان‌یافته
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-2 rounded-xl border border-slate-200 dark:border-slate-800"
          >
            <i className="fas fa-times text-lg"></i>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('active_events')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'active_events'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <i className="fas fa-calendar-check"></i>
          <span>مراسم‌های جاری و فعال ({activeList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('archived_events')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'archived_events'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <i className="fas fa-archive"></i>
          <span>مراسم‌های بایگانی‌شده ({archivedList.length})</span>
        </button>
      </div>

      {/* Create New Event Form (for active events) */}
      {activeTab === 'active_events' && (
        <form onSubmit={handleCreateEvent} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              className="flex-1 border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-white rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="عنوان مراسم جدید (مثال: یادبود شادروان حاج علی حسینی)"
              value={newEventTitle}
              onChange={e => setNewEventTitle(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowHostFields(!showHostFields)}
              className={`px-4 py-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                showHostFields || newHostUsername || newHostPassword
                  ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300'
                  : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <i className="fas fa-user-shield"></i>
              <span>{showHostFields ? 'بستن دسترسی صاحب عزا' : 'تعریف دسترسی صاحب عزا'}</span>
            </button>
            <button
              type="submit"
              disabled={loading || !newEventTitle.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-6 py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-xs md:text-sm whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              {loading ? <Spinner /> : <><i className="fas fa-plus"></i> تعریف و فعال‌سازی مراسم</>}
            </button>
          </div>

          {showHostFields && (
            <div className="p-4 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  نام کاربری صاحب عزا:
                </label>
                <input
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  placeholder="مثال: hoseini"
                  value={newHostUsername}
                  onChange={e => setNewHostUsername(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  رمز عبور صاحب عزا:
                </label>
                <input
                  type="text"
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                  placeholder="رمز عبور ورود صاحب عزا"
                  value={newHostPassword}
                  onChange={e => setNewHostPassword(e.target.value)}
                />
              </div>
              <p className="text-[11px] text-purple-700 dark:text-purple-300 col-span-full">
                صاحب عزا با این اطلاعات می‌تواند در صفحه اول وارد پنل اختصاصی خود شده و لیست خیرین را بدون مبالغ مشاهده و چاپ کند.
              </p>
            </div>
          )}
        </form>
      )}

      {/* Active Events List */}
      {activeTab === 'active_events' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 font-bold text-xs md:text-sm text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <span>لیست مراسم‌های فعال و در حال برگزاری</span>
            <span className="text-xs text-slate-400 font-normal">جهت تغییر مراسم سالن روی فعال‌سازی کلیک کنید</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {activeList.length === 0 ? (
              <div className="p-10 text-center text-slate-400 italic text-sm">هیچ مراسم فعالی وجود ندارد.</div>
            ) : (
              activeList.map(ev => {
                const isActive = ev.id === activeEventId || ev.isactive;
                const createdJalali = formatJalaliDateTime(ev.created_at);

                return (
                  <div
                    key={ev.id}
                    className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                      isActive ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-r-4 border-emerald-500' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex-1">
                      {editingEvent?.id === ev.id ? (
                        <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-indigo-200 dark:border-indigo-900">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                              عنوان مراسم:
                            </label>
                            <input
                              className="w-full border border-indigo-400 rounded-lg p-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                              value={editingEvent.title}
                              onChange={e => setEditingEvent({ ...editingEvent, title: e.target.value })}
                              autoFocus
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                نام کاربری صاحب عزا:
                              </label>
                              <input
                                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                                value={editingEvent.hostUsername}
                                onChange={e => setEditingEvent({ ...editingEvent, hostUsername: e.target.value })}
                                placeholder="نام کاربری صاحب عزا"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                رمز عبور صاحب عزا:
                              </label>
                              <input
                                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                                value={editingEvent.hostPassword}
                                onChange={e => setEditingEvent({ ...editingEvent, hostPassword: e.target.value })}
                                placeholder="رمز عبور صاحب عزا"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={handleUpdateEvent}
                              className="bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <i className="fas fa-check"></i> ذخیره تغییرات
                            </button>
                            <button
                              onClick={() => setEditingEvent(null)}
                              className="bg-slate-400 text-white px-3 py-2 rounded-lg text-xs font-bold cursor-pointer"
                            >
                              انصراف
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-slate-900 dark:text-white text-base">
                              {ev.title}
                            </h4>
                            {isActive && (
                              <span className="text-[10px] bg-emerald-600 text-white font-black px-2.5 py-0.5 rounded-full">
                                مراسم فعال سالن
                              </span>
                            )}
                            {selectedEventId === ev.id && (
                              <span className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-bold px-2 py-0.5 rounded-md">
                                درحال نمایش در جدول
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-4 flex-wrap">
                            <span><i className="far fa-calendar-alt ml-1"></i> تاریخ ایجاد: {createdJalali.full}</span>
                            {ev.hostUsername && (
                              <span className="text-purple-600 dark:text-purple-400 font-medium">
                                <i className="fas fa-user-shield ml-1"></i> پنل صاحب عزا: <b>{ev.hostUsername}</b>
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {editingEvent?.id !== ev.id && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => onSelectEvent(ev.id)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                            selectedEventId === ev.id
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                          }`}
                          title="مشاهده تراکنش‌های این مراسم در جدول"
                        >
                          <i className="fas fa-eye"></i> مشاهده تراکنش‌ها
                        </button>

                        {!isActive ? (
                          <button
                            onClick={() => handleActivateEvent(ev.id)}
                            disabled={actionIds[`act_${ev.id}`]}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                          >
                            {actionIds[`act_${ev.id}`] ? <Spinner size="w-3 h-3" /> : <><i className="fas fa-power-off"></i> فعال‌سازی سالن</>}
                          </button>
                        ) : (
                          <span className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 font-black px-3 py-2 rounded-xl flex items-center gap-1">
                            <i className="fas fa-check-double text-emerald-600"></i> فعال روی مانیتور
                          </span>
                        )}

                        <button
                          onClick={() => setEditingEvent({
                            id: ev.id,
                            title: ev.title,
                            hostUsername: ev.hostUsername || '',
                            hostPassword: ev.hostPassword || '',
                          })}
                          className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 p-2 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all cursor-pointer"
                          title="ویرایش مشخصات و دسترسی صاحب عزا"
                        >
                          <i className="fas fa-edit text-base"></i>
                        </button>

                        {/* Archive Button */}
                        <button
                          onClick={() => setArchiveTarget(ev)}
                          className="bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                          title="بایگانی مراسم و پاکسازی فایل‌های رسید"
                        >
                          <i className="fas fa-archive"></i> بایگانی مراسم
                        </button>

                        {!isActive && (
                          <button
                            onClick={() => handleDeleteEvent(ev.id, ev.title)}
                            disabled={actionIds[`del_${ev.id}`]}
                            className="text-red-500 hover:text-red-700 dark:hover:text-red-300 p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 transition-all cursor-pointer"
                            title="حذف کامل مراسم"
                          >
                            {actionIds[`del_${ev.id}`] ? <Spinner size="w-3 h-3" color="border-red-500" /> : <i className="fas fa-trash-alt text-base"></i>}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Archived Events List */}
      {activeTab === 'archived_events' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/60 font-bold text-xs md:text-sm text-amber-900 dark:text-amber-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <i className="fas fa-archive text-amber-600"></i>
              <span>بایگانی مراسم‌های به اتمام‌رسیده ({archivedList.length})</span>
            </div>
            <span className="text-[11px] text-amber-700 dark:text-amber-400 font-normal">
              فایل‌های پیوست پاک شده، ولی اطلاعات مالی و تراکنش‌ها کاملاً محفوظ است.
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {archivedList.length === 0 ? (
              <div className="p-10 text-center text-slate-400 italic text-sm">هیچ مراسم بایگانی‌شده‌ای وجود ندارد.</div>
            ) : (
              archivedList.map(ev => {
                const archivedJalali = formatJalaliDateTime(ev.archivedAt || ev.created_at);

                return (
                  <div
                    key={ev.id}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 text-base">
                          {ev.title}
                        </h4>
                        <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-black px-2.5 py-0.5 rounded-full">
                          بایگانی شده
                        </span>
                        {selectedEventId === ev.id && (
                          <span className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-bold px-2 py-0.5 rounded-md">
                            درحال نمایش در جدول
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-3">
                        <span><i className="fas fa-clock ml-1"></i> زمان بایگانی: {archivedJalali.full}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => onSelectEvent(ev.id)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          selectedEventId === ev.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                        title="مشاهده تراکنش‌های مالی این مراسم بایگانی شده"
                      >
                        <i className="fas fa-eye"></i> مشاهده گزارش تراکنش‌ها
                      </button>

                      <button
                        onClick={() => handleUnarchive(ev.id)}
                        disabled={actionIds[`unarch_${ev.id}`]}
                        className="bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                        title="خروج از بایگانی و بازگردانی به لیست مراسم‌های جاری"
                      >
                        {actionIds[`unarch_${ev.id}`] ? <Spinner size="w-3 h-3" /> : <><i className="fas fa-undo"></i> بازگردانی از بایگانی</>}
                      </button>

                      <button
                        onClick={() => handleDeleteEvent(ev.id, ev.title)}
                        disabled={actionIds[`del_${ev.id}`]}
                        className="text-red-500 hover:text-red-700 dark:hover:text-red-300 p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 transition-all cursor-pointer"
                        title="حذف کامل از سیستم"
                      >
                        {actionIds[`del_${ev.id}`] ? <Spinner size="w-3 h-3" color="border-red-500" /> : <i className="fas fa-trash-alt text-base"></i>}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Warning Dialog for Archiving */}
      {archiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-500">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-2xl flex-shrink-0">
                <i className="fas fa-exclamation-triangle"></i>
              </div>
              <div>
                <h3 className="font-black text-slate-900 dark:text-white text-lg">اخطار مهم: بایگانی مراسم</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">لطفاً موارد زیر را قبل از تایید با دقت مطالعه نمایید</p>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 text-xs text-amber-900 dark:text-amber-200 space-y-2.5 leading-relaxed">
              <p className="font-bold text-sm">
                آیا از بایگانی کردن مراسم «{archiveTarget.title}» اطمینان دارید؟
              </p>
              <div className="space-y-1.5 text-slate-700 dark:text-slate-300">
                <div className="flex items-start gap-2">
                  <i className="fas fa-check-circle text-emerald-500 mt-0.5"></i>
                  <span>کلیه اطلاعات مالی، مبالغ، نام خیرین، زمان‌ها و ثبت‌کنندگان <strong>به‌صورت دائمی حفظ خواهند شد</strong>.</span>
                </div>
                <div className="flex items-start gap-2">
                  <i className="fas fa-trash-alt text-red-500 mt-0.5"></i>
                  <span>فایل‌های پیوست (عکس‌های فیش و رسید واریزی) جهت صرفه‌جویی در حجم دیتابیس <strong>به‌طور کامل و غیرقابل‌بازگشت پاک می‌شوند</strong>.</span>
                </div>
                <div className="flex items-start gap-2">
                  <i className="fas fa-info-circle text-blue-500 mt-0.5"></i>
                  <span>این مراسم از لیست مراسم‌های فعال سالن خارج شده و در بخش بایگانی قرار می‌گیرد.</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setArchiveTarget(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={handleConfirmArchive}
                disabled={actionIds[`arch_${archiveTarget.id}`]}
                className="bg-amber-600 hover:bg-amber-700 text-white font-black px-5 py-2.5 rounded-xl text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer"
              >
                {actionIds[`arch_${archiveTarget.id}`] ? <Spinner size="w-3 h-3" /> : <><i className="fas fa-archive"></i> تایید و انتقال به بایگانی</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
