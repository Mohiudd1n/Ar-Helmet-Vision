import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ScanFace, Box, Ruler } from 'lucide-react';
import { HELMETS } from '../data/helmets.js';
import { preloadHelmet } from '../lib/helmetLoader.js';
import { HelmetTurntable } from '../components/HelmetPreview.jsx';

const NAME_KEY = 'helmetvision:name';

function greetingFor(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'Riding late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function WelcomeScreen({ navigate }) {
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) || '');
  const [editing, setEditing] = useState(false);
  const greeting = useMemo(() => greetingFor(), []);
  const hero = {
    id: 'elementza-hero',
    brand: 'Elementza',
    model: 'Racer Full-Face',
    modelUrl: '/models/helmet4.glb',
    fit: { rotation: [0, 0, 0], width: 25, center: [0, -0.3, -2.5] },
  };

  useEffect(() => {
    // Start fetching the lighter models while the user reads the greeting.
    [...HELMETS].sort((a, b) => a.sizeMb - b.sizeMb).forEach(preloadHelmet);
  }, []);

  const saveName = (value) => {
    const clean = value.trim().slice(0, 24);
    setName(clean);
    if (clean) localStorage.setItem(NAME_KEY, clean); else localStorage.removeItem(NAME_KEY);
  };

  return (
    <div className="relative w-full h-full overflow-y-auto bg-[radial-gradient(ellipse_at_top,_#1e293b_0%,_#000_65%)]">
      <div className="mx-auto max-w-md min-h-full flex flex-col px-6 pt-[max(env(safe-area-inset-top),24px)] pb-[max(env(safe-area-inset-bottom),24px)]">
        <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 grid place-items-center text-black"><ScanFace className="w-4 h-4" /></span>
          HelmetVision <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-cyan-400/40 text-cyan-300">AR</span>
        </div>

        <div className="mt-10">
          <p className="text-zinc-400 text-sm">{greeting},</p>
          {editing ? (
            <form onSubmit={(e) => { e.preventDefault(); saveName(e.currentTarget.elements.name.value); setEditing(false); }} className="mt-1 flex gap-2">
              <input name="name" autoFocus defaultValue={name} placeholder="Your name" maxLength={24}
                className="flex-1 bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-2xl font-bold outline-none focus:border-cyan-400" />
              <button className="px-3 rounded-xl bg-white text-black text-sm font-semibold">Save</button>
            </form>
          ) : (
            <button onClick={() => setEditing(true)} className="text-left">
              <h1 className="text-4xl font-bold leading-tight">{name || 'Rider'} <span className="inline-block animate-wave">👋</span></h1>
              <span className="text-[11px] text-zinc-500">{name ? 'Tap to change your name' : 'Tap to tell us your name'}</span>
            </button>
          )}
          <p className="mt-4 text-zinc-300 leading-relaxed">
            Find your next helmet. See real 3D models from {HELMETS.length} brands on your own head, live through your camera.
          </p>
        </div>

        <HelmetTurntable helmet={hero} className="mt-6 w-full aspect-square max-h-[42vh] mx-auto" startAngle={-0.4} />

        <ul className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px] text-zinc-400">
          <li className="rounded-xl bg-white/5 border border-white/10 py-3"><Box className="w-4 h-4 mx-auto mb-1 text-cyan-300" />Real 3D models</li>
          <li className="rounded-xl bg-white/5 border border-white/10 py-3"><ScanFace className="w-4 h-4 mx-auto mb-1 text-cyan-300" />Live face tracking</li>
          <li className="rounded-xl bg-white/5 border border-white/10 py-3"><Ruler className="w-4 h-4 mx-auto mb-1 text-cyan-300" />S – XL sizing</li>
        </ul>

        <div className="flex-1" />
        <button onClick={() => navigate('/catalog')}
          className="mt-8 w-full py-4 rounded-2xl bg-white text-black font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition">
          Explore helmets <ArrowRight className="w-5 h-5" />
        </button>
        <p className="mt-3 text-center text-[11px] text-zinc-500">Camera images stay on your device.</p>
      </div>
    </div>
  );
}
