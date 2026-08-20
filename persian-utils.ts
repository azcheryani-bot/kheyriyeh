
// Helper utilities for Persian Date/Time and Number to Persian Words

export function formatJalaliDateTime(dateInput?: string | Date | null): { date: string; time: string; full: string } {
  if (!dateInput) return { date: '-', time: '-', full: '-' };
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return { date: '-', time: '-', full: '-' };

    const dateStr = d.toLocaleDateString('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const timeStr = d.toLocaleTimeString('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    return {
      date: dateStr,
      time: timeStr,
      full: `${dateStr} - ${timeStr}`,
    };
  } catch (e) {
    return { date: '-', time: '-', full: '-' };
  }
}

export function formatJalaliDate(dateInput?: string | Date | null): string {
  return formatJalaliDateTime(dateInput).date;
}

export function formatJalaliTime(dateInput?: string | Date | null): string {
  return formatJalaliDateTime(dateInput).time;
}

// Convert numbers into Persian words (عدد به حروف)
const units = ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'];
const teens = ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده'];
const tens = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'];
const hundreds = ['', 'یکصد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'];
const thousands = ['', 'هزار', 'میلیون', 'میلیارد', 'تریلیون'];

function convertThreeDigits(num: number): string {
  let result = '';
  const h = Math.floor(num / 100);
  const rem = num % 100;
  const t = Math.floor(rem / 10);
  const u = rem % 10;

  if (h > 0) {
    result += hundreds[h];
  }

  if (rem >= 10 && rem < 20) {
    if (result) result += ' و ';
    result += teens[rem - 10];
  } else {
    if (t > 0) {
      if (result) result += ' و ';
      result += tens[t];
    }
    if (u > 0) {
      if (result) result += ' و ';
      result += units[u];
    }
  }

  return result;
}

export function numberToPersianWords(num: number | string): string {
  const n = typeof num === 'string' ? parseInt(num, 10) : num;
  if (isNaN(n) || n === 0) return 'صفر';
  if (n < 0) return 'منفی ' + numberToPersianWords(Math.abs(n));

  let numStr = Math.floor(n).toString();
  const chunks: number[] = [];

  while (numStr.length > 0) {
    chunks.push(parseInt(numStr.slice(-3), 10));
    numStr = numStr.slice(0, -3);
  }

  const parts: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (chunk > 0) {
      const words = convertThreeDigits(chunk);
      const scale = thousands[i];
      parts.unshift(scale ? `${words} ${scale}` : words);
    }
  }

  return parts.join(' و ');
}
