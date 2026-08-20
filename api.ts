
import { db } from './db/index.js';
import { events, donations, config, admins } from './db/schema.js';
import { eq, desc, and, sql, getTableColumns } from 'drizzle-orm';
import express, { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { broadcastDbChange } from './socket.js';

export const apiRouter = express.Router();

// Prevent caching for all API responses
apiRouter.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

const { receiptImage, ...donationColumns } = getTableColumns(donations);
const donationSelectFields = {
  ...donationColumns,
  hasReceipt: sql<boolean>`"receiptImage" IS NOT NULL AND "receiptImage" != ''`
};
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// Active Session Tokens Store
interface SessionData {
  id: string;
  username: string;
  displayName?: string;
  role: string;
  eventId?: string;
  eventTitle?: string;
  createdAt: number;
}
const activeSessions = new Map<string, SessionData>();
const revokedTokens = new Set<string>();

function getSessionSecret(): string {
  return 'ekram_app_secret_session_key_2026_v1';
}

function signToken(payload: SessionData): string {
  const secret = getSessionSecret();
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyToken(token: string): SessionData | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const secret = getSessionSecret();
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${header}.${body}`)
      .digest('base64url');

    if (signature !== expectedSignature) {
      return null;
    }

    const payload: SessionData = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
    // Valid for 12 hours
    if (Date.now() - payload.createdAt > 12 * 60 * 60 * 1000) {
      return null;
    }
    return payload;
  } catch (err) {
    return null;
  }
}

let dbInitialized = false;

// Ensure default admin user exists
export async function ensureAdminExists() {
  try {
    if (!dbInitialized) {
      try {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "admins" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            "username" text NOT NULL,
            "password" text NOT NULL,
            "displayName" text,
            "role" text NOT NULL
          );
        `);
        try {
          await db.execute(sql`ALTER TABLE "admins" ADD COLUMN IF NOT EXISTS "displayName" text;`);
        } catch (mErr) {}
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "config" (
            "key" text PRIMARY KEY NOT NULL,
            "value" jsonb
          );
        `);
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "donations" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            "event_id" uuid NOT NULL,
            "donorName" text NOT NULL,
            "fatherName" text,
            "mobile" text NOT NULL,
            "amount" integer NOT NULL,
            "description" text,
            "hideName" boolean DEFAULT false,
            "paymentType" text NOT NULL,
            "receiptImage" text,
            "status" text DEFAULT 'pending',
            "smsStatus" text,
            "smsError" text,
            "batchSmsId" text,
            "registeredBy" text,
            "createdAt" timestamp DEFAULT now() NOT NULL
          );
        `);
        try {
          await db.execute(sql`ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "batchSmsId" text;`);
          await db.execute(sql`ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "registeredBy" text;`);
        } catch (mErr) {}
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS "events" (
            "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
            "title" text NOT NULL,
            "isactive" boolean DEFAULT false NOT NULL,
            "isArchived" boolean DEFAULT false NOT NULL,
            "archivedAt" timestamp,
            "created_at" timestamp DEFAULT now() NOT NULL
          );
        `);
        try {
          await db.execute(sql`ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "isArchived" boolean DEFAULT false NOT NULL;`);
          await db.execute(sql`ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "archivedAt" timestamp;`);
          await db.execute(sql`ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "hostUsername" text;`);
          await db.execute(sql`ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "hostPassword" text;`);
        } catch (mErr) {}
        dbInitialized = true;
      } catch (ddlError: any) {
        console.warn('DDL skipped or failed:', ddlError.message);
      }
    }

    // Ensure at least one active event exists
    const existingEvents = await db.select().from(events);
    if (existingEvents.length === 0) {
      await db.insert(events).values({
        title: 'مراسم اصلی اکرام',
        isactive: true,
      });
      console.log('Default active event created.');
    }
  } catch (err: any) {
    console.error('EnsureAdminExists DB note:', err.message || err);
  }
}

// Authentication Middleware for Protected Admin Endpoints
export function requireAuth(req: Request & { user?: SessionData }, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'] || req.headers['x-admin-token'];
  if (!authHeader) {
    return res.status(401).json({ success: false, error: 'دسترسی غیرمجاز. ابتدا وارد حساب کاربری شوید.' });
  }

  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : String(authHeader);

  if (revokedTokens.has(token)) {
    return res.status(401).json({ success: false, error: 'نشست کاربری لغو شده است. مجدداً وارد شوید.' });
  }

  let session = activeSessions.get(token);
  if (!session) {
    const verified = verifyToken(token);
    if (verified) {
      session = verified;
      activeSessions.set(token, session);
    }
  }

  if (!session || (session.role !== 'admin' && session.role !== 'superadmin')) {
    return res.status(401).json({ success: false, error: 'دسترسی غیرمجاز برای پنل مدیریت.' });
  }

  // Session valid for 12 hours
  if (Date.now() - session.createdAt > 12 * 60 * 60 * 1000) {
    activeSessions.delete(token);
    return res.status(401).json({ success: false, error: 'زمان نشست به پایان رسیده است. مجدداً وارد شوید.' });
  }

  req.user = session;
  next();
}

// Authentication Middleware for Protected Host Endpoints
export function requireHostAuth(req: Request & { hostSession?: { eventId: string; eventTitle: string; hostUsername: string } }, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'] || req.headers['x-host-token'];
  if (!authHeader) {
    return res.status(401).json({ success: false, error: 'دسترسی غیرمجاز. لطفاً وارد پنل صاحب عزا شوید.' });
  }

  const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : String(authHeader);

  if (revokedTokens.has(token)) {
    return res.status(401).json({ success: false, error: 'نشست کاربری لغو شده است. مجدداً وارد شوید.' });
  }

  let session = activeSessions.get(token);
  if (!session) {
    const verified = verifyToken(token);
    if (verified) {
      session = verified;
      activeSessions.set(token, session);
    }
  }

  if (!session || session.role !== 'host' || !session.eventId) {
    return res.status(401).json({ success: false, error: 'نشست کاربری نامعتبر است. مجدداً وارد شوید.' });
  }

  // Session valid for 12 hours
  if (Date.now() - session.createdAt > 12 * 60 * 60 * 1000) {
    activeSessions.delete(token);
    return res.status(401).json({ success: false, error: 'زمان نشست به پایان رسیده است. مجدداً وارد شوید.' });
  }

  req.hostSession = {
    eventId: session.eventId,
    eventTitle: session.eventTitle || '',
    hostUsername: session.username
  };
  next();
}

// Auth: Login Endpoint
apiRouter.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'نام کاربری و رمز عبور الزامی است.' });
    }

    const cleanUser = String(username).trim();
    const cleanPass = String(password).trim();

    let authenticatedUser: { id: string; username: string; displayName?: string; role: string } | null = null;
    let dbError = false;

    const envSuperUser = process.env.SUPERADMIN_USERNAME;
    const envSuperPass = process.env.SUPERADMIN_PASSWORD;

    if (envSuperUser && envSuperPass && cleanUser.toLowerCase() === envSuperUser.toLowerCase() && cleanPass === envSuperPass) {
      authenticatedUser = { id: 'env-superadmin', username: cleanUser, displayName: 'مدیر ارشد', role: 'superadmin' };
    } else {
      try {
        await ensureAdminExists();
        const matchedAdmins = await db.select().from(admins).where(sql`lower(${admins.username}) = lower(${cleanUser})`);
        const matched = matchedAdmins.find(a => a.password === cleanPass);
        if (matched) {
          authenticatedUser = {
            id: matched.id,
            username: matched.username,
            displayName: matched.displayName || matched.username,
            role: matched.role
          };
        }
      } catch (err: any) {
        console.error('DB Login Error:', err.message || err);
        dbError = true;
      }
    }

    // Removed hardcoded fallback authentication

    if (authenticatedUser) {
      const userSession: SessionData = {
        id: authenticatedUser.id,
        username: authenticatedUser.username,
        displayName: authenticatedUser.displayName,
        role: authenticatedUser.role,
        createdAt: Date.now(),
      };
      const token = signToken(userSession);
      activeSessions.set(token, userSession);

      return res.json({
        success: true,
        token,
        user: authenticatedUser,
      });
    }

    if (dbError) {
      return res.status(500).json({
        success: false,
        error: 'خطا در برقراری ارتباط با پایگاه داده. لطفاً تنظیمات DATABASE_URL را بررسی کنید.'
      });
    }

    return res.status(401).json({ success: false, error: 'نام کاربری یا رمز عبور اشتباه است.' });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: 'خطای سرور در احراز هویت: ' + (err.message || 'خطای نا مشخص')
    });
  }
});

// Auth: Logout Endpoint
apiRouter.post('/logout', (req, res) => {
  const authHeader = req.headers['authorization'] || req.headers['x-admin-token'];
  if (authHeader) {
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : String(authHeader);
    activeSessions.delete(token);
    revokedTokens.add(token);
  }
  res.json({ success: true });
});

// Host Auth: Login Endpoint
apiRouter.post('/host/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'نام کاربری و رمز عبور الزامی است.' });
    }

    const cleanUser = String(username).trim();
    const cleanPass = String(password).trim();

    await ensureAdminExists();

    const matchedEvents = await db.select().from(events).where(sql`lower(${events.hostUsername}) = lower(${cleanUser})`);
    const matched = matchedEvents.find(e => e.hostPassword === cleanPass);

    if (!matched) {
      return res.status(401).json({ success: false, error: 'نام کاربری یا رمز عبور اشتباه است.' });
    }

    const hostSession: SessionData = {
      id: matched.id,
      username: cleanUser,
      role: 'host',
      eventId: matched.id,
      eventTitle: matched.title,
      createdAt: Date.now(),
    };

    const token = signToken(hostSession);
    activeSessions.set(token, hostSession);

    return res.json({
      success: true,
      token,
      event: {
        id: matched.id,
        title: matched.title,
        hostUsername: matched.hostUsername,
      }
    });
  } catch (err: any) {
    console.error('Host Login Error:', err);
    return res.status(500).json({ success: false, error: 'خطای سرور در احراز هویت صاحب عزا' });
  }
});

// Host: Get Donors List for Event (WITHOUT monetary amounts as strictly requested)
apiRouter.get('/host/donations', requireHostAuth, async (req: any, res) => {
  try {
    const eventId = req.hostSession?.eventId;
    if (!eventId || !UUID_REGEX.test(eventId)) {
      return res.status(400).json({ success: false, error: 'شناسه مراسم نامعتبر است.' });
    }

    const ev = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
    if (!ev || ev.length === 0) {
      return res.status(404).json({ success: false, error: 'مراسم یافت نشد.' });
    }

    // Select ONLY non-monetary fields: donorName, fatherName, mobile, description, createdAt
    const donorList = await db.select({
      id: donations.id,
      event_id: donations.event_id,
      donorName: donations.donorName,
      fatherName: donations.fatherName,
      mobile: donations.mobile,
      description: donations.description,
      createdAt: donations.createdAt,
    })
    .from(donations)
    .where(eq(donations.event_id, eventId))
    .orderBy(desc(donations.createdAt));

    res.json({
      success: true,
      eventTitle: ev[0].title,
      donations: donorList,
    });
  } catch (err: any) {
    console.error('Error fetching host donations:', err);
    res.status(500).json({ success: false, error: 'خطا در دریافت لیست خیرین مراسم.' });
  }
});

// Public: Get Active Event
apiRouter.get('/events/active', async (req, res) => {
  try {
    let data = await db.select().from(events).where(and(eq(events.isactive, true), eq(events.isArchived, false))).limit(1);
    if (!data || data.length === 0) {
      // Fallback to latest non-archived event if no active flag is set
      data = await db.select().from(events).where(eq(events.isArchived, false)).orderBy(desc(events.created_at)).limit(1);
    }
    res.json(data[0] || null);
  } catch (err) {
    console.error('Error fetching active event:', err);
    res.json(null);
  }
});

// Admin: Get All Events
apiRouter.get('/events', requireAuth, async (req, res) => {
  try {
    const data = await db.select().from(events).orderBy(desc(events.created_at));
    res.json(data);
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Admin: Create Event
apiRouter.post('/events', requireAuth, async (req, res) => {
  try {
    const { title, hostUsername, hostPassword } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'عنوان مراسم الزامی است.' });
    }
    await db.update(events).set({ isactive: false });
    const data = await db.insert(events).values({
      title: title.trim(),
      isactive: true,
      isArchived: false,
      hostUsername: hostUsername ? String(hostUsername).trim() : null,
      hostPassword: hostPassword ? String(hostPassword).trim() : null,
    }).returning();
    broadcastDbChange();
    res.json(data[0]);
  } catch (err: any) {
    console.error('Error creating event:', err);
    res.status(500).json({ success: false, error: 'خطا در ثبت مراسم جدید.' });
  }
});

// Admin: Activate Event
apiRouter.post('/events/:id/activate', requireAuth, async (req, res) => {
  try {
    const eventId = String(req.params.id);
    if (!UUID_REGEX.test(eventId)) {
      return res.status(400).json({ success: false, error: 'شناسه مراسم معتبر نیست.' });
    }
    await db.update(events).set({ isactive: false });
    await db.update(events).set({ isactive: true, isArchived: false, archivedAt: null }).where(eq(events.id, eventId));
    broadcastDbChange();
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error activating event:', err);
    res.status(500).json({ success: false, error: 'خطا در فعال‌سازی مراسم.' });
  }
});

// Admin: Archive Event
apiRouter.post('/events/:id/archive', requireAuth, async (req, res) => {
  try {
    const eventId = String(req.params.id);
    if (!UUID_REGEX.test(eventId)) {
      return res.status(400).json({ success: false, error: 'شناسه مراسم معتبر نیست.' });
    }

    const ev = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
    if (!ev || ev.length === 0) {
      return res.status(404).json({ success: false, error: 'مراسم یافت نشد.' });
    }

    // 1. Mark event as archived and deactivate
    await db.update(events).set({
      isactive: false,
      isArchived: true,
      archivedAt: new Date()
    }).where(eq(events.id, eventId));

    // 2. Permanently delete all receipt/attachment files for this event from DB as explicitly requested
    await db.update(donations).set({
      receiptImage: null
    }).where(eq(donations.event_id, eventId));

    broadcastDbChange();
    res.json({
      success: true,
      message: 'مراسم با موفقیت بایگانی شد و فایل‌های پیوست آن از دیتابیس پاک شدند.'
    });
  } catch (err: any) {
    console.error('Error archiving event:', err);
    res.status(500).json({ success: false, error: 'خطا در بایگانی کردن مراسم: ' + (err.message || '') });
  }
});

// Admin: Unarchive Event
apiRouter.post('/events/:id/unarchive', requireAuth, async (req, res) => {
  try {
    const eventId = String(req.params.id);
    if (!UUID_REGEX.test(eventId)) {
      return res.status(400).json({ success: false, error: 'شناسه مراسم معتبر نیست.' });
    }

    await db.update(events).set({
      isArchived: false,
      archivedAt: null
    }).where(eq(events.id, eventId));

    broadcastDbChange();
    res.json({ success: true, message: 'مراسم از حالت بایگانی خارج شد.' });
  } catch (err: any) {
    console.error('Error unarchiving event:', err);
    res.status(500).json({ success: false, error: 'خطا در بازگردانی مراسم از بایگانی.' });
  }
});

// Admin: Update Event
apiRouter.patch('/events/:id', requireAuth, async (req, res) => {
  try {
    const eventId = String(req.params.id);
    if (!UUID_REGEX.test(eventId)) {
      return res.status(400).json({ success: false, error: 'شناسه مراسم معتبر نیست.' });
    }
    const { title, hostUsername, hostPassword } = req.body;
    const updateData: any = {};
    if (title && title.trim()) {
      updateData.title = title.trim();
    }
    if (hostUsername !== undefined) {
      updateData.hostUsername = hostUsername ? String(hostUsername).trim() : null;
    }
    if (hostPassword !== undefined) {
      updateData.hostPassword = hostPassword ? String(hostPassword).trim() : null;
    }
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, error: 'هیچ داده‌ای برای ویرایش ارسال نشده است.' });
    }
    await db.update(events).set(updateData).where(eq(events.id, eventId));
    broadcastDbChange();
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error updating event:', err);
    res.status(500).json({ success: false, error: 'خطا در ویرایش مراسم.' });
  }
});

// Admin: Delete Event
apiRouter.delete('/events/:id', requireAuth, async (req, res) => {
  try {
    const eventId = String(req.params.id);
    if (!UUID_REGEX.test(eventId)) {
      return res.status(400).json({ success: false, error: 'شناسه مراسم معتبر نیست.' });
    }
    await db.delete(donations).where(eq(donations.event_id, eventId));
    await db.delete(events).where(eq(events.id, eventId));
    broadcastDbChange();
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting event:', err);
    res.status(500).json({ success: false, error: 'خطا در حذف مراسم.' });
  }
});

// Admin: Get All Donations for Event (or all events if 'all' or non-UUID is passed)
apiRouter.get('/donations/:eventId', requireAuth, async (req, res) => {
  try {
    const eventId = String(req.params.eventId);
    
    if (eventId === 'active') {
      const activeEvent = await db.select().from(events).where(eq(events.isactive, true)).limit(1);
      if (activeEvent.length > 0) {
        const data = await db.select(donationSelectFields).from(donations).where(eq(donations.event_id, activeEvent[0].id)).orderBy(desc(donations.createdAt));
        return res.json(data);
      }
      return res.json([]);
    }

    if (!eventId || eventId === 'all' || eventId === 'undefined' || eventId === 'null' || !UUID_REGEX.test(eventId)) {
      const data = await db.select(donationSelectFields).from(donations).orderBy(desc(donations.createdAt));
      return res.json(data);
    }

    const data = await db.select(donationSelectFields).from(donations).where(eq(donations.event_id, eventId)).orderBy(desc(donations.createdAt));
    res.json(data);
  } catch (err) {
    console.error('Error fetching donations:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Public: Get Approved Donations for Event (for Hall Display)
apiRouter.get('/donations/:eventId/approved', async (req, res) => {
  try {
    const eventId = String(req.params.eventId);

    if (eventId === 'active') {
      const activeEvent = await db.select().from(events).where(eq(events.isactive, true)).limit(1);
      if (activeEvent.length > 0) {
        let data = await db.select(donationSelectFields).from(donations)
          .where(and(eq(donations.event_id, activeEvent[0].id), eq(donations.status, 'approved')))
          .orderBy(desc(donations.createdAt));
        
        // Fallback: If active event has 0 approved donations, show all approved donations
        if (data.length === 0) {
          data = await db.select(donationSelectFields).from(donations)
            .where(eq(donations.status, 'approved'))
            .orderBy(desc(donations.createdAt));
        }
        return res.json(data);
      }
    }

    if (!eventId || eventId === 'all' || eventId === 'undefined' || eventId === 'null' || !UUID_REGEX.test(eventId)) {
      const data = await db.select(donationSelectFields).from(donations)
        .where(eq(donations.status, 'approved'))
        .orderBy(desc(donations.createdAt));
      return res.json(data);
    }

    let data = await db.select(donationSelectFields).from(donations)
      .where(and(eq(donations.event_id, eventId), eq(donations.status, 'approved')))
      .orderBy(desc(donations.createdAt));
    
    // Fallback if specific event has 0 approved donations
    if (data.length === 0) {
      data = await db.select(donationSelectFields).from(donations)
        .where(eq(donations.status, 'approved'))
        .orderBy(desc(donations.createdAt));
    }
    res.json(data);
  } catch (err) {
    console.error('Error fetching approved donations:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Helper to get or create a valid event ID
async function resolveEventId(providedId?: string | null): Promise<string> {
  if (providedId && UUID_REGEX.test(providedId)) {
    return providedId;
  }
  // Try finding active event
  const activeList = await db.select().from(events).where(eq(events.isactive, true)).limit(1);
  if (activeList.length > 0) {
    return activeList[0].id;
  }
  // Try finding latest event
  const latestList = await db.select().from(events).orderBy(desc(events.created_at)).limit(1);
  if (latestList.length > 0) {
    return latestList[0].id;
  }
  // Auto create default active event if none exists
  const created = await db.insert(events).values({ title: 'مراسم عمومی', isactive: true }).returning();
  return created[0].id;
}

// Public: Submit Donation (from Donor Portal or Admin)
apiRouter.post('/donations', async (req, res) => {
  try {
    const payload = { ...req.body };
    payload.event_id = await resolveEventId(payload.event_id);
    
    if (!payload.donorName || payload.amount === undefined || payload.amount === null || !payload.paymentType) {
      return res.status(400).json({ success: false, error: 'اطلاعات ضروری (نام، مبلغ و نوع پرداخت) کامل نیست.' });
    }
    
    payload.mobile = payload.mobile || '-';

    // Set registeredBy: if passed from body use it, else check auth header, else fallback
    if (!payload.registeredBy) {
      const authHeader = req.headers['authorization'] || req.headers['x-admin-token'];
      if (authHeader) {
        const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
          ? authHeader.slice(7)
          : String(authHeader);
        const session = activeSessions.get(token) || verifyToken(token);
        if (session) {
          payload.registeredBy = session.displayName || session.username;
        }
      }
    }
    if (!payload.registeredBy) {
      payload.registeredBy = payload.paymentType === 'online' ? 'سامانه آنلاین' : 'ثبت اینترنتی (خیر)';
    }

    const data = await db.insert(donations).values(payload).returning();
    broadcastDbChange();
    res.json(data[0]);
  } catch (err: any) {
    console.error('Error submitting donation:', err);
    res.status(500).json({ success: false, error: 'خطا در ثبت پرداختی: ' + (err.message || 'خطای پایگاه داده') });
  }
});

// Admin: Update Donation
apiRouter.patch('/donations/:id', requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ success: false, error: 'شناسه پرداختی معتبر نیست.' });
    }
    
    // Sanitize payload to prevent updating ID or createdAt
    const { id: _, createdAt, ...updatePayload } = req.body;
    
    await db.update(donations).set(updatePayload).where(eq(donations.id, id));
    broadcastDbChange();
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error updating donation:', err);
    res.status(500).json({ success: false, error: 'خطا در بروزرسانی پرداختی.' });
  }
});

// Admin: Delete Donation
apiRouter.delete('/donations/:id', requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ success: false, error: 'شناسه پرداختی معتبر نیست.' });
    }
    await db.delete(donations).where(eq(donations.id, id));
    broadcastDbChange();
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting donation:', err);
    res.status(500).json({ success: false, error: 'خطا در حذف پرداختی.' });
  }
});

// Public or Admin: Get Donation Receipt Image
apiRouter.get('/donations/:id/receipt', async (req, res) => {
  try {
    const id = String(req.params.id);
    if (!UUID_REGEX.test(id)) return res.status(400).send('Invalid ID');
    const data = await db.select({ receiptImage: donations.receiptImage }).from(donations).where(eq(donations.id, id)).limit(1);
    if (!data.length || !data[0].receiptImage) return res.status(404).json({ receiptImage: null });
    res.json({ receiptImage: data[0].receiptImage });
  } catch (err) {
    console.error('Error fetching receipt:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Public: Get Config Key (for Display Settings)

// Public: Get Config Key (for Display Settings)
apiRouter.get('/config/:key', async (req, res) => {
  try {
    const data = await db.select().from(config).where(eq(config.key, String(req.params.key))).limit(1);
    res.json(data[0] || null);
  } catch (err) {
    console.error('Error fetching config:', err);
    res.json(null);
  }
});

// Admin: Upsert Config Key
apiRouter.post('/config', requireAuth, async (req: Request & { user?: SessionData }, res) => {
  try {
    const { key, value } = req.body;
    const isSuperAdmin = req.user?.role === 'superadmin';

    const existing = await db.select().from(config).where(eq(config.key, key)).limit(1);
    if (existing.length > 0) {
      let finalValue = value;
      if (typeof value === 'object' && value !== null) {
        const oldVal = (existing[0].value as any) || {};
        // Merge with existing values to ensure no fields are lost
        finalValue = { ...oldVal, ...value };
        
        // Prevent regular admins from overwriting sensitive or super-admin-only fields
        if (key === 'displaySettings' && !isSuperAdmin) {
          finalValue = {
            ...finalValue,
            smsUser: oldVal.smsUser !== undefined ? oldVal.smsUser : '',
            smsPass: oldVal.smsPass !== undefined ? oldVal.smsPass : '',
            smsFrom: oldVal.smsFrom !== undefined ? oldVal.smsFrom : '',
            githubToken: oldVal.githubToken !== undefined ? oldVal.githubToken : '',
            githubRepo: oldVal.githubRepo !== undefined ? oldVal.githubRepo : '',
            githubWorkflow: oldVal.githubWorkflow !== undefined ? oldVal.githubWorkflow : '',
            streamTargetUrl: oldVal.streamTargetUrl !== undefined ? oldVal.streamTargetUrl : '',
            streamWorkerUrl: oldVal.streamWorkerUrl !== undefined ? oldVal.streamWorkerUrl : '',
            streamNeonUrl: oldVal.streamNeonUrl !== undefined ? oldVal.streamNeonUrl : '',
            streamQuality: oldVal.streamQuality !== undefined ? oldVal.streamQuality : '',
            streamFps: oldVal.streamFps !== undefined ? oldVal.streamFps : 30,
            streamDuration: oldVal.streamDuration !== undefined ? oldVal.streamDuration : 60,
          };
        }
      }
      await db.update(config).set({ value: finalValue }).where(eq(config.key, key));
    } else {
      await db.insert(config).values({ key, value });
    }
    broadcastDbChange();
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error updating config:', err);
    res.status(500).json({ success: false, error: 'خطا در ذخیره تنظیمات.' });
  }
});

// Superadmin: Get Admins (Excludes Passwords!)
apiRouter.get('/admins', requireAuth, async (req: Request & { user?: SessionData }, res) => {
  try {
    if (req.user?.role !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'تنها سوپرادمین مجاز به مشاهده لیست مدیران است.' });
    }
    await ensureAdminExists();
    const data = await db.select({
      id: admins.id,
      username: admins.username,
      displayName: admins.displayName,
      role: admins.role,
    }).from(admins);
    res.json(data);
  } catch (err) {
    console.error('Error fetching admins:', err);
    res.json([]);
  }
});

// Superadmin: Create Admin
apiRouter.post('/admins', requireAuth, async (req: Request & { user?: SessionData }, res) => {
  try {
    if (req.user?.role !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'تنها سوپرادمین مجاز به ساخت ادمین جدید است.' });
    }
    const { username, password, displayName, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'نام کاربری و رمز عبور الزامی است.' });
    }
    const cleanUser = String(username).trim();
    const cleanDisplayName = displayName ? String(displayName).trim() : cleanUser;
    const existing = await db.select().from(admins).where(eq(admins.username, cleanUser));
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: 'این نام کاربری قبلاً ثبت شده است.' });
    }
    const data = await db.insert(admins).values({
      username: cleanUser,
      password,
      displayName: cleanDisplayName,
      role: 'admin'
    }).returning({
      id: admins.id,
      username: admins.username,
      displayName: admins.displayName,
      role: admins.role,
    });
    broadcastDbChange();
    res.json(data[0]);
  } catch (err: any) {
    console.error('Error creating admin:', err);
    res.status(500).json({ success: false, error: 'خطا در ساخت ادمین.' });
  }
});

// Superadmin: Update Admin
apiRouter.patch('/admins/:id', requireAuth, async (req: Request & { user?: SessionData }, res) => {
  try {
    if (req.user?.role !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'تنها سوپرادمین مجاز به ویرایش مدیران است.' });
    }
    const adminId = String(req.params.id);
    const { displayName, password } = req.body;
    const updateData: any = {};
    if (displayName !== undefined) {
      updateData.displayName = displayName ? String(displayName).trim() : null;
    }
    if (password) {
      updateData.password = String(password).trim();
    }
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, error: 'هیچ مقداری برای ویرایش ارسال نشده است.' });
    }
    await db.update(admins).set(updateData).where(eq(admins.id, adminId));
    broadcastDbChange();
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error updating admin:', err);
    res.status(500).json({ success: false, error: 'خطا در ویرایش مدیر.' });
  }
});

// Superadmin: Delete Admin
apiRouter.delete('/admins/:id', requireAuth, async (req: Request & { user?: SessionData }, res) => {
  try {
    if (req.user?.role !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'تنها سوپرادمین مجاز به حذف ادمین است.' });
    }
    await db.delete(admins).where(eq(admins.id, String(req.params.id)));
    broadcastDbChange();
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting admin:', err);
    res.status(500).json({ success: false, error: 'خطا در حذف ادمین.' });
  }
});


