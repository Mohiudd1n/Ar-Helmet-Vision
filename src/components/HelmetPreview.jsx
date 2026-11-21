import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createFittedHelmet, loadHelmetScene } from '../lib/helmetLoader.js';

/**
 * Live 3D previews of the real helmet models.
 *
 * Phones only allow a handful of WebGL contexts, so every preview on the page shares ONE
 * offscreen renderer: each frame it renders each visible helmet and copies the pixels into
 * that card's 2D canvas. Thumbnails are rendered once and cached as images.
 */

const RENDER_SIZE = 512;
let shared = null;

function getShared() {
  if (shared) return shared;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(RENDER_SIZE, RENDER_SIZE, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(1, 2, 2);
  scene.add(key, new THREE.HemisphereLight(0xffffff, 0x202020, 0.5));

  const camera = new THREE.PerspectiveCamera(30, 1, 1, 1000);
  const items = new Set();

  let last = 0;
  const loop = (t) => {
    requestAnimationFrame(loop);
    if (t - last < 33) return; // ~30 fps is plenty for a turntable
    const dt = (t - last) / 1000;
    last = t;
    for (const item of items) {
      if (!item.visible || !item.pivot) continue;
      item.angle += dt * 0.6;
      drawItem(item);
    }
  };
  requestAnimationFrame(loop);

  function frame(pivot, angle) {
    scene.add(pivot);
    pivot.rotation.y = angle;
    const r = pivot.userData.radius;
    camera.position.set(0, r * 0.35, r * 3.6);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
    scene.remove(pivot);
  }

  function drawItem(item) {
    frame(item.pivot, item.angle);
    const c = item.canvas;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    const s = Math.min(c.width, c.height);
    ctx.drawImage(renderer.domElement, (c.width - s) / 2, (c.height - s) / 2, s, s);
  }

  shared = { renderer, items, frame, drawItem };
  return shared;
}

/** Wrap a fitted helmet in a pivot centred on its bounding box, for turntable rendering. */
async function buildPivot(helmet) {
  const fitted = await createFittedHelmet(helmet);
  fitted.userData.setVisor('down');
  const box = new THREE.Box3().setFromObject(fitted);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  fitted.position.sub(center);
  const pivot = new THREE.Group();
  pivot.add(fitted);
  pivot.userData.radius = size.length() / 2;
  return pivot;
}

/** Large spinning preview for catalog cards. */
export function HelmetTurntable({ helmet, className = '', startAngle = -0.6 }) {
  const canvasRef = useRef(null);
  const [state, setState] = useState({ loading: true, progress: 0, error: false });

  useEffect(() => {
    const { items, drawItem } = getShared();
    const canvas = canvasRef.current;
    const item = { canvas, pivot: null, angle: startAngle, visible: false };
    items.add(item);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      if (item.pivot) drawItem(item);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => { item.visible = entry.isIntersecting; });
    io.observe(canvas);

    let alive = true;
    loadHelmetScene(helmet.modelUrl, (p) => alive && setState((s) => ({ ...s, progress: p })))
      .then(() => buildPivot(helmet))
      .then((pivot) => {
        if (!alive) return;
        item.pivot = pivot;
        drawItem(item);
        setState({ loading: false, progress: 1, error: false });
      })
      .catch(() => alive && setState({ loading: false, progress: 0, error: true }));

    return () => {
      alive = false;
      items.delete(item);
      ro.disconnect();
      io.disconnect();
    };
  }, [helmet, startAngle]);

  return (
    <div className={`relative ${className}`}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      {state.loading && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="w-2/3 max-w-[160px]">
            <div className="h-1 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-white/70 transition-all" style={{ width: `${Math.round(state.progress * 100)}%` }} />
            </div>
            <p className="mt-2 text-[10px] text-center text-zinc-500">Loading 3D model · {helmet.sizeMb} MB</p>
          </div>
        </div>
      )}
      {state.error && <p className="absolute inset-0 grid place-items-center text-xs text-red-300">Model failed to load</p>}
    </div>
  );
}

const thumbCache = new Map(); // helmet id -> Promise<dataURL>

function renderThumb(helmet) {
  if (!thumbCache.has(helmet.id)) {
    thumbCache.set(
      helmet.id,
      buildPivot(helmet).then((pivot) => {
        const { renderer, frame } = getShared();
        frame(pivot, -0.6);
        return renderer.domElement.toDataURL('image/png');
      })
    );
    thumbCache.get(helmet.id).catch(() => thumbCache.delete(helmet.id));
  }
  return thumbCache.get(helmet.id);
}

/** Small still image of a helmet (rendered once, then cached). */
export function HelmetThumb({ helmet, className = '' }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let alive = true;
    renderThumb(helmet).then((url) => alive && setSrc(url)).catch(() => {});
    return () => { alive = false; };
  }, [helmet]);
  return src ? (
    <img src={src} alt={`${helmet.brand} ${helmet.model}`} className={`object-contain ${className}`} draggable={false} />
  ) : (
    <div className={`grid place-items-center text-xs font-bold ${className}`} style={{ background: `${helmet.accent}33`, color: helmet.accent }}>
      {helmet.brand.slice(0, 2).toUpperCase()}
    </div>
  );
}
