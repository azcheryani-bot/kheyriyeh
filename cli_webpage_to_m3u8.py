#!/usr/bin/env python3
"""
Webpage to HLS (M3U8) Live Streamer with Neon S3 Cloud Sync
Captures a webpage using Headless Chromium / Xvfb, records via FFmpeg (without mouse cursor),
and continuously uploads HLS .m3u8 and .ts segments to Neon S3 storage.
"""

import argparse
import os
import re
import time
import json
import threading
import subprocess
import glob
import signal
import sys
import shutil
import boto3
from botocore.client import Config

# آدرس صفحه‌ای که می‌خواهید استریم شود (تنها آدرس معتبر ارسالی از پنل سوپر ادمین)
TARGET_URL = (os.getenv("TARGET_URL") or "").strip()

# مشخصات اتصال به باکت استوریج نئون (تنها از طریق Environment Variables خوانده می‌شود)
S3_ENDPOINT = os.getenv("S3_ENDPOINT_URL", "").strip()
S3_ACCESS_KEY = os.getenv("AWS_ACCESS_KEY_ID", "").strip()
S3_SECRET_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "").strip()
S3_REGION = os.getenv("AWS_DEFAULT_REGION", "us-east-2").strip()
BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "").strip()

# تعداد سگمنت‌های بافر امنیتی در باکت (پیش‌فرض: ۳۰ سگمنت ≈ ۲ دقیقه حاشیه امن)
try:
    S3_KEEP_SEGMENTS = max(1, int((os.getenv("S3_KEEP_SEGMENTS") or "30").strip()))
except ValueError:
    S3_KEEP_SEGMENTS = 30

S3_SWEEP_INTERVAL_SECONDS = 60

s3_client = boto3.client(
    's3',
    endpoint_url=S3_ENDPOINT,
    aws_access_key_id=S3_ACCESS_KEY,
    aws_secret_access_key=S3_SECRET_KEY,
    region_name=S3_REGION,
    config=Config(signature_version='s3v4')
)


def _segment_sort_key(filename):
    """استخراج شماره سگمنت برای مرتب‌سازی عددی دقیق (مثلاً live99.ts قبل از live100.ts)."""
    base = os.path.basename(filename)
    match = re.search(r'(\d+)\.ts$', base)
    if match:
        return (0, int(match.group(1)), base)
    return (1, 0, base)


def _read_playlist_segments(m3u8_path="live.m3u8"):
    """استخراج نام سگمنت‌های .ts ارجاع‌شده در نسخهٔ فعلی live.m3u8."""
    segments = set()
    if not os.path.exists(m3u8_path):
        return segments
    try:
        with open(m3u8_path, "r", encoding="utf-8", errors="ignore") as f:
            for raw_line in f:
                line = raw_line.strip()
                if not line or line.startswith("#"):
                    continue
                clean_name = os.path.basename(line.split("?")[0].strip())
                if clean_name.endswith(".ts"):
                    segments.add(clean_name)
    except Exception as e:
        print(f"⚠️ هشدار در خواندن فایل پلی‌لیست {m3u8_path}: {e}")
    return segments


def compute_retention_set(playlist_segments, uploaded_order, keep_segments=None):
    """
    محاسبه مجموعهٔ سگمنت‌هایی که باید در باکت باقی بمانند:
    سگمنت‌های موجود در نسخهٔ فعلی live.m3u8 + آخرین S3_KEEP_SEGMENTS سگمنت آپلودشده.
    """
    if keep_segments is None:
        keep_segments = S3_KEEP_SEGMENTS
    keep_count = max(1, int(keep_segments))

    ordered_unique = sorted(set(uploaded_order), key=_segment_sort_key)
    recent_buffer = set(ordered_unique[-keep_count:]) if ordered_unique else set()
    active_playlist = set(playlist_segments or ())

    # هرگز live.m3u8 یا سگمنت‌های داخل پلی‌لیست فعلی حذف نمی‌شوند
    return active_playlist | recent_buffer | {"live.m3u8"}


def _delete_s3_keys_batched(keys_to_delete, context_label="حذف لغزان"):
    """حذف دسته‌ای کلیدها از باکت S3 در دسته‌های حداکثر ۱۰۰۰تایی با حفاظت از live.m3u8."""
    safe_keys = [k for k in keys_to_delete if k and k != "live.m3u8"]
    if not safe_keys:
        return set()

    deleted_keys = set()
    for i in range(0, len(safe_keys), 1000):
        batch = safe_keys[i:i + 1000]
        try:
            s3_client.delete_objects(
                Bucket=BUCKET_NAME,
                Delete={'Objects': [{'Key': k} for k in batch], 'Quiet': True}
            )
            deleted_keys.update(batch)
        except Exception as e:
            print(f"⚠️ هشدار در {context_label} از باکت نئون: {e}")
    return deleted_keys


