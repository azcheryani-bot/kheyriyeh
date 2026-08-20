
import React, { useState, useEffect, useMemo, memo } from 'react';
import { dbApi } from '../db-client';
import { Donation, DisplaySettings } from '../types';

const DEFAULT_SETTINGS: DisplaySettings = {
  fontSize: 40,
  scrollSpeed: 20,
  fontSizeHigh: 64,
  fontSizeMid: 48,
  fontSizeLow: 36,
  speedHigh: 14,
  speedMid: 20,
  speedLow: 24,
  highThreshold: 5000000,
  midThreshold: 1000000,
  fontHigh: 'Vazirmatn',
  fontMid: 'Vazirmatn',
  fontLow: 'Vazirmatn',
  showAnnouncement: false,
  eventTitle: 'مراسم ترحیم',
  titleColor: '#ffffff',
  titleSize: 3.5,
  deceasedLabel: 'شادروان',
  deceasedLabelColor: '#fef3c7',
  deceasedLabelSize: 12,
  footerText: 'شادی روح درگذشتگان صلوات',
  footerColor: '#ffffff',
  footerSize: 14,
};

const MarqueeRow = memo(({ list, speed, fontSize, font, heightClass, colorClass }: { 
  list: Donation[]; 
  speed: number; 
  fontSize: number; 
  font: string;
  heightClass: string;
  colorClass: string;
}) => {
  if (!list || list.length === 0) {
    return (
      <div className={`${heightClass} w-full flex items-center justify-center border-b border-white/5 bg-black/10 backdrop-blur-sm`}>
        <span className="text-white/20 text-lg font-bold italic animate-pulse">...</span>
      </div>
    );
  }

  // تکرار آیتم‌ها برای پر کردن صفحه و ایجاد حلقه نرم
  let items = [...list];
  const MIN_ITEMS = 40; 
  while (items.length < MIN_ITEMS) {
    items = [...items, ...list];
  }

  // لیست نهایی شامل دو سری از آیتم‌هاست
  const renderList = [...items, ...items];
  
  // محاسبه زمان انیمیشن
  const duration = (renderList.length * 120) / (speed || 20);

  return (
    // dir="ltr" is crucial here for correct calculate of translateX(-50%) to 0%
    <div className={`${heightClass} w-full border-b border-white/10 relative overflow-hidden flex items-center ${colorClass} backdrop-blur-sm shadow-lg`} dir="ltr">
      <div 
        className="flex w-max will-change-transform items-center"
        style={{ 
          animation: `scrollSeamless ${duration}s linear infinite`,
        }}
      >
        {renderList.map((item, index) => (
          <div 
            key={`${item.id}-${index}`} 
            className="flex flex-col items-center justify-center px-6 md:px-10 mx-2 py-2 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-xl flex-shrink-0"
            style={{ fontFamily: font, minWidth: 'fit-content' }}
          >
            <span 
              className="font-bold whitespace-nowrap drop-shadow-lg text-yellow-50"
              style={{ fontSize: `${fontSize}px`, lineHeight: '1.4' }}
            >
              {item.donorName}
            </span>
            {item.fatherName && (
              <span 
                className="text-white/90 font-light mt-0.5 whitespace-nowrap tracking-wide"
                style={{ fontSize: `${fontSize * 0.55}px` }}
              >
                ({item.fatherName})
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.speed === nextProps.speed &&
    prevProps.fontSize === nextProps.fontSize &&
    prevProps.font === nextProps.font &&
    prevProps.heightClass === nextProps.heightClass &&
    prevProps.colorClass === nextProps.colorClass &&
    JSON.stringify(prevProps.list) === JSON.stringify(nextProps.list)
  );
});

export const DisplayCore: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [settings, setSettings] = useState<DisplaySettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eventData, configData] = await Promise.all([
          dbApi.events.getActive(),
          dbApi.config.get('displaySettings')
        ]);

        setActiveEventId(eventData?.id || 'active');

        setSettings(prev => {
          const configVal = (configData?.value && typeof configData.value === 'object') ? configData.value : {};
          
          // Prioritize active event title if present, otherwise fallback to stored config title or default
          const effectiveTitle = eventData?.title || configVal.eventTitle || prev.eventTitle || DEFAULT_SETTINGS.eventTitle;

          const nextSettings: DisplaySettings = {
            ...prev,
            ...configVal,
            eventTitle: effectiveTitle,
          };

          if (JSON.stringify(prev) === JSON.stringify(nextSettings)) {
            return prev;
          }
          return nextSettings;
        });
      } catch (e) {
        console.error("Fetch data error:", e);
      }
    };

    fetchData();
    const unsubscribe = dbApi.subscribe(() => {
      fetchData();
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Check if FontFace is supported (for older WebOS browsers)
    if (settings.customFontData && typeof FontFace !== 'undefined') {
        try {
            const fontFace = new FontFace('CustomUploaded', `url(${settings.customFontData})`);
            fontFace.load().then(loadedFace => {
                // Check if document.fonts exists
                if (document.fonts) {
                    document.fonts.add(loadedFace);
                }
            }).catch(e => console.error("Font load failed:", e));
        } catch(e) { console.error("FontFace error:", e); }
    }
  }, [settings.customFontData]);

  useEffect(() => {
    const fetchDonations = async () => {
      try {
        const data = await dbApi.donations.getApprovedByEvent(activeEventId || 'active');
        if (Array.isArray(data)) {
          setDonations(prev => {
            if (JSON.stringify(prev) === JSON.stringify(data)) {
              return prev;
            }
            return data;
          });
        }
      } catch (e) {}
    };
    fetchDonations();

    const unsubscribe = dbApi.subscribe(() => {
      fetchDonations();
    });
    return () => {
      unsubscribe();
    };
  }, [activeEventId]);

  const tiers = useMemo(() => {
    const visibleDonations = donations.filter(d => !d.hideName);
    return {
      high: visibleDonations.filter(d => d.amount >= settings.highThreshold),
      mid: visibleDonations.filter(d => d.amount < settings.highThreshold && d.amount >= settings.midThreshold),
      low: visibleDonations.filter(d => d.amount < settings.midThreshold)
    };
  }, [donations, settings.highThreshold, settings.midThreshold]);

  if (settings.showAnnouncement && settings.announcementImage) {
    return (
      <div className="fixed inset-0 bg-black z-[9999] flex items-center justify-center">
        <button onClick={onExit} className="absolute top-4 left-4 text-white/50 hover:text-white z-50 p-4"><i className="fas fa-times text-2xl"></i></button>
        <img src={settings.announcementImage} className="max-w-full max-h-full object-contain" alt="Announcement" />
      </div>
    );
  }

  const fontScale = isMobile ? 0.5 : 1;
  const speedHigh = settings.speedHigh ?? Math.round((settings.scrollSpeed || 20) * 0.7);
  const speedMid = settings.speedMid ?? (settings.scrollSpeed || 20);
  const speedLow = settings.speedLow ?? Math.round((settings.scrollSpeed || 20) * 1.2);

  const fontSizeHigh = (settings.fontSizeHigh ?? Math.round((settings.fontSize || 40) * 1.6)) * fontScale;
  const fontSizeMid = (settings.fontSizeMid ?? Math.round((settings.fontSize || 40) * 1.2)) * fontScale;
  const fontSizeLow = (settings.fontSizeLow ?? Math.round((settings.fontSize || 40) * 0.9)) * fontScale;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-950 font-sans select-none" dir="ltr">
      
      {/* دکمه خروج کوچک و قابل مشاهده */}
      <button 
        onClick={onExit} 
        className="absolute top-3 left-3 z-[100] w-8 h-8 flex items-center justify-center rounded-full bg-black/30 text-white/40 hover:bg-red-600 hover:text-white transition-all duration-300 backdrop-blur-sm border border-white/5 shadow-lg cursor-pointer" 
        title="خروج از حالت نمایشگر"
      >
        <i className="fas fa-times text-xs"></i>
      </button>

      {/* Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center z-0 transition-all duration-1000 opacity-60"
        style={{ backgroundImage: settings.bgImage ? `url(${settings.bgImage})` : 'none' }}
      ></div>
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-900/50 to-slate-900 z-0"></div>

      <div className="relative z-10 flex flex-col h-full" dir="rtl">
        
        {/* Header Section */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 md:px-12 py-4 h-[25vh] md:h-[28vh] border-b border-white/5 bg-black/20 backdrop-blur-sm">
          <div className="flex flex-col justify-center h-full max-w-[70%]">
            <h1 
              className="font-black drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] border-r-8 border-yellow-500 pr-6 transition-all duration-300 break-words leading-tight"
              style={{ 
                color: settings.titleColor, 
                fontSize: `${isMobile ? Math.max(1.5, settings.titleSize * 0.6) : settings.titleSize}rem`,
              }}
            >
              {settings.eventTitle}
            </h1>
          </div>

          {settings.deceasedImage && (
            <div className="h-full py-2 flex items-center">
              <div className="h-[90%] aspect-[3/4] relative rounded-2xl overflow-hidden shadow-[0_0_30px_rgba(234,179,8,0.3)] ring-4 ring-yellow-500/80 bg-slate-800">
                 <img src={settings.deceasedImage} className="w-full h-full object-cover" alt="Deceased" />
                 <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/70 to-transparent pt-8 pb-2 text-center">
                    <span 
                      className="font-bold drop-shadow-md"
                      style={{ color: settings.deceasedLabelColor, fontSize: `${isMobile ? 12 : settings.deceasedLabelSize}px` }}
                    >
                      {settings.deceasedLabel}
                    </span>
                 </div>
              </div>
            </div>
          )}
        </div>

        {/* Marquee Lists */}
        <div className="flex-grow flex flex-col w-full min-h-0 bg-black/10">
          <MarqueeRow 
            list={tiers.high} 
            speed={speedHigh}
            fontSize={fontSizeHigh} 
            font={settings.fontHigh}
            heightClass="h-[38%]"
            colorClass="bg-gradient-to-r from-yellow-900/30 via-yellow-900/10 to-yellow-900/30 border-yellow-500/20"
          />
          <MarqueeRow 
            list={tiers.mid} 
            speed={speedMid} 
            fontSize={fontSizeMid} 
            font={settings.fontMid}
            heightClass="h-[32%]"
            colorClass="bg-gradient-to-r from-blue-900/30 via-blue-900/10 to-blue-900/30 border-blue-500/20"
          />
          <MarqueeRow 
            list={tiers.low} 
            speed={speedLow} 
            fontSize={fontSizeLow} 
            font={settings.fontLow}
            heightClass="h-[30%]"
            colorClass="bg-gradient-to-r from-slate-900/40 via-slate-800/20 to-slate-900/40 border-white/5"
          />
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 h-[7vh] flex items-center justify-center bg-black/80 backdrop-blur-md border-t border-white/10">
          <p 
            className="font-bold animate-pulse text-center px-4 drop-shadow-lg"
            style={{ color: settings.footerColor, fontSize: `${isMobile ? settings.footerSize * 0.8 : settings.footerSize}px` }}
          >
            {settings.footerText}
          </p>
        </div>

      </div>
    </div>
  );
};
