import express from 'express';
import { db } from './db/index.js';
import { config as dbConfig } from './db/schema.js';
import { eq } from 'drizzle-orm';

export const streamRouter = express.Router();

streamRouter.post('/sms-bridge-callback', async (req, res) => {
  try {
    const { url } = req.body;
    if (url) {
      const existing = await db.select().from(dbConfig).where(eq(dbConfig.key, 'sms_bridge_url'));
      if (existing.length > 0) {
        await db.update(dbConfig).set({ value: { url, updatedAt: new Date().toISOString() } }).where(eq(dbConfig.key, 'sms_bridge_url'));
      } else {
        await db.insert(dbConfig).values({ key: 'sms_bridge_url', value: { url, updatedAt: new Date().toISOString() } });
      }
      return res.json({ success: true });
    }
    res.status(400).json({ error: 'URL not provided' });
  } catch (err: any) {
    console.error('SMS bridge callback error:', err);
    res.status(500).json({ error: err.message });
  }
});

streamRouter.get('/sms-bridge-url', async (req, res) => {
  try {
    const result = await db.select().from(dbConfig).where(eq(dbConfig.key, 'sms_bridge_url'));
    if (result.length > 0) {
      const val = result[0].value as any;
      return res.json({ success: true, url: val?.url, updatedAt: val?.updatedAt });
    }
    return res.json({ success: false, url: null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

interface DispatchPayload {
  token?: string;
  repo?: string; // e.g. "username/repo" or "hudsonparker87/streamer-repo"
  workflow?: string; // e.g. "streamer.yml" or ID
  ref?: string; // default "main"
  quality?: string;
  fps?: string | number;
  duration?: string | number;
  callback_url?: string;
  url?: string;
  target_url?: string;
  streamTargetUrl?: string;
}

// 1. Dispatch GitHub Actions Workflow
streamRouter.post('/dispatch', async (req, res) => {
  try {
    const {
      token,
      repo,
      workflow = 'streamer.yml',
      ref,
      quality = '720p',
      fps = '30',
      duration = '60',
      callback_url,
      url,
      target_url,
      streamTargetUrl
    } = req.body as DispatchPayload;

    if (!token || !token.trim()) {
      return res.status(400).json({
        success: false,
        error: 'توکن دسترسی گیت‌هاب (Personal Access Token) وارد نشده است.'
      });
    }

    if (!repo || !repo.trim() || !repo.includes('/')) {
      return res.status(400).json({
        success: false,
        error: 'نام مخزن گیت‌هاب باید به صورت "owner/repo" باشد (مثال: myusername/live-streamer).'
      });
    }

    let cleanRepo = repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
    const cleanWorkflow = workflow.trim() || 'streamer.yml';

    // Retrieve target URL strictly from database config saved in super admin panel or payload, NEVER from env
    const dbConfigResult = await db.select().from(dbConfig).where(eq(dbConfig.key, 'displaySettings')).limit(1);
    const dbSettings = dbConfigResult.length > 0 ? (dbConfigResult[0].value as any) : {};
    const dbTargetUrl = (dbSettings?.streamTargetUrl || '').trim();

    const resolvedTargetUrl = (
      dbTargetUrl ||
      target_url ||
      url ||
      streamTargetUrl ||
      ''
    ).trim();

    if (resolvedTargetUrl && (!dbSettings?.streamTargetUrl || dbSettings.streamTargetUrl !== resolvedTargetUrl)) {
      try {
        const updatedSettings = { ...dbSettings, streamTargetUrl: resolvedTargetUrl };
        if (dbConfigResult.length > 0) {
          await db.update(dbConfig).set({ value: updatedSettings }).where(eq(dbConfig.key, 'displaySettings'));
        } else {
          await db.insert(dbConfig).values({ key: 'displaySettings', value: updatedSettings });
        }
      } catch (err) {
        console.error('Error auto-saving target URL to dbConfig:', err);
      }
    }

    if (cleanWorkflow !== 'sms-bridge.yml' && !resolvedTargetUrl) {
      return res.status(400).json({
        success: false,
        error: 'آدرس تارگت (Target Display URL) در پنل سوپر ادمین ذخیره نشده است. لطفاً ابتدا آدرس را در تنظیمات سوپر ادمین وارد و ذخیره کنید.'
      });
    }

    // Helper to send dispatch request
    const tryDispatch = async (targetRepo: string, targetWorkflow: string, targetRef: string) => {
      // First check if already running
      const checkUrl = `https://api.github.com/repos/${targetRepo}/actions/workflows/${targetWorkflow}/runs?per_page=5`;
      const checkRes = await fetch(checkUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${token.trim()}`,
          'User-Agent': 'Ekram-M3U8-Streamer'
        }
      });
      
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        const runs = checkData.workflow_runs || [];
        const activeRun = runs.find((r: any) => ['in_progress', 'queued', 'pending', 'waiting'].includes(r.status));
        if (activeRun) {
          throw new Error('ALREADY_RUNNING');
        }
      }

      const dispatchUrl = `https://api.github.com/repos/${targetRepo}/actions/workflows/${targetWorkflow}/dispatches`;
      
      const inputs: any = {};
      
      if (targetWorkflow === 'sms-bridge.yml') {
        if (callback_url) {
          inputs.callback_url = callback_url;
        }
      } else {
        inputs.quality = String(quality);
        inputs.fps = String(fps);
        inputs.duration = String(duration);
        if (resolvedTargetUrl) {
          inputs.url = resolvedTargetUrl;
        }
      }
      
      return fetch(dispatchUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${token.trim()}`,
          'User-Agent': 'Ekram-M3U8-Streamer',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ref: targetRef,
          inputs
        })
      });
    };

    let targetRef = ref ? ref.trim() : 'main';
    let response = await tryDispatch(cleanRepo, cleanWorkflow, targetRef);

    if (response.status === 204) {
      return res.json({
        success: true,
        message: 'دستور شروع پخش زنده با موفقیت به گیت‌هاب ارسال شد. ورکفلو در چند ثانیه آینده اجرا می‌شود.'
      });
    }

    // If 404 (Not Found), investigate repository, username mismatch, branch, and workflows on GitHub
    if (response.status === 404) {
      // Check authenticated user
      const userCheck = await fetch('https://api.github.com/user', {
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${token.trim()}`,
          'User-Agent': 'Ekram-M3U8-Streamer'
        }
      });
      const authUser = userCheck.ok ? (await userCheck.json())?.login : null;

      // If user typed owner/repo but owner differs from token user, test with authUser/repo
      if (authUser && cleanRepo.includes('/')) {
        const repoOnly = cleanRepo.split('/')[1];
        const candidateRepo = `${authUser}/${repoOnly}`;
        if (candidateRepo !== cleanRepo) {
          const candidateCheck = await fetch(`https://api.github.com/repos/${candidateRepo}`, {
            headers: {
              'Accept': 'application/vnd.github+json',
              'Authorization': `Bearer ${token.trim()}`,
              'User-Agent': 'Ekram-M3U8-Streamer'
            }
          });
          if (candidateCheck.ok) {
            cleanRepo = candidateRepo;
            const candData = await candidateCheck.json().catch(() => ({}));
            targetRef = candData.default_branch || 'main';
            response = await tryDispatch(cleanRepo, cleanWorkflow, targetRef);
            if (response.status === 204) {
              return res.json({
                success: true,
                message: `نام کاربری به صورت خودکار با اکانت گیت‌هاب شما (${candidateRepo}) تطبیق داده شد و استریم با موفقیت شروع شد.`
              });
            }
          }
        }
      }

      // 1. Inspect repository & default branch
      const repoCheck = await fetch(`https://api.github.com/repos/${cleanRepo}`, {
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${token.trim()}`,
          'User-Agent': 'Ekram-M3U8-Streamer'
        }
      });

      if (!repoCheck.ok) {
        if (repoCheck.status === 404) {
          const hint = authUser ? ` (نام کاربری اکانت شما در گیت‌هاب: "${authUser}" است. نام مخزن را به صورت "${authUser}/${cleanRepo.split('/')[1] || 'kheyriyeh2'}" وارد کنید)` : '';
          return res.status(404).json({
            success: false,
            error: `مخزن گیت‌هاب "${cleanRepo}" یافت نشد یا توکن شما دسترسی به آن ندارد.${hint}`
          });
        }
        if (repoCheck.status === 401) {
          return res.status(401).json({
            success: false,
            error: 'توکن گیت‌هاب نامعتبر یا منقضی شده است. لطفاً توکن جدید بسازید.'
          });
        }
      }

      const repoData = await repoCheck.json().catch(() => ({}));
      const defaultBranch = repoData.default_branch || 'main';

      // If branch was 'main' but default is 'master' (or vice versa), retry with default branch
      if (defaultBranch !== targetRef) {
        targetRef = defaultBranch;
        response = await tryDispatch(cleanRepo, cleanWorkflow, targetRef);
        if (response.status === 204) {
          return res.json({
            success: true,
            message: `دستور شروع استریم روی شاخه ${targetRef} با موفقیت به گیت‌هاب ارسال شد.`
          });
        }
      }

      // 2. Check workflows in repository
      const wfCheck = await fetch(`https://api.github.com/repos/${cleanRepo}/actions/workflows`, {
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${token.trim()}`,
          'User-Agent': 'Ekram-M3U8-Streamer'
        }
      });

      if (wfCheck.ok) {
        const wfData = await wfCheck.json().catch(() => ({ workflows: [] }));
        const workflows = wfData.workflows || [];
        const matched = workflows.find((w: any) => 
          w.path?.endsWith(cleanWorkflow) || 
          w.name?.toLowerCase().includes('streamer') ||
          w.name?.toLowerCase().includes('live')
        );

        if (matched && String(matched.id) !== cleanWorkflow) {
          // Retry with workflow ID
          response = await tryDispatch(cleanRepo, String(matched.id), targetRef);
          if (response.status === 204) {
            return res.json({
              success: true,
              message: `دستور شروع استریم با ورکفلو ${matched.name} با موفقیت ارسال شد.`
            });
          }
        }

        if (workflows.length === 0 || !matched) {
          return res.status(404).json({
            success: false,
            error: `فایل ورکفلو ".github/workflows/${cleanWorkflow}" هنوز در گیت‌هاب ثبت نشده است. لطفاً تغییرات این پروژه را در گیت‌هاب Commit و Push کنید تا ورکفلو در گیت‌هاب فعال شود.`
          });
        }
      }

      return res.status(404).json({
        success: false,
        error: `ورکفلو یا شاخه گیت‌هاب یافت نشد (404). لطفاً اطمینان حاصل کنید که تغییرات در گیت‌هاب کامیت شده‌اند و توکن شما دارای تیک دسترسی "workflow" و "repo" است.`
      });
    }

    const errorData = await response.json().catch(() => null);
    const errorMsg = errorData?.message || `پاسخ ناموفق از گیت‌هاب (کد ${response.status})`;

    return res.status(response.status).json({
      success: false,
      error: errorMsg,
      details: errorData
    });
  } catch (err: any) {
    if (err.message === 'ALREADY_RUNNING') {
      return res.status(400).json({
        success: false,
        error: 'یک سرور در حال حاضر روشن است. لطفاً ابتدا سرور قبلی را متوقف کنید یا منتظر بمانید تا کار آن تمام شود.'
      });
    }
    console.error('Stream dispatch error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'خطا در ارتباط با سرور گیت‌هاب'
    });
  }
});

// 2. Query Workflow Runs & Status
streamRouter.post('/status', async (req, res) => {
  try {
    const {
      token,
      repo,
      workflow = 'streamer.yml'
    } = req.body;

    if (!token || !token.trim() || !repo || !repo.trim()) {
      return res.status(400).json({
        success: false,
        error: 'توکن و نام ریپازیتوری الزامی است.'
      });
    }

    const cleanRepo = repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
    const cleanWorkflow = (workflow || '').trim() || 'streamer.yml';

    const runsUrl = `https://api.github.com/repos/${cleanRepo}/actions/workflows/${cleanWorkflow}/runs?per_page=5`;

    const response = await fetch(runsUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token.trim()}`,
        'User-Agent': 'Ekram-M3U8-Streamer'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return res.status(response.status).json({
        success: false,
        error: errorData?.message || `خطا در دریافت وضعیت از گیت‌هاب (${response.status})`
      });
    }

    const data = await response.json();
    const runs = data.workflow_runs || [];

    const latestRun = runs[0] || null;

    return res.json({
      success: true,
      total_count: data.total_count,
      latestRun: latestRun ? {
        id: latestRun.id,
        name: latestRun.name,
        status: latestRun.status, // "queued", "in_progress", "completed"
        conclusion: latestRun.conclusion, // "success", "failure", "cancelled", null
        created_at: latestRun.created_at,
        updated_at: latestRun.updated_at,
        run_number: latestRun.run_number,
        html_url: latestRun.html_url,
        event: latestRun.event
      } : null,
      runs: runs.slice(0, 3).map((r: any) => ({
        id: r.id,
        status: r.status,
        conclusion: r.conclusion,
        created_at: r.created_at,
        html_url: r.html_url,
        run_number: r.run_number
      }))
    });
  } catch (err: any) {
    console.error('Stream status error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'خطا در استعلام وضعیت ورکفلو'
    });
  }
});

// 3. Diagnose GitHub connection & permissions
streamRouter.post('/diagnose-github', async (req, res) => {
  try {
    const { token, repo } = req.body;
    if (!token || !token.trim()) {
      return res.status(400).json({ success: false, error: 'توکن وارد نشده است.' });
    }
    if (!repo || !repo.trim()) {
      return res.status(400).json({ success: false, error: 'نام مخزن وارد نشده است.' });
    }

    const cleanRepo = repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
    
    // Check User / Token
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token.trim()}`,
        'User-Agent': 'Ekram-M3U8-Streamer'
      }
    });
    const scopes = userRes.headers.get('x-oauth-scopes') || '';
    const userData = await userRes.json().catch(() => null);

    if (!userRes.ok) {
      return res.json({
        success: false,
        error: `توکن نامعتبر است (${userRes.status}): ${userData?.message || 'خطا در احراز هویت'}`
      });
    }

    // Check Repo
    const repoRes = await fetch(`https://api.github.com/repos/${cleanRepo}`, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token.trim()}`,
        'User-Agent': 'Ekram-M3U8-Streamer'
      }
    });
    const repoData = await repoRes.json().catch(() => null);

    if (!repoRes.ok) {
      return res.json({
        success: false,
        user: userData?.login,
        scopes,
        error: `مخزن "${cleanRepo}" یافت نشد یا توکن دسترسی به آن ندارد (${repoRes.status}): ${repoData?.message || ''}`
      });
    }

    // Check Workflows
    const wfRes = await fetch(`https://api.github.com/repos/${cleanRepo}/actions/workflows`, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token.trim()}`,
        'User-Agent': 'Ekram-M3U8-Streamer'
      }
    });
    const wfData = await wfRes.json().catch(() => ({ workflows: [] }));

    return res.json({
      success: true,
      user: userData?.login,
      scopes,
      repo: repoData?.full_name,
      default_branch: repoData?.default_branch,
      private: repoData?.private,
      workflows: (wfData?.workflows || []).map((w: any) => ({
        id: w.id,
        name: w.name,
        path: w.path,
        state: w.state
      }))
    });
  } catch (err: any) {
    return res.json({
      success: false,
      error: err.message || 'خطا در ارتباط با گیت‌هاب'
    });
  }
});

// 4. Cancel / Stop a Running Workflow Run
streamRouter.post('/cancel', async (req, res) => {
  try {
    const { token, repo, run_id } = req.body;

    if (!token || !repo || !run_id) {
      return res.status(400).json({
        success: false,
        error: 'شناسه اجرا (run_id)، توکن و نام ریپازیتوری الزامی است.'
      });
    }

    const cleanRepo = repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
    const cancelUrl = `https://api.github.com/repos/${cleanRepo}/actions/runs/${run_id}/cancel`;

    const response = await fetch(cancelUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token.trim()}`,
        'User-Agent': 'Ekram-M3U8-Streamer'
      }
    });

    if (response.status === 202 || response.status === 200) {
      return res.json({
        success: true,
        message: 'دستور توقف استریم به گیت‌هاب ارسال شد.'
      });
    }

    const errorData = await response.json().catch(() => null);
    return res.status(response.status).json({
      success: false,
      error: errorData?.message || `خطا در لغو اجرا (${response.status})`
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'خطا در لغو ورکفلو'
    });
  }
});

// 4. Test Stream URL (check if .m3u8 is reachable and valid)
streamRouter.post('/test-hls', async (req, res) => {
  try {
    const { streamUrl } = req.body;
    if (!streamUrl || !streamUrl.trim()) {
      return res.status(400).json({ success: false, error: 'آدرس استریم وارد نشده است.' });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(streamUrl.trim(), {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Cache-Control': 'no-cache'
      },
      signal: controller.signal
    });
    clearTimeout(timer);

    const isOk = response.ok;
    const text = await response.text();
    const isM3U8 = text.includes('#EXTM3U');

    return res.json({
      success: isOk,
      statusCode: response.status,
      isM3U8,
      contentType: response.headers.get('content-type'),
      bodySnippet: text.slice(0, 300)
    });
  } catch (err: any) {
    return res.json({
      success: false,
      error: err.message || 'خطا در اتصال به آدرس استریم'
    });
  }
});

// 5. Embedded Anti-Sanction Stream Proxy (HLS M3U8 & TS Segments)
const DEFAULT_NEON_STREAM_ORIGIN = 'https://br-lucky-wave-axbfuzrm.storage.c-4.us-east-2.aws.neon.tech/m3u8-streamer';

export async function proxyStreamRequest(reqPath: string, req: express.Request, res: express.Response) {
  const origin = process.env.NEON_STREAM_ORIGIN || DEFAULT_NEON_STREAM_ORIGIN;
  const cleanPath = reqPath.startsWith('/') ? reqPath : `/${reqPath}`;
  const targetUrl = `${origin}${cleanPath}`;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'User-Agent': 'Ekram-Stream-Proxy',
        'Accept': '*/*'
      }
    });

    if (cleanPath.endsWith('.m3u8')) {
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    } else if (cleanPath.endsWith('.ts')) {
      res.setHeader('Content-Type', 'video/mp2t');
    } else {
      const ct = upstreamRes.headers.get('content-type');
      if (ct) res.setHeader('Content-Type', ct);
    }

    res.status(upstreamRes.status);
    const arrayBuffer = await upstreamRes.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    console.error('Stream proxy fetch error:', err);
    return res.status(500).send(`Stream Proxy Error: ${err.message}`);
  }
}

// Mount proxy routes on streamRouter
streamRouter.all('/live.m3u8', (req, res) => proxyStreamRequest('/live.m3u8', req, res));
streamRouter.all('/proxy/*all', (req, res) => {
  const subPath = (req.params as any).all || '';
  proxyStreamRequest(`/${subPath}`, req, res);
});
streamRouter.use('/proxy', (req, res) => {
  proxyStreamRequest(req.url, req, res);
});