def purge_bucket():
    print("🧹 در حال پاک‌سازی کامل باکت نئون (با صفحه‌بندی)...")
    total_deleted = 0
    try:
        while True:
            keys_in_pass = []
            continuation_token = None

            while True:
                list_kwargs = {'Bucket': BUCKET_NAME, 'MaxKeys': 1000}
                if continuation_token:
                    list_kwargs['ContinuationToken'] = continuation_token

                response = s3_client.list_objects_v2(**list_kwargs)
                contents = response.get('Contents') or []
                for obj in contents:
                    key = obj.get('Key')
                    if key:
                        keys_in_pass.append(key)

                if response.get('IsTruncated') and response.get('NextContinuationToken'):
                    continuation_token = response['NextContinuationToken']
                else:
                    break

            if not keys_in_pass:
                break

            deleted_in_pass = 0
            for i in range(0, len(keys_in_pass), 1000):
                batch = keys_in_pass[i:i + 1000]
                s3_client.delete_objects(
                    Bucket=BUCKET_NAME,
                    Delete={'Objects': [{'Key': k} for k in batch], 'Quiet': True}
                )
                deleted_in_pass += len(batch)
                total_deleted += len(batch)

            if deleted_in_pass == 0:
                break

        print(f"✨ باکت نئون به طور کامل تخلیه شد (تعداد کل فایل‌های حذف‌شده: {total_deleted}).")
    except Exception as e:
        print(f"⚠️ پیام وضعیت باکت (حذف‌شده تا این لحظه: {total_deleted}): {e}")


def _periodic_bucket_sweep(uploaded_order):
    """جاروب امنیتی دوره‌ای باکت با صفحه‌بندی برای حذف هر سگمنت .ts خارج از مجموعهٔ نگهداری."""
    try:
        playlist_segments = _read_playlist_segments("live.m3u8")
        keep_set = compute_retention_set(playlist_segments, uploaded_order, S3_KEEP_SEGMENTS)

        # اگر هنوز هیچ سگمنتی در پلی‌لیست و تاریخچه آپلود ثبت نشده، از حذف خودداری شود
        if not playlist_segments and not uploaded_order:
            return

        continuation_token = None
        stale_remote_keys = []

        while True:
            list_kwargs = {'Bucket': BUCKET_NAME, 'MaxKeys': 1000}
            if continuation_token:
                list_kwargs['ContinuationToken'] = continuation_token

            response = s3_client.list_objects_v2(**list_kwargs)
            contents = response.get('Contents') or []
            for obj in contents:
                key = obj.get('Key')
                if not key or key == "live.m3u8":
                    continue
                if key.endswith(".ts") and key not in keep_set:
                    stale_remote_keys.append(key)

            if response.get('IsTruncated') and response.get('NextContinuationToken'):
                continuation_token = response['NextContinuationToken']
            else:
                break

        if stale_remote_keys:
            # پیش از حذف، یک بار دیگر پلی‌لیست فعلی بررسی شود تا سگمنت تازه‌وارد حذف نشود
            latest_playlist = _read_playlist_segments("live.m3u8")
            final_keep_set = compute_retention_set(latest_playlist, uploaded_order, S3_KEEP_SEGMENTS)
            final_to_delete = [k for k in stale_remote_keys if k not in final_keep_set and k != "live.m3u8"]
            if final_to_delete:
                deleted = _delete_s3_keys_batched(final_to_delete, context_label="جاروب امنیتی دوره‌ای")
                if deleted:
                    print(f"🧹 جاروب امنیتی دوره‌ای: {len(deleted)} سگمنت قدیمی از باکت نئون پاک شد.")
    except Exception as e:
        print(f"⚠️ هشدار در جاروب امنیتی دوره‌ای باکت: {e}")


