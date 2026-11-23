import React, { useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import { HELMETS } from '../data/helmets.js';
import { preloadHelmet } from '../lib/helmetLoader.js';
import { warmTracker } from '../lib/assetCache.js';

/** HelmetAR logo mark: a helmet "visor" chevron in the spirit of the reference. */
function LogoMark({ className = 'w-9 h-9' }) {
  return (
    <svg viewBox="0 0 48 40" className={className} fill="currentColor" aria-hidden="true">
      <path d="M2 6 L14 2 L24 14 L34 2 L46 6 L40 24 L30 36 L24 28 L18 36 L8 24 Z" />
    </svg>
  );
}

export default function WelcomeScreen({ navigate }) {
  useEffect(() => {
    // Start fetching the lighter models while the user reads the headline.
    warmTracker();
    [...HELMETS].sort((a, b) => a.sizeMb - b.sizeMb).forEach(preloadHelmet);
  }, []);

  return (
    <div className="relative w-full h-full overflow-y-auto overflow-x-hidden text-neutral-900 bg-[linear-gradient(180deg,#6f6f72_0%,#a9a9ac_30%,#dcdcde_58%,#ececee_100%)]">
      <div className="mx-auto max-w-md min-h-full flex flex-col">
        {/* Helmet artwork with the headline tucked into its empty bottom-left corner */}
        <div className="relative">
          <img src="/helmet-hero.png" alt="" draggable="false" className="block w-full h-auto select-none pointer-events-none" />

          <header className="absolute top-0 left-0 flex items-center gap-2.5 px-6 pt-[max(env(safe-area-inset-top),24px)] text-white">
            <LogoMark />
            <span className="text-[26px] leading-none font-semibold tracking-[0.02em]">HelmetAR</span>
          </header>

          <h1 className="absolute left-6 -bottom-2 leading-[1.02] tracking-tight">
            <span className="block text-[30px] font-light text-neutral-500">Ride with</span>
            <span className="block text-[37px] font-bold text-neutral-950">Confidence</span>
          </h1>
        </div>

        <div className="px-6 pt-3">
          <p className="text-[13px] leading-snug text-neutral-700 max-w-[30ch]">
            Try real helmets on your own head, live through your camera.
          </p>
        </div>

        <div className="flex-1 min-h-4" />

        <div className="px-6 pt-4 pb-[max(env(safe-area-inset-bottom),20px)]">
          <button onClick={() => navigate('/catalog')}
            className="w-full h-14 rounded-full bg-[#d9431f] text-white text-sm font-medium tracking-[0.12em] uppercase flex items-center justify-center gap-2 active:scale-[0.98] transition">
            Get started <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
