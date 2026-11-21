import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { FaceLandmarker } from '@mediapipe/tasks-vision';
import { HELMETS, getHelmet } from '../data/helmets.js';
import { createFittedHelmet } from '../lib/helmetLoader.js';
import { createHeadOccluder } from '../lib/headOccluder.js';
import { CANONICAL_FACE_VERTICES } from '../lib/canonicalFace.js';

/**
 * Developer tool (#/studio/<helmetId>): shows a helmet on the MediaPipe canonical head
 * so its `fit` (rotation / width / centre) can be tuned without a camera.
 * The values it prints go straight into src/data/helmets.js.
 */
export default function FitStudio({ helmetId, navigate }) {
  const mountRef = useRef(null);
  const ctx = useRef({});
  const [helmet, setHelmet] = useState(() => structuredClone(getHelmet(helmetId) || HELMETS[0]));
  const [info, setInfo] = useState('');
  const [showOccluder, setShowOccluder] = useState(true);
  const [xray, setXray] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101014);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment()).texture;

    const camera = new THREE.PerspectiveCamera(35, mount.clientWidth / mount.clientHeight, 1, 1000);
    camera.position.set(45, 10, 70);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 2, -3);

    // Canonical face, visible.
    const tess = FaceLandmarker.FACE_LANDMARKS_TESSELATION;
    const idx = [];
    for (let i = 0; i + 2 < tess.length; i += 3) idx.push(tess[i].start, tess[i + 1].start, tess[i + 2].start);
    const faceGeo = new THREE.BufferGeometry();
    faceGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CANONICAL_FACE_VERTICES), 3));
    faceGeo.setIndex(idx);
    faceGeo.computeVertexNormals();
    const face = new THREE.Mesh(faceGeo, new THREE.MeshStandardMaterial({ color: 0xd8a27f, roughness: 0.7, side: THREE.DoubleSide }));
    scene.add(face);

    const occluder = createHeadOccluder({ debug: true });
    scene.add(occluder);
    scene.add(new THREE.AxesHelper(20));
    const grid = new THREE.GridHelper(80, 16, 0x333333, 0x222222);
    grid.position.y = -25;
    scene.add(grid);

    const holder = new THREE.Group();
    scene.add(holder);

    ctx.current = { renderer, scene, camera, controls, holder, occluder };
    window.__studio = ctx.current;

    let raf;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
    };
    loop();
    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    if (ctx.current.occluder) ctx.current.occluder.visible = showOccluder;
  }, [showOccluder]);

  useEffect(() => {
    let cancelled = false;
    createFittedHelmet(helmet).then((fitted) => {
      if (cancelled) return;
      const { holder } = ctx.current;
      holder.clear();
      holder.add(fitted);
      const d = fitted.userData.dimensionsCm;
      setInfo(`shell ${d.x.toFixed(1)} W × ${d.y.toFixed(1)} H × ${d.z.toFixed(1)} D cm`);
    });
    return () => { cancelled = true; };
  }, [helmet]);

  const setView = (pos) => {
    const { camera, controls } = ctx.current;
    camera.position.set(...pos);
    controls.update();
  };

  // Console hooks for scripted calibration: __studioFit({ rotation, width, center }), __studioView([x,y,z])
  useEffect(() => {
    window.__studioFit = (fit) => setHelmet((h) => ({ ...h, fit: { ...h.fit, ...structuredClone(fit) } }));
    window.__studioView = setView;
    window.__studioOccluder = setShowOccluder;
    window.__studioXray = setXray;
  }, []);

  // X-ray: draw the helmet see-through so the head inside is visible.
  // (Materials are shared with the loader cache, so this only belongs in the studio.)
  useEffect(() => {
    ctx.current.holder?.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m.userData.studioOrig === undefined) m.userData.studioOrig = { t: m.transparent, o: m.opacity, d: m.depthWrite };
        const orig = m.userData.studioOrig;
        m.transparent = xray || orig.t;
        m.opacity = xray ? 0.3 : orig.o;
        m.depthWrite = xray ? false : orig.d;
        m.needsUpdate = true;
      }
    });
  }, [xray, info]);

  const updateFit = (key, i, value) => {
    setHelmet((h) => {
      const fit = structuredClone(h.fit);
      if (i == null) fit[key] = value; else fit[key][i] = value;
      return { ...h, fit };
    });
  };

  const fitJson = JSON.stringify(
    {
      rotation: helmet.fit.rotation.map((v) => +v.toFixed(4)),
      width: +helmet.fit.width.toFixed(2),
      center: helmet.fit.center.map((v) => +v.toFixed(2)),
    }
  );

  const slider = (label, key, i, min, max, step) => (
    <label className="block text-[11px] text-zinc-400">
      <div className="flex justify-between"><span>{label}</span><span className="text-white tabular-nums">{(i == null ? helmet.fit[key] : helmet.fit[key][i]).toFixed(2)}</span></div>
      <input type="range" min={min} max={max} step={step} value={i == null ? helmet.fit[key] : helmet.fit[key][i]}
        onChange={(e) => updateFit(key, i, parseFloat(e.target.value))} className="w-full accent-cyan-400" />
    </label>
  );

  return (
    <div className="w-screen h-screen flex bg-black text-white">
      <div ref={mountRef} className="flex-1 h-full" />
      <aside className="w-72 p-4 space-y-3 overflow-y-auto border-l border-zinc-800 text-sm">
        <button onClick={() => navigate('/catalog')} className="text-xs text-cyan-400">← Catalog</button>
        <h1 className="font-bold">Fit Studio</h1>
        <select className="w-full bg-zinc-900 rounded p-2" value={helmet.id}
          onChange={(e) => { navigate(`/studio/${e.target.value}`); setHelmet(structuredClone(getHelmet(e.target.value))); }}>
          {HELMETS.map((h) => <option key={h.id} value={h.id}>{h.brand} {h.model}</option>)}
        </select>
        <p className="text-[11px] text-zinc-400">{info}</p>
        <div className="flex gap-1 flex-wrap">
          {[['Front', [0, 2, 80]], ['Side', [80, 2, -3]], ['Top', [0, 80, -2]], ['3/4', [45, 10, 70]]].map(([n, p]) => (
            <button key={n} onClick={() => setView(p)} className="px-2 py-1 bg-zinc-800 rounded text-xs">{n}</button>
          ))}
          <button onClick={() => setShowOccluder((v) => !v)} className="px-2 py-1 bg-zinc-800 rounded text-xs">Occluder {showOccluder ? 'on' : 'off'}</button>
          <button onClick={() => setXray((v) => !v)} className="px-2 py-1 bg-zinc-800 rounded text-xs">X-ray {xray ? 'on' : 'off'}</button>
        </div>
        <div className="flex gap-1 flex-wrap">
          {[0, 1, 2].map((axis) => (
            <button key={axis} className="px-2 py-1 bg-zinc-800 rounded text-xs"
              onClick={() => updateFit('rotation', axis, ((helmet.fit.rotation[axis] + Math.PI / 2 + Math.PI) % (2 * Math.PI)) - Math.PI)}>
              {'XYZ'[axis]} +90°
            </button>
          ))}
        </div>
        {slider('Rot X', 'rotation', 0, -Math.PI, Math.PI, 0.01)}
        {slider('Rot Y', 'rotation', 1, -Math.PI, Math.PI, 0.01)}
        {slider('Rot Z', 'rotation', 2, -Math.PI, Math.PI, 0.01)}
        {slider('Width cm', 'width', null, 15, 35, 0.1)}
        {slider('Center X', 'center', 0, -10, 10, 0.1)}
        {slider('Center Y', 'center', 1, -10, 15, 0.1)}
        {slider('Center Z', 'center', 2, -15, 10, 0.1)}
        <textarea readOnly value={fitJson} className="w-full h-20 bg-zinc-900 text-[11px] p-2 rounded font-mono" />
      </aside>
    </div>
  );
}
