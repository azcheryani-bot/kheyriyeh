
import express from 'express';
import cors from 'cors';
import { apiRouter } from './api.js';
import path from 'path';

const app = express();
app.use(cors());

// Configure high body limit for base64 image uploads, Excel imports, and large data payloads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use((req, res, next) => {
  if (req.body !== undefined) {
    return next();
  }
  express.json({ limit: '50mb' })(req, res, (err) => {
    if (err) return next(err);
    express.urlencoded({ limit: '50mb', extended: true })(req, res, next);
  });
});

app.get('/display', (req, res) => {
  res.sendFile(path.resolve('public/display.html'));
});

import { checkIpViaProxy } from './niazpardaz-api.js';
import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';

const socksAgent = new SocksProxyAgent('socks://127.0.0.1:1080');

import { db } from './db/index.js';
import { config as dbConfig } from './db/schema.js';
import { eq } from 'drizzle-orm';

async function getSmsBridgeUrl() {
  const result = await db.select().from(dbConfig).where(eq(dbConfig.key, 'sms_bridge_url'));
  return result.length > 0 ? (result[0].value as any)?.url : null;
}

// Unified HTTP Request through SOCKS5 proxy with fallback to direct connection
async function sendSmsHttpRequest(config: {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  data?: any;
  params?: any;
  timeoutMs?: number;
}): Promise<{ status: number; ok: boolean; data: any; text: string }> {
  const timeout = config.timeoutMs || 25000;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ...config.headers
  };

  const bridgeUrl = await getSmsBridgeUrl();

  // Route via SMS Bridge if available
  if (bridgeUrl && typeof bridgeUrl === 'string') {
    try {
      // Create request payload to the bridge
      const res = await axios({
        url: bridgeUrl,
        method: config.method || 'GET',
        headers: {
          'x-target-url': config.url,
          'content-type': headers['Content-Type'] || 'application/json',
          'accept': headers['Accept'] || '*/*',
          'soapaction': headers['SOAPAction'] || ''
        },
        data: config.data,
        timeout,
        validateStatus: () => true,
        responseType: 'text',
        transformResponse: [(data) => data]
      });
      const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      let parsedJson = null;
      try { parsedJson = JSON.parse(text); } catch {}
      
      // Some cloudflare tunnel errors return 502/503. If the tunnel is down, fail fast.
      if (res.status === 502 || res.status === 503 || res.status === 404 || res.status === 530) {
          throw new Error(`خطای کلودفلر از سرور پیامک: ${res.status}. سرور احتمالاً خاموش شده است.`);
      }

      return { status: res.status, ok: res.status >= 200 && res.status < 300, data: parsedJson, text };
    } catch (err: any) {
       console.error("Bridge Error:", err.message);
       throw new Error(`خطا در ارتباط با سرور پیامک گیت‌هاب (پراکسی). لطفاً سرور پیامک را دوباره روشن کنید. جزئیات: ${err.message}`);
    }
  }

  // Fallback direct request (will likely fail on Cloudflare workers with 403)
  throw new Error('سرور پیامک گیت‌هاب روشن نشده است. لطفاً ابتدا سرور واسط پیامک را در تنظیمات روشن کنید.');
}

