import React from 'react';
import { Donation } from '../types';
import { formatJalaliDateTime, numberToPersianWords } from '../persian-utils';

interface ReceiptPrintModalProps {
  donation: Donation | null;
  eventTitle?: string;
  onClose: () => void;
}

export const ReceiptPrintModal: React.FC<ReceiptPrintModalProps> = ({
  donation,
  eventTitle,
  onClose
}) => {
  if (!donation) return null;

  const jalali = formatJalaliDateTime(donation.createdAt);
  const amountWords = numberToPersianWords(donation.amount || 0);
  const receiptCode = donation.id ? donation.id.slice(0, 8).toUpperCase() : '---';

  const paymentTypeLabel = {
    pos: 'دستگاه کارتخوان (POS)',
    cash: 'پرداخت نقدی',
    card: 'کارت به کارت',
    online: 'درگاه پرداخت آنلاین',
    card_cash: 'ترکیبی (کارت + نقدی)',
    mock: 'صوری',
    transfer: 'حواله بانکی / پایا'
  }[donation.paymentType] || donation.paymentType;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('لطفاً اجازه باز شدن پنجره پاپ‌آپ (Pop-up) را در مرورگر فعال کنید.');
      return;
    }

    const htmlContent = `
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>رسید پرداخت - ${donation.donorName}</title>
  <style>
    @page {
      size: 105mm 148mm; /* Standard A6 */
      margin: 5mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: Tahoma, 'Vazirmatn', Arial, sans-serif;
      font-size: 11px;
      color: #1e293b;
      background: #ffffff;
      padding: 4mm;
      width: 95mm;
      margin: 0 auto;
    }
    .receipt-box {
      border: 2px solid #0f172a;
      border-radius: 8px;
      padding: 8px;
      position: relative;
    }
    .inner-border {
      border: 1px dashed #64748b;
      border-radius: 6px;
      padding: 8px;
    }
    .header {
      text-align: center;
      border-bottom: 1.5px solid #0f172a;
      padding-bottom: 6px;
      margin-bottom: 8px;
    }
    .bismillah {
      font-size: 10px;
      color: #475569;
      margin-bottom: 2px;
    }
    .org-title {
      font-size: 13px;
      font-weight: bold;
      color: #0f172a;
    }
    .sub-title {
      font-size: 10px;
      font-weight: bold;
      color: #0369a1;
      margin-top: 2px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 9.5px;
      margin-top: 4px;
      color: #334155;
      background: #f8fafc;
      padding: 3px 6px;
      border-radius: 4px;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
      font-size: 10px;
    }
    .info-table tr {
      border-bottom: 1px solid #e2e8f0;
    }
    .info-table td {
      padding: 4px 2px;
      vertical-align: middle;
    }
    .info-table .label {
      width: 32%;
      color: #475569;
      font-weight: bold;
    }
    .info-table .value {
      width: 68%;
      color: #0f172a;
      font-weight: bold;
    }
    .amount-box {
      background: #f1f5f9;
      border: 1.5px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px;
      margin: 8px 0;
      text-align: center;
    }
    .amount-num {
      font-size: 14px;
      font-weight: bold;
      color: #047857;
      font-family: Tahoma, sans-serif;
    }
    .amount-words {
      font-size: 9.5px;
      color: #1e293b;
      margin-top: 2px;
      font-weight: bold;
    }
    .footer-signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 12px;
      padding-top: 6px;
      border-top: 1px solid #cbd5e1;
      font-size: 9px;
      color: #475569;
      text-align: center;
    }
    .sig-box {
      width: 48%;
      padding-top: 24px;
      border-bottom: 1px dotted #94a3b8;
    }
    .hadith {
      text-align: center;
      font-size: 8.5px;
      color: #64748b;
      margin-top: 8px;
      font-style: italic;
    }
    @media print {
      body {
        padding: 0;
        margin: 0;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="receipt-box">
    <div class="inner-border">
      <div class="header">
        <div class="bismillah">بسم الله الرحمن الرحیم</div>
        <div class="org-title">مرکز نیکوکاری حضرت ابالفضل (ع)</div>
        <div class="sub-title">قبض رسید دریافت نذورات و مبالغ خیریه (قطع A6)</div>
        <div class="meta-row">
          <span><strong>شماره رسید:</strong> ${receiptCode}</span>
          <span><strong>تاریخ:</strong> ${jalali.date}</span>
          <span><strong>ساعت:</strong> ${jalali.time}</span>
        </div>
      </div>

      <table class="info-table">
        <tr>
          <td class="label">عنوان مراسم:</td>
          <td class="value">${eventTitle || 'مراسم عمومی'}</td>
        </tr>
        <tr>
          <td class="label">نام نیکوکار:</td>
          <td class="value">${donation.donorName}</td>
        </tr>
        <tr>
          <td class="label">نام پدر:</td>
          <td class="value">${donation.fatherName || '-'}</td>
        </tr>
        <tr>
          <td class="label">شماره همراه:</td>
          <td class="value" dir="ltr" style="text-align: right;">${donation.mobile || '-'}</td>
        </tr>
        <tr>
          <td class="label">روش پرداخت:</td>
          <td class="value">${paymentTypeLabel}</td>
        </tr>
        <tr>
          <td class="label">مدیر ثبت‌کننده:</td>
          <td class="value">${donation.registeredBy || 'مدیریت سامانه'}</td>
        </tr>
        ${donation.description ? `
        <tr>
          <td class="label">توضیحات:</td>
          <td class="value">${donation.description}</td>
        </tr>
        ` : ''}
      </table>

      <div class="amount-box">
        <div style="font-size: 9px; color: #64748b; margin-bottom: 2px;">مبلغ دریافتی:</div>
        <div class="amount-num">${(donation.amount || 0).toLocaleString()} تومان</div>
        <div class="amount-words">(${amountWords} تومان)</div>
      </div>

      <div class="footer-signatures">
        <div>
          <div>مهر و امضای متصدی</div>
          <div class="sig-box"></div>
        </div>
        <div>
          <div>امضای پرداخت‌کننده</div>
          <div class="sig-box"></div>
        </div>
      </div>

      <div class="hadith">
        «اجرکم عندالله - شادی روح اموات و درگذشتگان صلوات»
      </div>
    </div>
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        window.close();
      }, 250);
    };
  </script>
</body>
</html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden transition-all my-8">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-yellow-500 text-slate-950 rounded-xl flex items-center justify-center font-bold">
              <i className="fas fa-receipt"></i>
            </div>
            <div>
              <h3 className="font-black text-sm text-yellow-400">پیش‌نمایش قبض رسید تراکنش</h3>
              <p className="text-[11px] text-slate-400">قطع استاندارد A6 (105 × 148 میلی‌متر)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <i className="fas fa-times text-lg"></i>
          </button>
        </div>

        {/* Printable Card Preview */}
        <div className="p-5 overflow-y-auto max-h-[70vh]">
          <div className="border-2 border-slate-800 dark:border-slate-700 rounded-2xl p-4 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-inner">
            <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 space-y-3">
              {/* Header Box */}
              <div className="text-center pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mb-0.5">بسم الله الرحمن الرحیم</div>
                <h4 className="font-black text-slate-900 dark:text-white text-sm">مرکز نیکوکاری حضرت ابالفضل (ع)</h4>
                <div className="text-[11px] text-blue-600 dark:text-blue-400 font-bold mt-0.5">قبض رسید دریافت نذورات و مبالغ خیریه</div>
                <div className="flex justify-between items-center bg-white dark:bg-slate-900 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] text-slate-600 dark:text-slate-400 font-medium mt-2">
                  <span>کد رسید: <strong className="text-slate-800 dark:text-slate-200">{receiptCode}</strong></span>
                  <span>{jalali.date} - {jalali.time}</span>
                </div>
              </div>

              {/* Rows */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-800/60">
                  <span className="text-slate-500 dark:text-slate-400">مراسم:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{eventTitle || 'مراسم عمومی'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-800/60">
                  <span className="text-slate-500 dark:text-slate-400">نام خیر:</span>
                  <span className="font-black text-slate-900 dark:text-white">{donation.donorName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-800/60">
                  <span className="text-slate-500 dark:text-slate-400">نام پدر:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{donation.fatherName || '-'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-800/60">
                  <span className="text-slate-500 dark:text-slate-400">شماره همراه:</span>
                  <span className="font-mono font-medium text-slate-700 dark:text-slate-300" dir="ltr">{donation.mobile || '-'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-800/60">
                  <span className="text-slate-500 dark:text-slate-400">نوع پرداخت:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{paymentTypeLabel}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-800/60">
                  <span className="text-slate-500 dark:text-slate-400">مدیر ثبت‌کننده:</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{donation.registeredBy || 'مدیریت سامانه'}</span>
                </div>
                {donation.description && (
                  <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-800/60">
                    <span className="text-slate-500 dark:text-slate-400">توضیحات:</span>
                    <span className="text-slate-700 dark:text-slate-300 max-w-[200px] text-left">{donation.description}</span>
                  </div>
                )}
              </div>

              {/* Amount Box */}
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-3 text-center space-y-1">
                <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">مبلغ پرداختی:</div>
                <div className="text-lg font-black text-emerald-800 dark:text-emerald-300 font-mono">
                  {(donation.amount || 0).toLocaleString()} تومان
                </div>
                <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  ({amountWords} تومان)
                </div>
              </div>

              {/* Signature section */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between text-[10px] text-slate-500 dark:text-slate-400 text-center">
                <div>
                  <div>مهر و امضای امور مالی</div>
                  <div className="w-24 h-8 border-b border-dotted border-slate-400 mt-1"></div>
                </div>
                <div>
                  <div>امضای پرداخت‌کننده</div>
                  <div className="w-24 h-8 border-b border-dotted border-slate-400 mt-1"></div>
                </div>
              </div>

              <div className="text-center text-[9px] text-slate-400 dark:text-slate-500 italic pt-1">
                «شادی روح درگذشتگان صلوات - اجرکم عندالله»
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-bold transition-all cursor-pointer"
          >
            بستن
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-black shadow-md shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            <i className="fas fa-print"></i>
            <span>چاپ رسید در قطع A6</span>
          </button>
        </div>
      </div>
    </div>
  );
};
