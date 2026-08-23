import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    Hls?: any;
  }
}

interface HlsPlayerProps {
  streamUrl: string;
  className?: string;
  autoPlay?: boolean;
  controls?: boolean;
  poster?: string;
  onStatusChange?: (status: { isPlaying: boolean; isReconnecting: boolean }) => void;
}

export const HlsPlayer: React.FC<HlsPlayerProps> = ({
  streamUrl,
  className = "w-full max-h-64 rounded-xl object-contain bg-black",
  autoPlay = true,
  controls = true,
  poster,
  onStatusChange
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);
  const reconnectTimerRef = useRef<any>(null);
  const watchdogTimerRef = useRef<any>(null);
  const lastTimeRef = useRef<number>(0);
  const freezeCountRef = useRef<number>(0);

  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  useEffect(() => {
    if (onStatusChange) {
      onStatusChange({ isPlaying: !isReconnecting, isReconnecting });
    }
  }, [isReconnecting, onStatusChange]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    let isDestroyed = false;

    // Helper function to check if stream endpoint is live before re-attaching
    const checkAndReloadStream = async () => {
      if (isDestroyed) return;
      setIsReconnecting(true);
      setStatusMessage('در حال تلاش برای اتصال مجدد به جریان پخش زنده...');

      try {
        const testUrl = streamUrl + (streamUrl.includes('?') ? '&' : '?') + '_nocache=' + Date.now();
        const res = await fetch(testUrl, { method: 'HEAD', cache: 'no-store' });
        if (res.ok) {
          // Stream manifest is available again!
          setStatusMessage('استریم برقرار شد. در حال بارگذاری مجدد...');
          attachStream();
          return;
        }
      } catch (e) {
        // Stream not ready yet, continue polling
      }

      // Schedule next check in 2.5 seconds
      if (!isDestroyed) {
        reconnectTimerRef.current = setTimeout(checkAndReloadStream, 2500);
      }
    };

    const attachStream = () => {
      if (isDestroyed || !video) return;

      // Clean up existing Hls instance if any
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch(e) {}
        hlsRef.current = null;
      }

      const freshStreamUrl = streamUrl + (streamUrl.includes('?') ? '&' : '?') + '_t=' + Date.now();

      // Check if HLS.js is supported in window
      const HlsClass = window.Hls;
      if (HlsClass && HlsClass.isSupported()) {
        const hls = new HlsClass({
          enableWorker: true,
          lowLatencyMode: true,
          manifestLoadingTimeOut: 10000,
          manifestLoadingMaxRetry: Infinity, // Keep retrying manifest load
          manifestLoadingRetryDelay: 2000,
          levelLoadingTimeOut: 10000,
          levelLoadingMaxRetry: Infinity,
          fragLoadingTimeOut: 10000,
          fragLoadingMaxRetry: Infinity,
        });

        hlsRef.current = hls;
        hls.loadSource(freshStreamUrl);
        hls.attachMedia(video);

        hls.on(HlsClass.Events.MANIFEST_PARSED, () => {
          if (isDestroyed) return;
          setIsReconnecting(false);
          setStatusMessage('');
          if (autoPlay) {
            video.play().catch(() => {});
          }
        });

        hls.on(HlsClass.Events.ERROR, (_event: any, data: any) => {
          if (isDestroyed) return;

          if (data.fatal) {
            switch (data.type) {
              case HlsClass.ErrorTypes.NETWORK_ERROR:
                // Server down or network error - start background polling
                hls.stopLoad();
                checkAndReloadStream();
                break;
              case HlsClass.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                try {
                  hls.destroy();
                } catch(e) {}
                hlsRef.current = null;
                checkAndReloadStream();
                break;
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari / webOS native player)
        video.src = freshStreamUrl;
        
        const handleNativePlay = () => {
          if (isDestroyed) return;
          setIsReconnecting(false);
          setStatusMessage('');
        };

        const handleNativeError = () => {
          if (isDestroyed) return;
          checkAndReloadStream();
        };

        video.addEventListener('loadedmetadata', handleNativePlay);
        video.addEventListener('error', handleNativeError);
        video.addEventListener('stalled', handleNativeError);

        if (autoPlay) {
          video.play().catch(() => {});
        }
      } else {
        // Fallback for direct HTML5 video
        video.src = freshStreamUrl;
      }
    };

    // Initial attach
    attachStream();

    // Watchdog timer: check every 4s if video is playing but stuck/frozen
    watchdogTimerRef.current = setInterval(() => {
      if (isDestroyed || !video) return;

      if (!video.paused && !video.ended) {
        if (video.currentTime === lastTimeRef.current) {
          freezeCountRef.current += 1;
          if (freezeCountRef.current >= 2) {
            // Video is frozen for 8+ seconds while unpaused
            freezeCountRef.current = 0;
            checkAndReloadStream();
          }
        } else {
          freezeCountRef.current = 0;
          lastTimeRef.current = video.currentTime;
          setIsReconnecting(false);
        }
      }
    }, 4000);

    return () => {
      isDestroyed = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (watchdogTimerRef.current) clearInterval(watchdogTimerRef.current);
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch(e) {}
        hlsRef.current = null;
      }
    };
  }, [streamUrl, autoPlay]);

  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-black">
      <video
        ref={videoRef}
        controls={controls}
        playsInline
        poster={poster}
        className={className}
      >
        مرورگر شما از پخش ویدیو زنده پشتیبانی نمی‌کند.
      </video>

      {/* Auto-reconnect banner overlay */}
      {isReconnecting && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center z-10 transition-all">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2.5"></div>
          <span className="text-white text-xs font-bold animate-pulse">
            {statusMessage || 'در حال تلاش برای اتصال مجدد به پخش زنده...'}
          </span>
          <span className="text-slate-400 text-[10px] mt-1">
            (اتصال خودکار پس از وصل مجدد سرور - بدون نیاز به رفرش صفحه)
          </span>
        </div>
      )}
    </div>
  );
};
