import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, ScanFace, Info, X, ShieldHalf } from 'lucide-react';
import { HELMETS, getHelmet } from '../data/helmets.js';
import { HELMET_SIZES, preloadHelmet } from '../lib/helmetLoader.js';
import { ArEngine } from '../lib/arEngine.js';
import { openFrontCamera, describeCameraError } from '../lib/camera.js';
import { HelmetThumb } from '../components/HelmetPreview.jsx';

const STATUS_TEXT = {
  starting: 'Starting camera…',
  'loading-tracker': 'Loading face tracker…',
  searching: 'Looking for your face',
  holding: 'Hold steady…',
  tracking: 'Face locked',
};

const VISOR_MODES = [
  { id: 'smoked', label: 'Smoked' },
  { id: 'up', label: 'Up' },
  { id: 'down', label: 'Tinted' },
];

/** Optional test input instead of the camera: ?src=/path/to/face.jpg (or .mp4) before the #. */
function getTestSource() {
  const src = new URLSearchParams(window.location.search).get('src');
  return src && src.startsWith('/') ? src : null;
}

export default function TryOnScreen({ helmetId, navigate }) {
  const helmet = getHelmet(helmetId);
  const testSrc = getTestSource();
  const isTestImage = testSrc && !/\.(mp4|webm|mov)$/i.test(testSrc);

  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRef = useRef(null);
  const engineRef = useRef(null);

  const [status, setStatus] = useState('starting');
  const [fps, setFps] = useState(0);
  const [error, setError] = useState(null);
  const [needsTap, setNeedsTap] = useState(false);
  const [helmetLoading, setHelmetLoading] = useState(true);
  const [showMesh, setShowMesh] = useState(true);
  const [sizeId, setSizeId] = useState('M');
  const [visor, setVisor] = useState('smoked');
  const [showInfo, setShowInfo] = useState(false);
  const [flash, setFlash] = useState(false);
  const [toast, setToast] = useState('');

  const sizeScale = HELMET_SIZES.find((s) => s.id === sizeId)?.scale ?? 1;

  // Camera (or test media) + engine lifecycle.
  useEffect(() => {
    let cancelled = false;
    let stream = null;

    (async () => {
      try {
        const media = mediaRef.current;
        if (testSrc) {
          media.src = testSrc;
          if (media instanceof HTMLVideoElement) { media.loop = true; await media.play().catch(() => {}); }
          await new Promise((res) => (media.complete || media.readyState >= 2 ? res() : media.addEventListener(media instanceof HTMLVideoElement ? 'loadeddata' : 'load', res, { once: true })));
        } else {
          stream = await openFrontCamera();
          if (cancelled) return stream.getTracks().forEach((t) => t.stop());
          media.srcObject = stream;
          await new Promise((res) => (media.readyState >= 1 ? res() : media.addEventListener('loadedmetadata', res, { once: true })));
          try { await media.play(); } catch { setNeedsTap(true); }
        }
        if (cancelled) return;

        const engine = new ArEngine({
          container: containerRef.current,
          stage: stageRef.current,
          canvas: canvasRef.current,
          media,
          onStatus: setStatus,
          onFps: setFps,
        });
        engineRef.current = engine;
        if (import.meta.env.DEV) window.__ar = engine;
        await engine.start();
      } catch (err) {
        console.error(err);
        if (!cancelled) setError(describeCameraError(err));
      }
    })();

    return () => {
      cancelled = true;
      engineRef.current?.dispose();
      engineRef.current = null;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [testSrc]);

  // Load / switch helmet.
  useEffect(() => {
    let alive = true;
    setHelmetLoading(true);
    const waitForEngine = async () => {
      while (alive && !engineRef.current) await new Promise((r) => setTimeout(r, 50));
      if (!alive) return;
      await engineRef.current.setHelmet(helmet, { sizeScale, visor });
      if (alive) setHelmetLoading(false);
    };
    waitForEngine().catch((err) => {
      console.error(err);
      if (alive) setToast('Could not load this helmet model');
    });
    // Warm the cache for the others so switching is instant.
    HELMETS.filter((h) => h.id !== helmet.id).forEach(preloadHelmet);
    return () => { alive = false; };
    // sizeScale/visor are applied live below; only reload on helmet change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [helmet.id]);

  useEffect(() => { engineRef.current?.setSize(sizeScale); }, [sizeScale]);
  useEffect(() => { engineRef.current?.setVisor(visor); }, [visor]);
  useEffect(() => { engineRef.current?.setMeshVisible(showMesh); }, [showMesh]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const takeSnapshot = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    setFlash(true);
    setTimeout(() => setFlash(false), 250);
    const blob = await engine.snapshot();
    if (!blob) return;
    const file = new File([blob], `${helmet.brand}-${helmet.model}-tryon.png`.replace(/\s+/g, '-'), { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: `${helmet.brand} ${helmet.model}` }); return; } catch { /* fall back to download */ }
    }
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
    a.click();
    URL.revokeObjectURL(url);
    setToast('Photo saved');
  }, [helmet]);

  const tracking = status === 'tracking' || status === 'holding';
  const booting = status === 'starting' || status === 'loading-tracker';

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-clip bg-black select-none">
      {/* Stage: video + 3D canvas share one box, mirrored together for the selfie view. */}
      <div ref={stageRef} className="absolute" style={{ transform: 'scaleX(-1)' }}>
        {isTestImage ? (
          <img ref={mediaRef} alt="" className="absolute inset-0 w-full h-full" />
        ) : (
          <video ref={mediaRef} playsInline muted autoPlay className="absolute inset-0 w-full h-full" />
        )}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      </div>

      {flash && <div className="absolute inset-0 z-50 bg-white animate-shutter-flash pointer-events-none" />}

      {/* Top bar */}
      <header className="absolute top-0 inset-x-0 z-20 flex items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-6 bg-gradient-to-b from-black/80 to-transparent">
        <button onClick={() => navigate('/catalog')} aria-label="Back to catalog"
          className="w-10 h-10 grid place-items-center rounded-full bg-white/10 backdrop-blur border border-white/10 active:scale-95">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.2em]" style={{ color: helmet.accent }}>{helmet.brand}</p>
          <h1 className="text-base font-semibold truncate">{helmet.model}</h1>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border backdrop-blur ${
          tracking ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300' : 'bg-white/10 border-white/15 text-zinc-300'}`}>
          <span className={`w-2 h-2 rounded-full ${tracking ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
          {STATUS_TEXT[status]}
          {tracking && fps > 0 && <span className="text-[10px] text-emerald-200/60 tabular-nums">{fps} fps</span>}
        </div>
      </header>

      {/* Side tools */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2">
        <ToolButton active={showMesh} onClick={() => setShowMesh((v) => !v)} label="Face mesh"><ScanFace className="w-5 h-5" /></ToolButton>
        {helmet.visor && (
          <ToolButton active={visor !== 'down'} label={`Visor: ${VISOR_MODES.find((v) => v.id === visor).label}`}
            onClick={() => setVisor((v) => VISOR_MODES[(VISOR_MODES.findIndex((m) => m.id === v) + 1) % VISOR_MODES.length].id)}>
            <ShieldHalf className="w-5 h-5" />
          </ToolButton>
        )}
        <ToolButton active={showInfo} onClick={() => setShowInfo((v) => !v)} label="Helmet info"><Info className="w-5 h-5" /></ToolButton>
      </div>

      {/* Face guide while searching */}
      {status === 'searching' && !error && (
        <div className="absolute inset-0 z-10 grid place-items-center pointer-events-none">
          <div className="w-60 h-80 rounded-[50%] border-2 border-dashed border-cyan-300/50 animate-pulse grid place-items-center">
            <span className="text-xs bg-black/50 px-3 py-1 rounded-full text-cyan-100">Centre your face</span>
          </div>
        </div>
      )}

      {/* Bottom controls */}
      <footer className="absolute bottom-0 inset-x-0 z-20 px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-10 bg-gradient-to-t from-black/85 via-black/50 to-transparent">
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="text-[11px] text-zinc-400 mr-1">Size</span>
          {HELMET_SIZES.map((s) => (
            <button key={s.id} onClick={() => setSizeId(s.id)} title={`Head ${s.headCm} cm`}
              className={`w-10 h-8 rounded-lg text-xs font-semibold border transition ${sizeId === s.id ? 'bg-white text-black border-white' : 'bg-white/5 border-white/15 text-zinc-200'}`}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 flex gap-2 overflow-x-auto no-scrollbar">
            {HELMETS.map((h) => (
              <button key={h.id} onClick={() => navigate(`/try/${h.id}`)}
                className={`shrink-0 w-16 rounded-xl p-1 border transition ${h.id === helmet.id ? 'border-white bg-white/15' : 'border-white/10 bg-white/5'}`}>
                <HelmetThumb helmet={h} className="w-full aspect-square rounded-lg" />
                <span className="block text-[10px] mt-0.5 truncate text-zinc-200">{h.brand}</span>
              </button>
            ))}
          </div>
          <button onClick={takeSnapshot} disabled={!tracking} aria-label="Take photo"
            className="shrink-0 w-16 h-16 rounded-full border-4 border-white grid place-items-center bg-white/20 disabled:opacity-40 active:scale-95 transition">
            <Camera className="w-6 h-6" />
          </button>
        </div>
      </footer>

      {/* Helmet info sheet */}
      {showInfo && (
        <div className="absolute inset-x-3 bottom-44 z-30 rounded-2xl bg-zinc-950/90 border border-white/10 backdrop-blur-xl p-4 text-sm">
          <button onClick={() => setShowInfo(false)} className="absolute right-3 top-3 text-zinc-400" aria-label="Close"><X className="w-4 h-4" /></button>
          <p className="text-[11px] uppercase tracking-[0.2em]" style={{ color: helmet.accent }}>{helmet.category}</p>
          <h2 className="font-semibold mt-0.5">{helmet.brand} {helmet.model}</h2>
          <p className="text-zinc-400 text-xs mt-1">{helmet.tagline}</p>
          <ul className="mt-2 space-y-0.5 text-xs text-zinc-300">{helmet.features.map((f) => <li key={f}>• {f}</li>)}</ul>
          <p className="mt-3 text-[10px] text-zinc-500">
            3D model by <a className="underline" href={helmet.credit.url} target="_blank" rel="noreferrer">{helmet.credit.author}</a> · {helmet.credit.license}
          </p>
        </div>
      )}

      {/* Loading */}
      {(booting || helmetLoading) && !error && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black/70 backdrop-blur-sm pointer-events-none">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto rounded-full border-4 border-white/15 border-t-cyan-400 animate-spin" />
            <p className="mt-4 text-sm text-zinc-200">{booting ? STATUS_TEXT[status] : `Loading ${helmet.brand} ${helmet.model}…`}</p>
          </div>
        </div>
      )}

      {needsTap && (
        <button onClick={async () => { await mediaRef.current?.play(); setNeedsTap(false); }}
          className="absolute inset-0 z-50 bg-black/80 grid place-items-center text-sm">Tap to start the camera</button>
      )}

      {error && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-black/90 p-6">
          <div className="max-w-sm text-center rounded-2xl border border-red-400/30 bg-zinc-950 p-6">
            <h2 className="font-semibold">{error.title}</h2>
            <p className="text-sm text-zinc-400 mt-2">{error.body}</p>
            <div className="flex gap-2 justify-center mt-5">
              <button onClick={() => navigate('/catalog')} className="px-4 py-2 rounded-xl bg-white/10 text-sm">Back</button>
              <button onClick={() => window.location.reload()} className="px-4 py-2 rounded-xl bg-white text-black text-sm font-semibold">Retry</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-zinc-900/90 border border-white/10 text-xs">{toast}</div>
      )}
    </div>
  );
}

function ToolButton({ active, onClick, label, children }) {
  return (
    <button onClick={onClick} aria-label={label} title={label}
      className={`w-11 h-11 grid place-items-center rounded-full border backdrop-blur transition active:scale-95 ${
        active ? 'bg-cyan-400 text-black border-cyan-300' : 'bg-black/40 text-white border-white/15'}`}>
      {children}
    </button>
  );
}