def s3_sync_worker(stop_event):
    uploaded_files = set()
    uploaded_order = []
    last_sweep_time = time.time()
    print(f"☁️ همگام‌ساز خودکار به حافظه ابری نئون فعال شد (بافر نگهداری: {S3_KEEP_SEGMENTS} سگمنت).")

    while not stop_event.is_set():
        # ۱. آپلود سگمنت‌های جدید به ترتیب شماره سگمنت
        local_ts_files = sorted(glob.glob("*.ts"), key=_segment_sort_key)
        for ts_file in local_ts_files:
            if ts_file not in uploaded_files and os.path.exists(ts_file):
                try:
                    s3_client.upload_file(
                        ts_file, BUCKET_NAME, ts_file,
                        ExtraArgs={
                            'ContentType': 'video/MP2T',
                            'CacheControl': 'no-cache, no-store, must-revalidate, max-age=0'
                        }
                    )
                    uploaded_files.add(ts_file)
                    uploaded_order.append(ts_file)
                except Exception as e:
                    print(f"⚠️ هشدار در آپلود سگمنت {ts_file}: {e}")

        # ۲. آپلود مداوم پلی‌لیست live.m3u8
        if os.path.exists("live.m3u8"):
            try:
                s3_client.upload_file(
                    "live.m3u8", BUCKET_NAME, "live.m3u8",
                    ExtraArgs={
                        'ContentType': 'application/vnd.apple.mpegurl',
                        'CacheControl': 'no-cache, no-store, must-revalidate, max-age=0'
                    }
                )
            except Exception as e:
                print(f"⚠️ هشدار در آپلود پلی‌لیست live.m3u8: {e}")

        # ۳. حذف لغزان سگمنت‌های خارج از مجموعهٔ نگهداری (پلی‌لیست فعلی + بافر S3_KEEP_SEGMENTS)
        try:
            playlist_segments = _read_playlist_segments("live.m3u8")
            keep_set = compute_retention_set(playlist_segments, uploaded_order, S3_KEEP_SEGMENTS)
            candidates_to_delete = [
                seg for seg in uploaded_order
                if seg not in keep_set and seg != "live.m3u8"
            ]
            if candidates_to_delete:
                deleted_keys = _delete_s3_keys_batched(candidates_to_delete, context_label="حذف لغزان سگمنت‌ها")
                if deleted_keys:
                    uploaded_order = [seg for seg in uploaded_order if seg not in deleted_keys]
                    uploaded_files.difference_update(deleted_keys)
        except Exception as e:
            print(f"⚠️ هشدار در چرخهٔ حذف لغزان: {e}")

        # ۴. جاروب امنیتی دوره‌ای باکت (هر ۶۰ ثانیه)
        now = time.time()
        if now - last_sweep_time >= S3_SWEEP_INTERVAL_SECONDS:
            _periodic_bucket_sweep(uploaded_order)
            last_sweep_time = time.time()

        time.sleep(0.5)

