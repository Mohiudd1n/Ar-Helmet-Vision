import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import { createFittedHelmet } from './helmetLoader.js';
import { createHeadOccluder } from './headOccluder.js';
import { OVERLAY } from './faceTopology.js';
import { PoseFilter } from './oneEuroFilter.js';
import { cachedFetchBuffer, TRACKER_MODEL_URL } from './assetCache.js';

/**
 * AR try-on engine (framework-free; TryOnScreen drives it).
 *
 * How the pieces line up:
 * - MediaPipe's facialTransformationMatrix is a rigid pose of the canonical face model,
 *   in centimetres, for a pinhole camera with a 63° vertical field of view looking down -Z.
 * - So the Three.js camera uses exactly that FOV and the video frame's aspect ratio, and the
 *   canvas is laid out at exactly the video's size and position (both "cover" the screen
 *   inside one "stage" element). A helmet placed in canonical head space then lands on the
 *   real head with no guessed depth or extra scaling.
 * - The stage is mirrored with CSS for the selfie view, which flips video and 3D together,
 *   so the raw matrix can be used as is. (The rear camera is not mirrored, see setMirrored.)
 * - The head occluder and the helmet both hang off one `headAnchor`, so they can never drift
 *   apart. Pose jitter is removed with a One Euro filter.
 * - The face mesh overlay is built from the live landmarks every frame (it follows
 *   expressions) and drawn on top of everything, at any head angle.
 */

const MEDIAPIPE_FOV = 63;
const HOLD_MS = 600; // keep showing the last pose this long when tracking drops for a moment

let landmarkerPromise = null;

function createLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
      // Model bytes come from Cache Storage after the first visit; fall back to the URL if that fails.
      let modelBuffer = null;
      try { modelBuffer = new Uint8Array(await cachedFetchBuffer(TRACKER_MODEL_URL)); } catch { /* use URL */ }
      const options = (delegate) => ({
        baseOptions: modelBuffer
          ? { modelAssetBuffer: modelBuffer, delegate }
          : { modelAssetPath: TRACKER_MODEL_URL, delegate },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFacialTransformationMatrixes: true,
        outputFaceBlendshapes: false,
        // Lower thresholds keep the tracker locked on at strong side / up / down angles.
        minFaceDetectionConfidence: 0.35,
        minFacePresenceConfidence: 0.35,
        minTrackingConfidence: 0.35,
      });
      try {
        return await FaceLandmarker.createFromOptions(fileset, options('GPU'));
      } catch (err) {
        console.warn('GPU delegate unavailable, using CPU', err);
        return FaceLandmarker.createFromOptions(fileset, options('CPU'));
      }
    })();
    landmarkerPromise.catch(() => { landmarkerPromise = null; });
  }
  return landmarkerPromise;
}

