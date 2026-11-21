import React, { useState } from 'react';
import { ArrowLeft, ScanFace } from 'lucide-react';
import { HELMETS } from '../data/helmets.js';
import { HelmetTurntable } from '../components/HelmetPreview.jsx';

export default function CatalogScreen({ navigate }) {
  const brands = ['All', ...new Set(HELMETS.map((h) => h.brand))];
  const [brand, setBrand] = useState('All');
  const list = brand === 'All' ? HELMETS : HELMETS.filter((h) => h.brand === brand);

  return (
    <div className="w-full h-full overflow-y-auto bg-black">
      <header className="sticky top-0 z-10 bg-black/80 backdrop-blur-xl border-b border-white/5 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} aria-label="Back"
              className="w-10 h-10 grid place-items-center rounded-full bg-white/10 border border-white/10 active:scale-95">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Helmet catalog</h1>
              <p className="text-xs text-zinc-400">Tap a helmet to try it on in AR</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
            {brands.map((b) => (
              <button key={b} onClick={() => setBrand(b)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium border transition ${
                  brand === b ? 'bg-white text-black border-white' : 'bg-white/5 text-zinc-300 border-white/10'}`}>
                {b}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {list.map((h) => (
          <article key={h.id}
            className="group rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900 to-zinc-950 overflow-hidden flex flex-col">
            <button onClick={() => navigate(`/try/${h.id}`)} className="relative block text-left" aria-label={`Try on ${h.brand} ${h.model}`}>
              <div className="absolute inset-0 opacity-40" style={{ background: `radial-gradient(circle at 50% 60%, ${h.accent}55, transparent 65%)` }} />
              <HelmetTurntable helmet={h} className="aspect-square w-full" />
              <span className="absolute left-3 top-3 text-[10px] px-2 py-1 rounded-full bg-black/60 border border-white/10 text-zinc-200">{h.category}</span>
            </button>
            <div className="p-4 pt-1 flex-1 flex flex-col">
              <p className="text-[11px] uppercase tracking-[0.2em] font-semibold" style={{ color: h.accent }}>{h.brand}</p>
              <h2 className="text-lg font-semibold">{h.model}</h2>
              <p className="text-xs text-zinc-400 mt-1">{h.tagline}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {h.features.map((f) => (
                  <span key={f} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-300">{f}</span>
                ))}
              </div>
              <div className="flex-1" />
              <button onClick={() => navigate(`/try/${h.id}`)}
                className="mt-4 w-full py-3 rounded-xl bg-white text-black text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition">
                <ScanFace className="w-4 h-4" /> Try on in AR
              </button>
              <p className="mt-2 text-[10px] text-zinc-600">
                3D model: <a href={h.credit.url} target="_blank" rel="noreferrer" className="underline">{h.credit.author}</a> · {h.credit.license}
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