app.get('/api/test-ip', async (req, res) => {
  try {
    const ip = await checkIpViaProxy();
    res.json({ success: true, proxyIp: ip, expected: '129.146.143.80' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.use('/api/db', apiRouter);

// --- Niazpardaz (نیازپرداز) SMS Router & Handlers ---

async function callNiazpardazDirectSend(payload: { username: string; password: string; from: string; to: string; text: string }, timeoutMs = 15000): Promise<{ success: boolean; batchId?: number; code?: number; error?: string } | null> {
  const query = new URLSearchParams({
    username: payload.username,
    password: payload.password,
    from: payload.from || 'SimCard',
    to: payload.to,
    text: payload.text
  }).toString();

  const endpoints = [
    `https://login.niazpardaz.ir/SMSInOutBox/SendSms?${query}`,
    `https://login.niazpardaz.ir/SMSInOutBox/Send?${query}`,
    `https://panel.niazpardaz-sms.com/SMSInOutBox/SendSms?${query}`,
    `https://login.niazpardaz.com/SMSInOutBox/SendSms?${query}`,
    `http://login.niazpardaz.ir/SMSInOutBox/SendSms?${query}`
  ];

  for (const epUrl of endpoints) {
    try {
      const res = await sendSmsHttpRequest({
        url: epUrl,
        method: 'GET',
        timeoutMs
      });
      if (res.ok && res.text) {
        const text = res.text.trim();
        if (
          text.includes('SendWasSuccessful') ||
          text.includes('درخواست کاملا تکراری') ||
          text.includes('Successful')
        ) {
          return { success: true, batchId: 1 };
        }
        const num = parseInt(text, 10);
        if (!isNaN(num)) {
          if (num > 15 || num === 0 || num === 1) {
            return { success: true, batchId: num > 0 ? num : 1 };
          } else if (num < 0) {
            return { success: false, code: num, error: parseNiazpardazError(num) };
          }
        }
        if (text && !text.includes('<!DOCTYPE') && !text.includes('<html>')) {
          return { success: false, error: text };
        }
      }
    } catch {}
  }
  return null;
}

async function callNiazpardazDirectCredit(payload: { username: string; password: string }, timeoutMs = 15000): Promise<{ success: boolean; credit?: number; error?: string } | null> {
  const query = new URLSearchParams({
    username: payload.username,
    password: payload.password
  }).toString();

  const endpoints = [
    `https://login.niazpardaz.ir/SMSInOutBox/Credit?${query}`,
    `https://panel.niazpardaz-sms.com/SMSInOutBox/Credit?${query}`,
    `https://login.niazpardaz.com/SMSInOutBox/Credit?${query}`
  ];

  for (const epUrl of endpoints) {
    try {
      const res = await sendSmsHttpRequest({
        url: epUrl,
        method: 'GET',
        timeoutMs
      });
      if (res.ok && res.text) {
        const text = res.text.trim();
        const num = parseFloat(text);
        if (!isNaN(num) && num >= 0) {
          return { success: true, credit: num };
        } else if (!isNaN(num) && num < 0) {
          return { success: false, error: parseNiazpardazError(num) };
        }
      }
    } catch {}
  }
  return null;
}

async function callPayamakRestApi(action: string, payload: any, timeoutMs = 15000): Promise<any> {
  const actionsToTry = [action];
  if (action === 'GetSenderNumbers') actionsToTry.push('GetSenders');
  if (action === 'GetSenders') actionsToTry.push('GetSenderNumbers');

  const hosts = [
    'https://in.payamak-service.ir/api/v2/RestWebApi',
    'https://payamak-service.ir/api/v2/RestWebApi',
    'http://in.payamak-service.ir/api/v2/RestWebApi',
    'http://payamak-service.ir/api/v2/RestWebApi'
  ];

  const bodyStr = JSON.stringify(payload);

  for (const act of actionsToTry) {
    for (const host of hosts) {
      const epUrl = `${host}/${act}`;
      try {
        const res = await sendSmsHttpRequest({
          url: epUrl,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          data: bodyStr,
          timeoutMs
        });
        if (res.data && typeof res.data === 'object') {
          return res.data;
        }
      } catch {}
    }
  }
  return null;
}

async function callPayamakPanelApi(payload: { UserName: string; Password: string; From: string; To: string; Message: string }, timeoutMs = 15000): Promise<{ success: boolean; batchId?: number; code?: number; error?: string }> {
  try {
    const res = await sendSmsHttpRequest({
      url: 'https://panel.niazpardaz-sms.com/SMSInOutBox/Send',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify(payload),
      timeoutMs
    });
    if (res.ok && res.text) {
      const text = res.text.trim();
      const num = parseInt(text, 10);
      if (!isNaN(num)) {
        if (num > 100) {
          return { success: true, batchId: num > 0 ? num : 1 };
        } else {
          return { success: false, code: num, error: parseNiazpardazError(num) };
        }
      } else if (text) {
        return { success: false, error: text };
      }
    }
  } catch {}

  // Try GET method fallback
  try {
    const u = new URL('https://panel.niazpardaz-sms.com/SMSInOutBox/SendSms');
    u.searchParams.set('username', payload.UserName);
    u.searchParams.set('password', payload.Password);
    u.searchParams.set('from', payload.From);
    u.searchParams.set('to', payload.To);
    u.searchParams.set('text', payload.Message);

    const res = await sendSmsHttpRequest({
      url: u.toString(),
      method: 'GET',
      timeoutMs
    });
    if (res.ok && res.text) {
      const text = res.text.trim();
      const num = parseInt(text, 10);
      if (!isNaN(num)) {
        if (num > 100 || num === 0) {
          return { success: true, batchId: num > 0 ? num : 1 };
        } else {
          return { success: false, code: num, error: parseNiazpardazError(num) };
        }
      } else if (text) {
        if (text.includes('موفق') || text.includes('ارسال شد')) {
          return { success: true, batchId: 1 };
        }
        return { success: false, error: text };
      }
    }
  } catch {}

  return { success: false, error: 'عدم پاسخگویی سرور پیامک نیازپرداز' };
}

async function callPayamakSoap(soapAction: string, xmlBody: string, timeoutMs = 15000): Promise<string> {
  const endpoints = [
    'https://payamak-service.ir/SendService.svc',
    'https://www.payamak-service.ir/SendService.svc',
    'http://payamak-service.ir/SendService.svc',
    'http://www.payamak-service.ir/SendService.svc',
    'http://185.49.84.2/SendService.svc'
  ];

  let lastError: any = null;

  for (const epUrl of endpoints) {
    try {
      const res = await sendSmsHttpRequest({
        url: epUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': `"${soapAction}"`,
          'Accept': 'text/xml, application/xml, */*'
        },
        data: xmlBody,
        timeoutMs
      });

      if (res.text && (res.ok || res.text.includes('Envelope') || res.text.includes('Result') || res.text.includes('Fault'))) {
        return res.text;
      }
      lastError = new Error(`پاسخ غیرمنتظره (${res.status}): ${res.text?.substring(0, 100) || ''}`);
    } catch (err: any) {
      lastError = err;
    }
  }

  throw lastError || new Error('ارتباط با سرورهای پیامک نیازپرداز ناموفق بود.');
}

function escapeXml(str: any): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function parseNiazpardazError(code: number): string {
  switch (code) {
    case -20: return 'بعلت وارد کردن رمز اشتباه پنل مسدود شده است.';
    case -1: return 'نام کاربری یا کلمه عبور صحیح نمی‌باشد.';
    case 0: return 'عملیات با موفقیت انجام شد.';
    case 1: return 'نام کاربری یا رمز عبور پنل پیامک نامعتبر است.';
    case 2: return 'حساب کاربری در سامانه پیامک مسدود شده است.';
    case 3: return 'شماره فرستنده (خط اختصاصی) نامعتبر است.';
    case 4: return 'محدودیت تعداد ارسال روزانه پیامک به پایان رسیده است.';
    case 5: return 'تعداد گیرندگان حداکثر ۱۰۰ شماره در هر فراخوانی می‌باشد.';
    case 6: return 'خط فرستنده پیامک غیرفعال است.';
    case 7: return 'متن پیامک شامل کلمات فیلتر شده یا غیرمجاز است.';
    case 8: return 'اعتبار ریالی/تعدادی پنل پیامک کافی نیست.';
    case 9: return 'سامانه پیامک در حال بروزرسانی می‌باشد.';
    case 10: return 'وب‌سرویس پیامک غیرفعال است.';
    case 11: return 'سرویس پیاده‌سازی نشده است.';
    case 12: return 'تعداد پیام‌ها و شماره‌ها مطابقت ندارد.';
    case 13: return 'تعداد پیام‌ها حداکثر ۱۰۰ عدد می‌باشد.';
    case 14: return 'تعرفه جاری برای حساب کاربر تعریف نشده است.';
    case 15: return 'ارسال تکراری متن مشابه به شماره مشابه در بازه زمانی کوتاه.';
    case 16: return 'شماره موبایل گیرنده یافت نشد یا در لیست سیاه تبلیغاتی است.';
    case 17: return 'متن پیامک وارد نشده است.';
    case 18: return 'مغایرت متن پیامک با قالب/پترن تایید شده.';
    case 19: return 'تاریخ انقضای حساب کاربری به پایان رسیده است.';
    case 20: return 'وضعیت حساب کاربری فعال نیست.';
    case 21: return 'مقدار یکی یا چند پارامتر ورودی معتبر نیست.';
    case 22: return 'آی‌پی درخواست‌کننده موقتاً مسدود شده است.';
    case 23: return 'عملیات با خطا مواجه شد. لطفاً دقایقی دیگر تلاش کنید.';
    case 24: return 'درخواست تکراری در بازه زمانی بسیار کوتاه.';
    case 25: return 'کلید API نامعتبر است.';
    default: return `خطای کد ${code} در سامانه پیامک نیازپرداز.`;
  }
}

function cleanPhoneNumber(phone: any): string {
  let str = String(phone || '').trim();
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  for (let i = 0; i < 10; i++) {
    str = str.replace(new RegExp(persianDigits[i], 'g'), String(i));
    str = str.replace(new RegExp(arabicDigits[i], 'g'), String(i));
  }
  let clean = str.replace(/\s+/g, '').replace(/[^\d+]/g, '');
  if (clean.startsWith('+98')) {
    clean = '0' + clean.substring(3);
  } else if (clean.startsWith('98') && (clean.length === 12 || clean.length === 11)) {
    clean = '0' + clean.substring(2);
  } else if (clean.length === 10 && clean.startsWith('9')) {
    clean = '0' + clean;
  }
  return clean;
}

const smsRouter = express.Router();

smsRouter.post('/send', async (req, res) => {
  try {
    const body = req.body || {};
    const username = String(body.username || '').trim();
    const password = String(body.password || '').trim();
    const from = String(body.from || '').trim();
    const text = String(body.text || '').trim();
    const toRaw = body.to;
    
    if (!username || !password || !toRaw || !text) {
      return res.status(400).json({
        success: false,
        error: 'اطلاعات کامل نیست. نام کاربری، رمز عبور، شماره گیرنده و متن پیامک الزامی است.'
      });
    }

    let toNumbersList: string[] = [];
    if (Array.isArray(toRaw)) {
      toNumbersList = toRaw.map(n => cleanPhoneNumber(n)).filter(n => n.length >= 10);
    } else {
      toNumbersList = String(toRaw).split(/[,;\n]+/).map(n => cleanPhoneNumber(n)).filter(n => n.length >= 10);
    }

    toNumbersList = Array.from(new Set(toNumbersList));

    if (toNumbersList.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'شماره گیرنده معتبر نیست.'
      });
    }

    const fromNumber = from || '50004001925348';
    let collectedErrors: string[] = [];

    // 1. Primary Method: Niazpardaz Direct URL API
    const niazDirectRes = await callNiazpardazDirectSend({
      username,
      password,
      from: fromNumber,
      to: toNumbersList.join(','),
      text
    });
    if (niazDirectRes?.success) {
      return res.json({
        success: true,
        batchId: niazDirectRes.batchId || 1,
        message: 'پیامک با موفقیت از طریق سامانه نیازپرداز ارسال شد.'
      });
    } else if (niazDirectRes?.error) {
      collectedErrors.push(`Niazpardaz Direct: ${niazDirectRes.error}`);
    }

    // 2. Method: Niazpardaz REST Web API V2 (payamak-service.ir)
    const restRes = await callPayamakRestApi('SendBatchSms', {
      userName: username,
      password: password,
      fromNumber: fromNumber,
      toNumbers: toNumbersList.join(','),
      messageContent: text,
      isFlash: false,
      sendDelay: 0
    });

    if (restRes) {
      const resultCode = restRes.result?.resultCode ?? restRes.resultCode;
      const batchId = restRes.result?.batchSmsId ?? restRes.batchSmsId ?? 0;

      if ((typeof resultCode === 'number' && resultCode === 0) || (restRes.success === true && batchId > 0)) {
        return res.json({
          success: true,
          batchId: batchId > 0 ? batchId : 1,
          message: 'پیامک با موفقیت به صف ارسال نیازپرداز تحویل داده شد.'
        });
      }

      if (typeof resultCode === 'number' && resultCode !== -1) {
        collectedErrors.push(`Niazpardaz REST: ${restRes.errorMessage || parseNiazpardazError(resultCode)}`);
      } else if (restRes.errorMessage) {
        collectedErrors.push(`Niazpardaz REST: ${restRes.errorMessage}`);
      }
    }

    // 3. Method: Niazpardaz Panel Web API
    const panelRes = await callPayamakPanelApi({
      UserName: username,
      Password: password,
      From: fromNumber,
      To: toNumbersList.join(','),
      Message: text
    });

    if (panelRes.success) {
      return res.json({
        success: true,
        batchId: panelRes.batchId || 1,
        message: 'پیامک با موفقیت به مخاطب ارسال شد.'
      });
    }

    if (panelRes.error && panelRes.error !== 'عدم پاسخگویی سرور پیامک نیازپرداز') {
      collectedErrors.push(`Niazpardaz Panel: ${panelRes.error}`);
    }

    // 4. Method: Niazpardaz SOAP WCF Service
    const xmlBatch = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <SendBatchSms xmlns="http://tempuri.org/">
      <userName>${escapeXml(username)}</userName>
      <password>${escapeXml(password)}</password>
      <fromNumber>${escapeXml(fromNumber)}</fromNumber>
      <toNumbers xmlns:a="http://schemas.microsoft.com/2003/10/Serialization/Arrays">
        ${toNumbersList.map(num => `<a:string>${escapeXml(num)}</a:string>`).join('')}
      </toNumbers>
      <messageContent>${escapeXml(text)}</messageContent>
      <isFlash>false</isFlash>
    </SendBatchSms>
  </soap:Body>
</soap:Envelope>`;

    try {
      const data = await callPayamakSoap('http://tempuri.org/ISendService/SendBatchSms', xmlBatch, 20000);
      
      const resultMatch = data.match(/<(?:[^:]+:)?SendBatchSmsResult[^>]*>([-\d]+)<\/(?:[^:]+:)?SendBatchSmsResult>/i);
      const idMatch = data.match(/<(?:[^:]+:)?batchSmsId[^>]*>([-\d]+)<\/(?:[^:]+:)?batchSmsId>/i);
      
      const resultCode = resultMatch ? parseInt(resultMatch[1], 10) : -1;
      const batchId = idMatch ? parseInt(idMatch[1], 10) : 0;
      
      if (resultCode === 0) {
        return res.json({
          success: true,
          batchId: batchId > 0 ? batchId : 1,
          message: 'پیامک با موفقیت به صف ارسال نیازپرداز تحویل داده شد.'
        });
      }

      collectedErrors.push(`SOAP: ${parseNiazpardazError(resultCode)}`);
    } catch (err: any) {
      collectedErrors.push(`SOAP Error: ${err.message || 'خطا در ارتباط'}`);
    }

    const finalErrMsg = collectedErrors.length > 0
      ? collectedErrors.filter(e => !e.includes('UserNameAndPasswordFailed') && !e.includes('عدم پاسخگویی')).join(' | ') || collectedErrors[0]
      : 'ارتباط با سرورهای پیامک نیازپرداز برقرار نشد.';

    return res.json({
      success: false,
      code: -1,
      error: finalErrMsg
    });
  } catch (error: any) {
    console.error('SMS Send Exception:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

smsRouter.post('/credit', async (req, res) => {
  try {
    const body = req.body || {};
    const username = String(body.username || '').trim();
    const password = String(body.password || '').trim();
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'نام کاربری و رمز عبور الزامی است.' });
    }

    // 1. Primary Method: Niazpardaz Direct GET
    const niazCred = await callNiazpardazDirectCredit({ username, password });
    if (niazCred?.success && typeof niazCred.credit === 'number') {
      return res.json({ success: true, credit: niazCred.credit, gateway: 'Niazpardaz' });
    } else if (niazCred?.error) {
      return res.json({ success: false, error: niazCred.error });
    }

    // 2. Method: Niazpardaz REST Web API V2
    const restRes = await callPayamakRestApi('GetCredit', {
      userName: username,
      password: password
    });
    if (restRes) {
      const creditVal = restRes.result?.credit ?? restRes.credit;
      const c = parseFloat(creditVal);
      if (!isNaN(c)) {
        return res.json({ success: true, credit: c, raw: restRes, gateway: 'Niazpardaz' });
      }
      if (restRes.errorMessage) {
        return res.json({ success: false, error: restRes.errorMessage, raw: restRes });
      }
    }

    // 3. Fallback: Niazpardaz SOAP WCF Service
    const xml = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">  <soap:Body>    <GetCredit xmlns="http://tempuri.org/">      <userName>${escapeXml(username)}</userName>      <password>${escapeXml(password)}</password>    </GetCredit>  </soap:Body></soap:Envelope>`;
    const data = await callPayamakSoap('http://tempuri.org/ISendService/GetCredit', xml, 20000);
    
    const creditMatch = data.match(/<(?:[^:]+:)?GetCreditResult>([-\d\.]+)<\/(?:[^:]+:)?GetCreditResult>/i);
    if (creditMatch) {
      const creditVal = parseFloat(creditMatch[1]);
      if (creditVal === -1) {
        return res.json({ success: false, error: 'نام کاربری یا رمز عبور پنل پیامک نیازپرداز صحیح نمی‌باشد.', rawSoap: data });
      }
      if (creditVal === -2) {
        return res.json({ success: false, error: 'حساب کاربری پیامک در سامانه غیرفعال است.', rawSoap: data });
      }
      if (creditVal < 0) {
        return res.json({ success: false, error: parseNiazpardazError(Math.abs(creditVal)), rawSoap: data });
      }
      return res.json({ success: true, credit: creditVal, rawSoap: data, gateway: 'Niazpardaz' });
    }
    
    res.json({ success: false, error: 'پاسخ نامعتبر از سرور پیامک نیازپرداز', rawSoap: data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'خطا در دریافت اعتبار' });
  }
});

smsRouter.post('/senders', async (req, res) => {
  try {
    const body = req.body || {};
    const username = String(body.username || '').trim();
    const password = String(body.password || '').trim();
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'نام کاربری و رمز عبور الزامی است.' });
    }

    // 1. Try Niazpardaz REST Web API V2
    const restRes = await callPayamakRestApi('GetSenderNumbers', {
      userName: username,
      password: password
    });
    if (restRes) {
      const senders = restRes.result?.senders ?? restRes.senders;
      if (Array.isArray(senders) && senders.length > 0) {
        return res.json({ success: true, numbers: senders });
      }
      if (restRes.errorMessage) {
        return res.json({ success: false, error: restRes.errorMessage });
      }
    }

    // 2. Fallback: Niazpardaz SOAP WCF Service
    const xml = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">  <soap:Body>    <GetSenderNumbers xmlns="http://tempuri.org/">      <userName>${escapeXml(username)}</userName>      <password>${escapeXml(password)}</password>    </GetSenderNumbers>  </soap:Body></soap:Envelope>`;
    const data = await callPayamakSoap('http://tempuri.org/ISendService/GetSenderNumbers', xml, 20000);
    
    if (data.includes('GetSenderNumbersResult>-1') || data.includes('GetSenderNumbersResult&gt;-1')) {
      return res.json({ success: false, error: 'نام کاربری یا رمز عبور پنل پیامک نیازپرداز نادرست است.' });
    }
    const senderMatches = data.match(/<(?:[^:]+:)?string[^>]*>(.*?)<\/(?:[^:]+:)?string>/gi) || [];
    const numbers = senderMatches.map((m: string) => m.replace(/<[^>]+>/g, '').trim()).filter((n: string) => n.length > 0);
    if (numbers.length > 0) {
      res.json({ success: true, numbers });
    } else {
      res.json({ success: false, error: 'هیچ خط فرستنده‌ای برای این حساب یافت نشد.' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'خطا در دریافت لیست شماره‌ها' });
  }
});