export class ArEngine {
  constructor({ container, stage, canvas, media, onStatus, onFps }) {
    Object.assign(this, { container, stage, canvas, media, onStatus, onFps });
    this.disposed = false;
    this.status = 'starting';
    this.lastSeen = 0;
    this.lastDetectTime = -1;
    this.lastFrameTime = performance.now();
    this.poseFilter = new PoseFilter();
    this.pose = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
    this.meshVisible = true;
    this.mirrored = true;
    this.helmetToken = 0;

    this.#initThree();
    this.#layout();
    this.resizeObserver = new ResizeObserver(() => this.#layout());
    this.resizeObserver.observe(container);
  }

  // ---------- setup ----------

  #initThree() {
    const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(0.5, 1, 1);
    scene.add(key);
    this.scene = scene;

    this.camera = new THREE.PerspectiveCamera(MEDIAPIPE_FOV, 16 / 9, 1, 3000);

    // Everything that rides on the head.
    const headAnchor = new THREE.Group();
    headAnchor.matrixAutoUpdate = false;
    headAnchor.visible = false;
    headAnchor.add(createHeadOccluder());
    this.helmetSlot = new THREE.Group();
    headAnchor.add(this.helmetSlot);
    scene.add(headAnchor);
    this.headAnchor = headAnchor;

    // Live face-mesh overlay ("computer vision lines").
    const linePositions = new THREE.BufferAttribute(new Float32Array(478 * 3), 3);
    linePositions.setUsage(THREE.DynamicDrawUsage);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', linePositions);
    lineGeo.setIndex(OVERLAY.lineIndices);
    this.lineMat = new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.85, depthTest: false, depthWrite: false });
    const lines = new THREE.LineSegments(lineGeo, this.lineMat);

    const pointGeo = new THREE.BufferGeometry();
    pointGeo.setAttribute('position', linePositions);
    pointGeo.setIndex(OVERLAY.pointIndices);
    this.pointMat = new THREE.PointsMaterial({ color: 0xfacc15, size: 3.5, sizeAttenuation: false, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false });
    const points = new THREE.Points(pointGeo, this.pointMat);

    const overlay = new THREE.Group();
    overlay.add(lines, points);
    for (const o of [lines, points]) { o.renderOrder = 1000; o.frustumCulled = false; }
    overlay.visible = false;
    scene.add(overlay);
    this.overlay = overlay;
    this.overlayPositions = linePositions;
    this.smoothedLandmarks = new Float32Array(478 * 3);
    this.hasSmoothedLandmarks = false;

    // Small canvas used to estimate scene brightness from the camera image.
    this.lumaCanvas = document.createElement('canvas');
    this.lumaCanvas.width = 32;
    this.lumaCanvas.height = 18;
    this.lumaCtx = this.lumaCanvas.getContext('2d', { willReadFrequently: true });
    this.lastLumaTime = 0;
  }

  get mediaSize() {
    const m = this.media;
    const w = m.videoWidth || m.naturalWidth || 1280;
    const h = m.videoHeight || m.naturalHeight || 720;
    return { w, h };
  }

  /** Size the stage so the video frame covers the container, and match camera + canvas to it. */
  #layout() {
    const cw = this.container.clientWidth || window.innerWidth;
    const ch = this.container.clientHeight || window.innerHeight;
    const { w, h } = this.mediaSize;
    const scale = Math.max(cw / w, ch / h);
    const sw = Math.round(w * scale);
    const sh = Math.round(h * scale);
    Object.assign(this.stage.style, {
      width: `${sw}px`,
      height: `${sh}px`,
      left: `${Math.round((cw - sw) / 2)}px`,
      top: `${Math.round((ch - sh) / 2)}px`,
    });
    this.renderer.setSize(sw, sh, true);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  async start() {
    this.#setStatus('loading-tracker');
    this.landmarker = await createLandmarker();
    if (this.disposed) return;
    this.#layout(); // media dimensions are known now
    this.#setStatus('searching');
    this.#loop();
  }

  // ---------- helmet ----------

  async setHelmet(helmet, { sizeScale = 1, visor = 'smoked' } = {}) {
    const token = ++this.helmetToken;
    const fitted = await createFittedHelmet(helmet, { sizeScale });
    if (token !== this.helmetToken || this.disposed) return;
    this.helmetSlot.clear();
    this.helmetSlot.add(fitted);
    this.helmet = fitted;
    fitted.userData.setVisor(visor);
    this.renderer.compile(this.scene, this.camera); // avoid a shader-compile hitch on first sight
  }

  setSize(sizeScale) { if (this.helmet) this.helmet.scale.setScalar(sizeScale); }
  setVisor(mode) { this.helmet?.userData.setVisor(mode); }
  setMeshVisible(v) { this.meshVisible = v; }

  /** Selfie (front) camera is mirrored, the rear camera is not. Only affects snapshots here; the stage's CSS handles the live view. */
  setMirrored(v) { this.mirrored = v; }

  /** Call after swapping the camera stream: re-fit to the new frame size and restart tracking cleanly. */
  onMediaChanged() {
    this.#layout();
    this.lastDetectTime = -1;
    this.poseFilter.reset();
    this.hasSmoothedLandmarks = false;
    this.headAnchor.visible = false;
    this.overlay.visible = false;
    this.#setStatus('searching');
  }

  // ---------- per frame ----------

  #loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.#loop);
    const now = performance.now();

    const media = this.media;
    const isVideo = media instanceof HTMLVideoElement;
    const ready = isVideo ? media.readyState >= 2 : media.complete && media.naturalWidth > 0;

    if (ready && this.landmarker) {
      const frameTime = isVideo ? media.currentTime : Math.floor(now / 66); // ~15 fps for stills
      if (frameTime !== this.lastDetectTime) {
        this.lastDetectTime = frameTime;
        const result = this.landmarker.detectForVideo(media, now);
        this.#applyResult(result, now);
        this.#countFps(now);
      }
    }

    // Tracking dropped: hold the last pose briefly, then hide.
    if (this.status === 'tracking' || this.status === 'holding') {
      const since = now - this.lastSeen;
      if (since > HOLD_MS) {
        this.headAnchor.visible = false;
        this.overlay.visible = false;
        this.poseFilter.reset();
        this.hasSmoothedLandmarks = false;
        this.#setStatus('searching');
      } else if (since > 120) {
        this.#setStatus('holding');
      }
    }

    if (now - this.lastLumaTime > 500) this.#estimateExposure(now);
    this.renderer.render(this.scene, this.camera);
  };

  #applyResult(result, now) {
    const matrixData = result?.facialTransformationMatrixes?.[0]?.data;
    const landmarks = result?.faceLandmarks?.[0];
    if (!matrixData || !landmarks) return;

    const dt = Math.min(Math.max((now - this.lastFrameTime) / 1000, 1 / 120), 0.25);
    this.lastFrameTime = now;
    this.lastSeen = now;

    // 1. Rigid head pose -> anchor (helmet + occluder).
    const m = new THREE.Matrix4().fromArray(matrixData);
    const { position, quaternion } = this.pose;
    const scale = new THREE.Vector3();
    m.decompose(position, quaternion, scale);
    this.poseFilter.apply(position, quaternion, dt);
    this.headAnchor.matrix.compose(position, quaternion, new THREE.Vector3(1, 1, 1));
    this.headAnchor.matrixWorldNeedsUpdate = true;
    this.headAnchor.visible = true;

    // 2. Face mesh overlay from live landmarks, unprojected through the same camera.
    const depth = Math.max(-position.z, 10);
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(MEDIAPIPE_FOV / 2));
    const halfH = depth * tanHalf;
    const halfW = halfH * this.camera.aspect;
    const smooth = this.smoothedLandmarks;
    const k = this.hasSmoothedLandmarks ? 0.55 : 1; // light smoothing; the overlay should feel instant
    const n = Math.min(landmarks.length, 478);
    for (let i = 0; i < n; i++) {
      const lm = landmarks[i];
      const d = depth + lm.z * halfW * 2;
      const x = (lm.x * 2 - 1) * halfW * (d / depth);
      const y = (1 - lm.y * 2) * halfH * (d / depth);
      const j = i * 3;
      smooth[j] += (x - smooth[j]) * k;
      smooth[j + 1] += (y - smooth[j + 1]) * k;
      smooth[j + 2] += (-d - smooth[j + 2]) * k;
    }
    this.hasSmoothedLandmarks = true;
    this.overlayPositions.array.set(smooth);
    this.overlayPositions.needsUpdate = true;
    this.overlay.visible = this.meshVisible;

    this.#setStatus('tracking');
  }

  #estimateExposure(now) {
    this.lastLumaTime = now;
    try {
      const { width, height } = this.lumaCanvas;
      this.lumaCtx.drawImage(this.media, 0, 0, width, height);
      const px = this.lumaCtx.getImageData(0, 0, width, height).data;
      let sum = 0;
      for (let i = 0; i < px.length; i += 4) sum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
      const luma = sum / (px.length / 4) / 255; // 0..1
      // Dim rooms -> darker helmet, bright rooms -> brighter, so it sits in the scene.
      const target = THREE.MathUtils.clamp(0.55 + luma * 1.1, 0.6, 1.35);
      this.renderer.toneMappingExposure += (target - this.renderer.toneMappingExposure) * 0.5;
    } catch {
      /* media not drawable yet */
    }
  }

  #countFps(now) {
    this.fpsFrames = (this.fpsFrames || 0) + 1;
    if (!this.fpsStart) this.fpsStart = now;
    if (now - this.fpsStart >= 1000) {
      this.onFps?.(Math.round((this.fpsFrames * 1000) / (now - this.fpsStart)));
      this.fpsFrames = 0;
      this.fpsStart = now;
    }
  }

  #setStatus(s) {
    if (s === this.status) return;
    this.status = s;
    this.onStatus?.(s);
  }

  // ---------- snapshot ----------

  /** Composite of the camera frame (mirrored for the front camera) + the 3D layer, as a PNG blob. */
  snapshot({ includeMesh = false } = {}) {
    const { w, h } = this.mediaSize;
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const ctx = out.getContext('2d');
    const prevOverlay = this.overlay.visible;
    this.overlay.visible = prevOverlay && includeMesh;
    this.renderer.render(this.scene, this.camera); // draw now so the WebGL buffer is valid
    if (this.mirrored) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(this.media, 0, 0, w, h);
    ctx.drawImage(this.canvas, 0, 0, w, h);
    this.overlay.visible = prevOverlay;
    return new Promise((resolve) => out.toBlob(resolve, 'image/png'));
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.helmetSlot.clear();
    this.renderer.dispose();
  }
}