def main():
    parser = argparse.ArgumentParser(description="Live Webpage M3U8 Streamer to Neon S3")
    parser.add_argument('--quality', default='720p', help="Stream quality resolution")
    parser.add_argument('--fps', default=30, type=int, help="Frames per second")
    parser.add_argument('--duration', default=60, type=int, help="Duration in minutes")
    parser.add_argument('--url', default='', help="Target URL to capture")
    args = parser.parse_args()

    target_web_url = (args.url or TARGET_URL).strip()
    if not target_web_url:
        print("❌ خطا: آدرس تارگت (URL) در پنل سوپر ادمین ثبت/ذخیره نشده است و آدرسی دریافت نگردید.")
        sys.exit(1)

    qualities = {
        '240p': ('426x240', 426, 240, '500k'),
        '360p': ('640x360', 640, 360, '800k'),
        '480p': ('854x480', 854, 480, '1200k'),
        '720p': ('1280x720', 1280, 720, '2500k'),
        '1080p': ('1920x1080', 1920, 1080, '3500k'),
        '1440p': ('2560x1440', 2560, 1440, '3500k')
    }
    resolution_str, width, height, bitrate = qualities.get(args.quality, qualities['720p'])
    fps = args.fps

    # ۱. پاک‌سازی اولیه فایل‌های لوکال و باکت نئون
    for f in glob.glob("*.ts") + glob.glob("*.m3u8"):
        try: os.remove(f)
        except: pass
    purge_bucket()

    # ۲. ایجاد مانیتور مجازی دقیقاً به ابعاد رزولوشن انتخاب‌شده
    os.environ["DISPLAY"] = ":99"
    subprocess.Popen(['Xvfb', ':99', '-screen', '0', f'{width}x{height}x24', '-ac'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)

    # ۳. آماده‌سازی پروفایل کاربری کروم، حذف اعلان‌ها، حذف نوار ترجمه و پنجره اولیه
    profile_dir = f"/tmp/clean_chrome_profile_{width}x{height}"
    default_dir = os.path.join(profile_dir, "Default")
    os.makedirs(default_dir, exist_ok=True)
    
    try:
        with open(os.path.join(profile_dir, "First Run"), "w") as f:
            f.write("")
    except Exception:
        pass

    prefs = {
        "translate": {"enabled": False},
        "translate_blocked_languages": ["fa", "en", "ar", "und"],
        "intl": {"accept_languages": "fa,en-US,en"},
        "profile": {
            "default_content_setting_values": {
                "notifications": 2
            }
        }
    }
    with open(os.path.join(default_dir, "Preferences"), "w") as f:
        json.dump(prefs, f)

    browser_executable = shutil.which('google-chrome') or shutil.which('chromium-browser') or shutil.which('chromium') or 'google-chrome'

    # ۴. باز کردن آدرس آنلاین به صورت تمام‌صفحه و کاملاً تمیز
    chrome_cmd = [
        browser_executable,
        '--kiosk',
        '--no-sandbox',
        '--disable-infobars',
        '--disable-dev-shm-usage',
        '--disable-translate',
        '--disable-features=Translate,OptimizationHints,MediaRouter,CalculateNativeWinOcclusion,PrivacySandboxSettings4',
        '--no-first-run',
        '--no-default-browser-check',
        '--hide-scrollbars',
        '--window-position=0,0',
        f'--window-size={width},{height}',
        f'--user-data-dir={profile_dir}',
        '--autoplay-policy=no-user-gesture-required',
        target_web_url
    ]
    subprocess.Popen(chrome_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(5)  # زمان لازم برای لود کامل صفحه اینترنتی و برقراری ارتباطات

    # ۵. ضبط تصویر و صدا مطابق با «استاندارد طلایی سازگاری LG webOS»
    # مشخصات ویدیویی: H.264 Main Profile L4.0 / keyint هر ۲ ثانیه‌ / sc_threshold 0
    # مشخصات صوتی: AAC-LC 128k 48kHz Stereo / چانک‌های MPEG-TS با طول ۴ ثانیه
    gop_size = str(fps * 2)  # کلیدفریم دقیقاً هر ۲ ثانیه (GOP = fps * 2)

    ffmpeg_cmd = [
        'ffmpeg', '-y',
        '-f', 'x11grab',
        '-draw_mouse', '0',
        '-video_size', f'{width}x{height}',
        '-framerate', str(fps),
        '-i', ':99.0',
        '-f', 'lavfi',
        '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
        '-c:v', 'libx264',
        '-profile:v', 'main',
        '-level', '4.0',
        '-preset', 'fast',
        '-b:v', bitrate,
        '-maxrate', bitrate,
        '-bufsize', '5000k',
        '-pix_fmt', 'yuv420p',
        '-g', gop_size,
        '-keyint_min', gop_size,
        '-sc_threshold', '0',
        '-c:a', 'aac',
        '-profile:a', 'aac_low',
        '-b:a', '128k',
        '-ar', '48000',
        '-ac', '2',
        '-f', 'hls',
        '-hls_time', '4',
        '-hls_list_size', '7',
        '-hls_segment_type', 'mpegts',
        '-hls_flags', 'delete_segments',
        'live.m3u8'
    ]
    ffmpeg_proc = subprocess.Popen(ffmpeg_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # ۶. فعال‌سازی آپلود به نئون
    stop_event = threading.Event()
    uploader_thread = threading.Thread(target=s3_sync_worker, args=(stop_event,), daemon=True)
    uploader_thread.start()

    neon_stream_url = f"{S3_ENDPOINT}/{BUCKET_NAME}/live.m3u8"
    print("\n" + "="*60)
    print(f"🚀 استریم صفحه آنلاین در کیفیت {args.quality} ({width}x{height}) آغاز شد!")
    print("📺 تنظیمات استاندارد طلایی سازگاری با تلویزیون‌های LG (webOS) فعال است:")
    print("   • کدک ویدیو: H.264 Main Profile @ Level 4.0 (Constrained VBR)")
    print(f"   • کلید فریم (GOP): هر ۲ ثانیه یک کلیدفریم (keyint={gop_size})")
    print("   • کدک صدا: AAC-LC Stereo 128kbps @ 48kHz")
    print("   • بسته بندی HLS: چانک های MPEG-TS با طول ۴ ثانیه")
    print(f"🌐 آدرس در حال پخش: {target_web_url}")
    print(f"🔗 آدرس خروجی استریم: {neon_stream_url}")
    print("="*60 + "\n")

    def cleanup_and_exit(signum=None, frame=None):
        print("\n🛑 دستور توقف دریافت شد. در حال قطع استریم...")
        stop_event.set()
        try:
            ffmpeg_proc.terminate()
        except:
            pass
        purge_bucket()
        print("✅ استریم متوقف و باکت نئون تخلیه شد.")
        sys.exit(0)

    signal.signal(signal.SIGINT, cleanup_and_exit)
    signal.signal(signal.SIGTERM, cleanup_and_exit)

    end_time = time.time() + (args.duration * 60)
    while time.time() < end_time:
        time.sleep(1)

    cleanup_and_exit()

if __name__ == "__main__":
    main()