smsRouter.post('/check-blacklist', async (req, res) => {
  try {
    const body = req.body || {};
    const username = String(body.username || '').trim();
    const password = String(body.password || '').trim();
    const mobile = body.mobile;
    if (!username || !password || !mobile) {
      return res.status(400).json({ success: false, error: 'اطلاعات کامل نیست.' });
    }

    const cleanMobile = cleanPhoneNumber(mobile);

    // 1. Try REST Web API V2
    const restRes = await callPayamakRestApi('NumberIsInTelecomBlacklist', {
      userName: username,
      password: password,
      number: cleanMobile
    });

    if (restRes) {
      const isBlack = restRes.result?.isBlack ?? restRes.isBlack;
      if (typeof isBlack === 'boolean' || restRes.success === true) {
        const isBlacklisted = !!isBlack;
        return res.json({
          success: true,
          isBlacklisted,
          message: isBlacklisted
            ? '⚠️ این شماره در لیست سیاه مخابرات قرار دارد (دریافت پیامک‌های تبلیغاتی را مسدود کرده است).'
            : '✔ این شماره در لیست سیاه مخابرات نیست و پیامک دریافت می‌کند.'
        });
      }
      if (restRes.errorMessage) {
        return res.json({ success: false, error: restRes.errorMessage });
      }
    }

    // 2. Fallback: SOAP WCF
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <NumberIsInTelecomBlacklist xmlns="http://tempuri.org/">
      <userName>${escapeXml(username)}</userName>
      <password>${escapeXml(password)}</password>
      <number>${escapeXml(cleanMobile)}</number>
    </NumberIsInTelecomBlacklist>
  </soap:Body>
</soap:Envelope>`;

    const data = await callPayamakSoap('http://tempuri.org/ISendService/NumberIsInTelecomBlacklist', xml, 20000);

    if (data.includes('NumberIsInTelecomBlacklistResult>-1')) {
      return res.json({ success: false, error: 'نام کاربری یا رمز عبور پنل پیامک نادرست است.' });
    }

    const match = data.match(/<(?:[^:]+:)?NumberIsInTelecomBlacklistResult[^>]*>(true|false)<\/(?:[^:]+:)?NumberIsInTelecomBlacklistResult>/i);
    if (match) {
      const isBlacklisted = match[1].toLowerCase() === 'true';
      return res.json({
        success: true,
        isBlacklisted,
        message: isBlacklisted
          ? '⚠️ این شماره در لیست سیاه مخابرات قرار دارد (دریافت پیامک‌های تبلیغاتی را مسدود کرده است).'
          : '✔ این شماره در لیست سیاه مخابرات نیست و پیامک دریافت می‌کند.'
      });
    }
    res.json({ success: false, error: 'پاسخ معتبری از سامانه استعلام دریافت نشد.' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

smsRouter.post('/check-content', async (req, res) => {
  try {
    const body = req.body || {};
    const username = String(body.username || '').trim();
    const password = String(body.password || '').trim();
    const content = body.content;
    if (!username || !password || !content) {
      return res.status(400).json({ success: false, error: 'اطلاعات کامل نیست.' });
    }

    // 1. Try REST Web API V2
    const restRes = await callPayamakRestApi('CheckSmsContent', {
      userName: username,
      password: password,
      message: content
    });

    if (restRes) {
      const isValid = restRes.result?.isValid ?? restRes.isValid;
      if (typeof isValid === 'boolean' || restRes.success === true) {
        const isClean = !!isValid;
        return res.json({
          success: true,
          isClean,
          message: isClean
            ? '✔ متن پیامک مجاز است و هیچ کلمه فیلترشده‌ای ندارد.'
            : '⚠️ متن پیامک حاوی کلمات مسدود یا فیلترشده است!'
        });
      }
      if (restRes.errorMessage) {
        return res.json({ success: false, error: restRes.errorMessage });
      }
    }

    // 2. Fallback: SOAP WCF
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <CheckSmsContent xmlns="http://tempuri.org/">
      <userName>${escapeXml(username)}</userName>
      <password>${escapeXml(password)}</password>
      <message>${escapeXml(content)}</message>
    </CheckSmsContent>
  </soap:Body>
</soap:Envelope>`;

    const data = await callPayamakSoap('http://tempuri.org/ISendService/CheckSmsContent', xml, 20000);

    if (data.includes('CheckSmsContentResult>-1')) {
      return res.json({ success: false, error: 'نام کاربری یا رمز عبور پنل پیامک نادرست است.' });
    }

    const match = data.match(/<(?:[^:]+:)?CheckSmsContentResult[^>]*>(true|false)<\/(?:[^:]+:)?CheckSmsContentResult>/i);
    if (match) {
      const isClean = match[1].toLowerCase() === 'true';
      return res.json({
        success: true,
        isClean,
        message: isClean
          ? '✔ متن پیامک مجاز است و هیچ کلمه فیلترشده‌ای ندارد.'
          : '⚠️ متن پیامک حاوی کلمات مسدود یا فیلترشده است!'
      });
    }
    res.json({ success: false, error: 'خطا در بررسی متن پیامک' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

smsRouter.post('/status', async (req, res) => {
  try {
    const body = req.body || {};
    const username = String(body.username || '').trim();
    const password = String(body.password || '').trim();
    const batchSmsId = body.batchSmsId;
    if (!username || !password || !batchSmsId) {
      return res.status(400).json({ success: false, error: 'اطلاعات ناقص است. شناسه ارسال (batchSmsId) الزامی است.' });
    }

    const bIdNum = parseInt(String(batchSmsId), 10);

    // 1. Try Niazpardaz REST Web API V2
    if (!isNaN(bIdNum) && bIdNum > 0) {
      const restRes = await callPayamakRestApi('GetBatchDelivery', {
        userName: username,
        password: password,
        batchSmsId: bIdNum,
        index: 1,
        count: 100
      });

      if (restRes) {
        const deliveryStatus = restRes.result?.deliveryStatus ?? restRes.deliveryStatus;
        if (Array.isArray(deliveryStatus) && deliveryStatus.length > 0) {
          const statusCode = deliveryStatus[0];
          return res.json({
            success: true,
            status: statusCode,
            statusText: parseDeliveryCode(statusCode)
          });
        }
        if (restRes.errorMessage) {
          return res.json({ success: false, error: restRes.errorMessage });
        }
      }
    }

    // 2. Fallback: SOAP WCF
    const xmlBatch = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetBatchDelivery xmlns="http://tempuri.org/">
      <userName>${escapeXml(username)}</userName>
      <password>${escapeXml(password)}</password>
      <batchSmsId>${escapeXml(batchSmsId)}</batchSmsId>
      <index>1</index>
      <count>100</count>
    </GetBatchDelivery>
  </soap:Body>
</soap:Envelope>`;

    try {
      const data = await callPayamakSoap('http://tempuri.org/ISendService/GetBatchDelivery', xmlBatch, 20000);

      const resultMatch = data.match(/<(?:[^:]+:)?GetBatchDeliveryResult[^>]*>([-\d]+)<\/(?:[^:]+:)?GetBatchDeliveryResult>/i);
      const resultCode = resultMatch ? parseInt(resultMatch[1], 10) : -1;

      if (resultCode === 0) {
        const statusMatches = Array.from(data.matchAll(/<(?:[^:]+:)?int[^>]*>([-\d]+)<\/(?:[^:]+:)?int>/gi)).map(m => parseInt(m[1], 10));
        const statusCode = statusMatches.length > 0 ? statusMatches[0] : -1;
        return res.json({
          success: true,
          resultCode,
          status: statusCode,
          statusText: parseDeliveryCode(statusCode)
        });
      }
    } catch (batchErr) {}

    res.json({
      success: false,
      error: 'امکان دریافت گزارش تحویل پیامک در حال حاضر وجود ندارد.'
    });
  } catch (error: any) {
    console.error('SMS Status Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

function parseDeliveryCode(code: number): string {
  switch (code) {
    case -5: return 'برای گرفتن گزارش تحویل حداقل ۱ دقیقه پس از ارسال اقدام نمایید.';
    case -4: return 'پیامک در صف ارسال مخابرات است و امکان دریافت گزارش تحویل هنوز وجود ندارد.';
    case -3: return 'مهلت ۱ هفته‌ای دریافت گزارش تحویل به پایان رسیده است.';
    case -2: return 'پیامکی با این شناسه ارسال (batchSmsId / recId) وجود ندارد.';
    case -1: return 'خطا در ارتباط با سرویس‌دهنده پیامک.';
    case 0: return 'ارسال شده به مخابرات (در انتظار تحویل)';
    case 1: return 'تحویل داده شده به گوشی (Delivered) ✓';
    case 2: return 'نرسیده به گوشی مخاطب';
    case 3: return 'خطای مخابراتی';
    case 4: return 'خطای نامشخص مخابرات';
    case 5: return 'رسیده به مخابرات';
    case 6: return 'نرسیده به مخابرات';
    case 7: return 'مسدود شده توسط مقصد (لیست سیاه مخاطب)';
    case 8: return 'وضعیت نامشخص';
    case 9: return 'مخابرات پیام را مردود اعلام کرد';
    case 10: return 'کنسل شده توسط اپراتور';
    case 11: return 'ارسال نشده';
    default: return `کد وضعیت: ${code}`;
  }
}

import { streamRouter } from './stream-api.js';

// Mount SMS router under all potential base paths
app.use('/api/sms', smsRouter);
app.use('/api/db/sms', smsRouter);
app.use('/sms', smsRouter);

// Mount Live Stream / GitHub Actions router
app.use('/api/stream', streamRouter);
app.use('/api/db/stream', streamRouter);
app.use('/stream', streamRouter);

export { app };

