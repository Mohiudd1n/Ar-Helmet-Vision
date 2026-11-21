import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import {
  Camera,
  Sliders,
  Eye,
  EyeOff,
  Copy,
  Check,
  AlertCircle,
  Sparkles,
  RotateCcw,
  X,
  HelpCircle,
  Play,
  Smile,
  ShieldAlert,
  Smartphone,
  ExternalLink
} from 'lucide-react';

import { INITIAL_HELMETS } from '../data/helmets.js';
import { createProceduralHelmet } from '../utils/proceduralHelmet.js';

// 36 Perimeter Landmark Indices tracing the outer boundary of the face oval in order
const FACE_OVAL_RING = [
  10, 338, 297, 332, 284, 251, 389, 356,
  454, 323, 361, 288, 397, 365, 379, 378,
  400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21,
  54, 103, 67, 109
];

// Clean stylized low-density facial triangulation matching the reference photo
const STYLIZED_FACIAL_TRIANGLES = [
  // Forehead apex fan
  [10, 67, 109], [10, 109, 107], [10, 107, 9], [10, 9, 336], [10, 336, 338], [10, 338, 297],
  [109, 54, 103], [109, 103, 67], [338, 284, 297], [297, 332, 284],
  // Forehead to eyebrows
  [107, 66, 9], [9, 66, 8], [9, 8, 296], [9, 296, 336],
  [107, 105, 66], [336, 296, 334],
  // Glabella / Mid-eyes
  [8, 107, 168], [8, 168, 336],
  // Left eyebrow to eye socket
  [70, 63, 105], [70, 105, 107],
  [70, 107, 33], [107, 168, 133], [107, 33, 133],
  // Right eyebrow to eye socket
  [336, 296, 263], [336, 263, 300], [296, 334, 293], [334, 293, 300],
  [336, 362, 263], [168, 336, 362],
  // Nose bridge and pyramid
  [168, 197, 6], [168, 6, 1], [168, 133, 197], [168, 197, 362],
  [197, 1, 98], [197, 327, 1],
  [1, 98, 2], [1, 2, 327],
  // Cheeks / Zygomatic
  [234, 127, 70], [70, 127, 33], [127, 116, 33],
  [454, 300, 356], [300, 263, 356], [356, 263, 345],
  [33, 116, 147], [33, 147, 98], [263, 376, 345], [263, 327, 376],
  // Mouth and lips
  [2, 98, 61], [2, 61, 0], [2, 0, 291], [2, 291, 327],
  [61, 37, 0], [0, 267, 291],
  [61, 147, 172], [291, 397, 376],
  [61, 17, 291], [61, 84, 17], [17, 314, 291],
  // Chin
  [61, 172, 136], [61, 136, 152], [61, 152, 17],
  [291, 17, 152], [291, 152, 365], [291, 365, 397],
  [152, 176, 148], [152, 377, 378], [152, 148, 377],
  // Jaw perimeter braces
  [234, 93, 132], [132, 58, 172], [172, 136, 150], [150, 149, 152],
  [454, 323, 361], [361, 288, 397], [397, 365, 379], [379, 378, 152]
];

// Build unique line segments and vertices for the stylized wireframe
const STYLIZED_LINE_INDICES = [];
const STYLIZED_VERTEX_SET = new Set();
const edgeMap = new Set();

function addEdge(a, b) {
  const key = a < b ? `${a}_${b}` : `${b}_${a}`;
  if (!edgeMap.has(key)) {
    edgeMap.add(key);
    STYLIZED_LINE_INDICES.push(a, b);
    STYLIZED_VERTEX_SET.add(a);
    STYLIZED_VERTEX_SET.add(b);
  }
}

// 1. Add triangles edges
for (const [a, b, c] of STYLIZED_FACIAL_TRIANGLES) {
  addEdge(a, b);
  addEdge(b, c);
  addEdge(c, a);
}

// 2. Add full outer face boundary loop
for (let i = 0; i < FACE_OVAL_RING.length; i++) {
  const a = FACE_OVAL_RING[i];
  const b = FACE_OVAL_RING[(i + 1) % FACE_OVAL_RING.length];
  addEdge(a, b);
}

const STYLIZED_VERTEX_ARRAY = Array.from(STYLIZED_VERTEX_SET);

/**
 * Robust Mobile-Compatible getUserMedia with multi-tier fallback
 */
async function getMobileCompatibleCameraStream() {
  const isLocalhost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';
  const isSecure = window.isSecureContext || window.location.protocol === 'https:' || isLocalhost;

  if (!isSecure && !navigator?.mediaDevices?.getUserMedia) {
    const targetHttps = window.location.href.replace(/^http:/i, 'https:');
    const err = new Error(`INSECURE_CONTEXT:${targetHttps}`);
    err.name = 'InsecureContextError';
    throw err;
  }

  if (!navigator?.mediaDevices?.getUserMedia) {
    const legacyGetUserMedia =
      navigator.getUserMedia ||
      navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia ||
      navigator.msGetUserMedia;

    if (legacyGetUserMedia) {
      return new Promise((resolve, reject) => {
        legacyGetUserMedia.call(navigator, { video: true, audio: false }, resolve, reject);
      });
    }

    throw new Error('Camera access API is not supported in this browser environment.');
  }

  const constraintTiers = [
    {
      video: {
        facingMode: { ideal: 'user' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    },
    {
      video: {
        facingMode: { ideal: 'user' },
        width: { ideal: 720 },
        height: { ideal: 1280 },
      },
      audio: false,
    },
    {
      video: {
        facingMode: 'user',
      },
      audio: false,
    },
    {
      video: {
        facingMode: { ideal: 'user' },
      },
      audio: false,
    },
    {
      video: true,
      audio: false,
    },
  ];

  let lastError = null;
  for (const constraints of constraintTiers) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (stream) return stream;
    } catch (err) {
      lastError = err;
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw err;
      }
      console.warn('Constraint tier failed, attempting fallback tier:', constraints, err.message);
    }
  }

  throw lastError || new Error('Unable to access camera with any supported constraints.');
}

export default function HelmetTryOn() {
  // --- UI States ---
  const [helmets, setHelmets] = useState(INITIAL_HELMETS);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState('Initializing Face Tracker...');
  const [cameraError, setCameraError] = useState(null);
  const [insecureHttpsUrl, setInsecureHttpsUrl] = useState(null);
  const [needsUserTapToPlay, setNeedsUserTapToPlay] = useState(false);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);
  const [showFaceMeshDebug, setShowFaceMeshDebug] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [shutterFlash, setShutterFlash] = useState(false);
  const [snapshotToast, setSnapshotToast] = useState(false);
  const [isFallbackActive, setIsFallbackActive] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  // Live Biometric Metrics State
  const [biometrics, setBiometrics] = useState({
    faceWidthCm: 15.2,
    faceHeightCm: 20.4,
    smilePercent: 0,
    jawOpenPercent: 0,
  });

  // --- DOM & Three.js Refs ---
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const headAnchorGroupRef = useRef(null);
  const helmetContainerRef = useRef(null);
  
  // Invisible Depth Occluder Mesh
  const faceMeshGeoRef = useRef(null);
  const faceMeshMeshRef = useRef(null);

  // Stylized Low-Density Cyber Debug Visualizer (Matching User Image)
  const stylizedDebugGroupRef = useRef(null);
  const stylizedLinesGeoRef = useRef(null);
  const stylizedPointsGeoRef = useRef(null);

  const faceLandmarkerRef = useRef(null);
  const gltfLoaderRef = useRef(null);
  const modelCacheRef = useRef(new Map());

  // Smoothing & dynamic dimensions state refs
  const smoothedPosRef = useRef(new THREE.Vector3());
  const smoothedQuatRef = useRef(new THREE.Quaternion());
  const smoothedScaleRef = useRef(new THREE.Vector3(26.0, 31.5, 30.0)); // Auto Width, Height, Depth
  const hasInitialPoseRef = useRef(false);
  const missingFaceFramesRef = useRef(0);
  const activeHelmetConfigRef = useRef(helmets[0]);
  const demoModeRef = useRef(false);

  useEffect(() => {
    activeHelmetConfigRef.current = helmets[selectedIdx];
  }, [helmets, selectedIdx]);

  useEffect(() => {
    demoModeRef.current = demoMode;
  }, [demoMode]);

  // --- 1. SETUP THREE.JS SCENE ---
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || window.innerWidth;
    const height = containerRef.current.clientHeight || window.innerHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera with FOV ~63°
    const camera = new THREE.PerspectiveCamera(63, width / height, 0.1, 1000);
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);
    scene.add(camera);
    cameraRef.current = camera;

    // 3. WebGLRenderer with alpha transparency & preserved drawing buffer for snapshots
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;

    // 4. Studio Environment Map for realistic metallic & visor reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const roomEnv = new RoomEnvironment();
    scene.environment = pmremGenerator.fromScene(roomEnv).texture;

    // 5. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
    keyLight.position.set(2, 4, 3);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xa5c9eb, 0.8);
    fillLight.position.set(-3, 1, 2);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffeedd, 0.6);
    rimLight.position.set(0, -2, -3);
    scene.add(rimLight);

    // 6. Head Anchor Group (Positions and orients the 3D Helmet)
    const headAnchorGroup = new THREE.Group();
    headAnchorGroup.matrixAutoUpdate = false;
    headAnchorGroup.matrix.setPosition(0, 0, -50);
    headAnchorGroup.visible = false;
    scene.add(headAnchorGroup);
    headAnchorGroupRef.current = headAnchorGroup;

    // 7. REAL-TIME ADAPTIVE INVISIBLE OCCLUDER
    // Combines 478 face landmarks + cranium backing to cull helmet interior
    const tess = FaceLandmarker.FACE_LANDMARKS_TESSELATION;
    const allIndices = [];

    // Front face triangles (852 triangles)
    for (let i = 0; i < tess.length; i += 3) {
      allIndices.push(tess[i].start, tess[i + 1].start, tess[i + 2].start);
    }

    // Extruded cranium backing quads connecting face oval to skull rim
    const N = FACE_OVAL_RING.length; // 36
    for (let i = 0; i < N; i++) {
      const next = (i + 1) % N;
      const f1 = FACE_OVAL_RING[i];
      const f2 = FACE_OVAL_RING[next];
      const b1 = 478 + i;
      const b2 = 478 + next;
      allIndices.push(f1, b1, f2);
      allIndices.push(f2, b1, b2);
    }

    // Posterior skull cap apex fan (index 514)
    const apexIdx = 478 + N; // 514
    for (let i = 0; i < N; i++) {
      const next = (i + 1) % N;
      const b1 = 478 + i;
      const b2 = 478 + next;
      allIndices.push(b1, apexIdx, b2);
    }

    const faceGeo = new THREE.BufferGeometry();
    faceGeo.setIndex(new THREE.BufferAttribute(new Uint16Array(allIndices), 1));
    faceGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(515 * 3), 3)
    );
    faceMeshGeoRef.current = faceGeo;

    // Invisible depth occluder (renderOrder = 1)
    const faceMat = new THREE.MeshBasicMaterial({
      colorWrite: false, // Always invisible depth-only
      depthWrite: true,  // Writes exact 3D facial depth so interior helmet is culled
      depthTest: true,
      side: THREE.DoubleSide,
    });

    const faceMesh = new THREE.Mesh(faceGeo, faceMat);
    faceMesh.renderOrder = 1;
    scene.add(faceMesh);
    faceMeshMeshRef.current = faceMesh;

    // 8. STYLIZED LOW-DENSITY CYBER DEBUG VISUALIZER (Matching User Image)
    const stylizedDebugGroup = new THREE.Group();
    stylizedDebugGroup.visible = false;
    scene.add(stylizedDebugGroup);
    stylizedDebugGroupRef.current = stylizedDebugGroup;

    // Stylized Lines (Yellow / Gold)
    const linesGeo = new THREE.BufferGeometry();
    linesGeo.setIndex(new THREE.BufferAttribute(new Uint16Array(STYLIZED_LINE_INDICES), 1));
    linesGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(478 * 3), 3));
    stylizedLinesGeoRef.current = linesGeo;

    const linesMat = new THREE.LineBasicMaterial({
      color: 0xfacc15, // Bright cyber yellow
      transparent: true,
      opacity: 0.9,
      depthTest: false, // Always visible on top when toggled
    });
    const stylizedLines = new THREE.LineSegments(linesGeo, linesMat);
    stylizedLines.renderOrder = 99;
    stylizedDebugGroup.add(stylizedLines);

    // Stylized Key Landmark Dots (Matching left side of user image)
    const pointsGeo = new THREE.BufferGeometry();
    pointsGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STYLIZED_VERTEX_ARRAY.length * 3), 3));
    stylizedPointsGeoRef.current = pointsGeo;

    const pointsMat = new THREE.PointsMaterial({
      color: 0xfef08a,
      size: 5,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    });
    const stylizedPoints = new THREE.Points(pointsGeo, pointsMat);
    stylizedPoints.renderOrder = 100;
    stylizedDebugGroup.add(stylizedPoints);

    // 9. Helmet Container (renderOrder = 2)
    const helmetContainer = new THREE.Group();
    headAnchorGroup.add(helmetContainer);
    helmetContainerRef.current = helmetContainer;

    // 10. GLTF Loader
    gltfLoaderRef.current = new GLTFLoader();

    // 11. Responsive Resize & Mobile Orientation Handling
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const newWidth = containerRef.current.clientWidth || window.innerWidth;
      const newHeight = containerRef.current.clientHeight || window.innerHeight;
      cameraRef.current.aspect = newWidth / newHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(newWidth, newHeight);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      renderer.dispose();
      pmremGenerator.dispose();
    };
  }, []);

  // --- 2. UPDATE STYLIZED CYBER WIREFRAME VISIBILITY ON DEBUG TOGGLE ---
  useEffect(() => {
    if (stylizedDebugGroupRef.current) {
      stylizedDebugGroupRef.current.visible = showFaceMeshDebug;
    }
  }, [showFaceMeshDebug]);

  // --- 3. AUTO-FIT & NORMALIZATION HELPER FOR ANY 3D HELMET ---
  const loadHelmetModel = useCallback(async (helmetConfig) => {
    const container = helmetContainerRef.current;
    if (!container) return;

    while (container.children.length > 0) {
      const obj = container.children[0];
      container.remove(obj);
    }

    const { id, modelUrl, offset, rotationOffset } = helmetConfig;

    const applyModelToScene = (model3D, isFallback = false) => {
      // 1. Calculate natural bounding box of 3D asset
      const box = new THREE.Box3().setFromObject(model3D);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      // Re-center model geometry so the inner head cavity sits precisely at (0, 0, 0)
      model3D.position.set(-center.x, -center.y, -center.z);

      // 2. Normalize base model to unit 1.0 box dimensions (X, Y, Z normalized independently)
      const normalizedGroup = new THREE.Group();
      normalizedGroup.add(model3D);
      const rawWidth = Math.max(size.x, 0.001);
      const rawHeight = Math.max(size.y, 0.001);
      const rawDepth = Math.max(size.z, 0.001);
      normalizedGroup.scale.set(1.0 / rawWidth, 1.0 / rawHeight, 1.0 / rawDepth);

      // Ensure all meshes have renderOrder = 2 (drawn AFTER face occluder renderOrder = 1)
      model3D.traverse((child) => {
        if (child.isMesh) {
          child.renderOrder = 2;
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            child.material.depthTest = true;
          }
        }
      });

      container.add(normalizedGroup);
      container.position.set(offset.x, offset.y, offset.z);
      container.rotation.set(rotationOffset.x, rotationOffset.y, rotationOffset.z);
      setIsFallbackActive(isFallback);
    };

    if (modelCacheRef.current.has(id)) {
      const cached = modelCacheRef.current.get(id);
      applyModelToScene(cached.clone(true), false);
      return;
    }

    try {
      if (!gltfLoaderRef.current) {
        gltfLoaderRef.current = new GLTFLoader();
      }

      // Check if file exists and is not an HTML fallback page
      const checkResp = await fetch(modelUrl, { method: 'HEAD' });
      const contentType = checkResp.headers.get('content-type') || '';
      if (!checkResp.ok || contentType.includes('text/html')) {
        throw new Error(`Model not found at ${modelUrl}`);
      }

      const gltf = await gltfLoaderRef.current.loadAsync(modelUrl);
      const sceneModel = gltf.scene || gltf.scenes[0];
      modelCacheRef.current.set(id, sceneModel);
      applyModelToScene(sceneModel.clone(true), false);
    } catch {
      // Gracefully fall back to procedural helmet generator (Zero-Crash Guarantee)
      const fallbackHelmet = createProceduralHelmet(helmetConfig);
      applyModelToScene(fallbackHelmet, true);
    }
  }, []);

  useEffect(() => {
    loadHelmetModel(helmets[selectedIdx]);
  }, [selectedIdx, loadHelmetModel]);

  useEffect(() => {
    const container = helmetContainerRef.current;
    if (!container) return;
    const current = helmets[selectedIdx];
    container.position.set(current.offset.x, current.offset.y, current.offset.z);
    container.rotation.set(
      current.rotationOffset.x,
      current.rotationOffset.y,
      current.rotationOffset.z
    );
  }, [helmets, selectedIdx]);

  // --- 4. INITIALIZE MEDIAPIPE FACE LANDMARKER & MOBILE-COMPATIBLE CAMERA FEED ---
  useEffect(() => {
    let isCancelled = false;
    let streamInstance = null;
    let animFrameId = null;

    async function initAR() {
      try {
        setLoadingStep('Accessing Front Camera...');

        // Multi-tier mobile camera stream acquisition
        const stream = await getMobileCompatibleCameraStream();

        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamInstance = stream;
        const video = videoRef.current;
        if (video) {
          video.setAttribute('playsinline', 'true');
          video.setAttribute('webkit-playsinline', 'true');
          video.setAttribute('muted', 'true');
          video.playsInline = true;
          video.muted = true;
          video.srcObject = stream;

          await new Promise((resolve) => {
            if (video.readyState >= 1) {
              resolve();
            } else {
              const onReady = () => {
                video.removeEventListener('loadedmetadata', onReady);
                video.removeEventListener('canplay', onReady);
                resolve();
              };
              video.addEventListener('loadedmetadata', onReady);
              video.addEventListener('canplay', onReady);
              setTimeout(resolve, 800);
            }
          });

          try {
            await video.play();
          } catch (playErr) {
            console.warn('Mobile video autoplay prevented by browser policy, prompting user tap:', playErr);
            setNeedsUserTapToPlay(true);
          }
        }

        setLoadingStep('Loading MediaPipe Face Landmarker...');
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        );

        if (isCancelled) return;

        let landmarker;
        try {
          landmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
              delegate: 'GPU',
            },
            outputFacialTransformationMatrixes: true,
            outputFaceBlendshapes: true,
            runningMode: 'VIDEO',
            numFaces: 1,
          });
        } catch (gpuErr) {
          console.warn('GPU delegate fallback to CPU:', gpuErr);
          landmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
              delegate: 'CPU',
            },
            outputFacialTransformationMatrixes: true,
            outputFaceBlendshapes: true,
            runningMode: 'VIDEO',
            numFaces: 1,
          });
        }

        if (isCancelled) return;
        faceLandmarkerRef.current = landmarker;

        await loadHelmetModel(activeHelmetConfigRef.current);
        setIsLoading(false);

        const rawMatrix = new THREE.Matrix4();
        const targetPos = new THREE.Vector3();
        const targetQuat = new THREE.Quaternion();
        const targetScale = new THREE.Vector3();

        let lastVideoTime = -1;
        let lastBiometricsUpdate = 0;

        const renderLoop = () => {
          animFrameId = requestAnimationFrame(renderLoop);

          const curVideo = videoRef.current;
          const container = containerRef.current;
          const landmarkerInstance = faceLandmarkerRef.current;
          const headAnchorGroup = headAnchorGroupRef.current;
          const helmetContainer = helmetContainerRef.current;
          const faceGeo = faceMeshGeoRef.current;
          const linesGeo = stylizedLinesGeoRef.current;
          const pointsGeo = stylizedPointsGeoRef.current;
          const camera = cameraRef.current;

          // DEMO MODE OVERRIDE: Floating center preview if toggled
          if (demoModeRef.current && headAnchorGroup && helmetContainer) {
            headAnchorGroup.matrix.setPosition(0, 0, -45);
            const userScaleMultiplier = activeHelmetConfigRef.current?.scale || 1.0;
            helmetContainer.scale.set(
              26.0 * userScaleMultiplier,
              31.5 * userScaleMultiplier,
              30.0 * userScaleMultiplier
            );
            headAnchorGroup.visible = true;
            if (rendererRef.current && sceneRef.current && camera) {
              rendererRef.current.render(sceneRef.current, camera);
            }
            return;
          }

          if (curVideo && curVideo.readyState >= 2 && landmarkerInstance && headAnchorGroup && camera && container) {
            if (curVideo.currentTime !== lastVideoTime) {
              lastVideoTime = curVideo.currentTime;
              const startTimeMs = performance.now();
              const results = landmarkerInstance.detectForVideo(curVideo, startTimeMs);

              if (
                results.facialTransformationMatrixes &&
                results.facialTransformationMatrixes.length > 0 &&
                results.faceLandmarks &&
                results.faceLandmarks[0]
              ) {
                missingFaceFramesRef.current = 0;

                const matrixData =
                  results.facialTransformationMatrixes[0]?.data ||
                  results.facialTransformationMatrixes[0];
                rawMatrix.fromArray(matrixData);
                rawMatrix.decompose(targetPos, targetQuat, targetScale);

                // Ensure head is placed in front of camera
                targetPos.z = -Math.abs(targetPos.z);

                // Mirror coordinates horizontally for selfie camera view (<video style="scaleX(-1)">)
                targetPos.x = -targetPos.x;
                targetQuat.y = -targetQuat.y;
                targetQuat.z = -targetQuat.z;

                // Exponential Moving Average (EMA) smoothing for zero vibration
                const LERP_FACTOR = 0.35;
                if (!hasInitialPoseRef.current) {
                  smoothedPosRef.current.copy(targetPos);
                  smoothedQuatRef.current.copy(targetQuat);
                  hasInitialPoseRef.current = true;
                } else {
                  smoothedPosRef.current.lerp(targetPos, LERP_FACTOR);
                  smoothedQuatRef.current.slerp(targetQuat, LERP_FACTOR);
                }

                // DYNAMIC ADAPTIVE FACE MESH: 478 Landmarks & Live Expressions
                const landmarks = results.faceLandmarks[0];
                const vw = curVideo.videoWidth || 1280;
                const vh = curVideo.videoHeight || 720;
                const cw = container.clientWidth || window.innerWidth;
                const ch = container.clientHeight || window.innerHeight;

                // Object-cover aspect scaling math
                const scale = Math.max(cw / vw, ch / vh);
                const rw = vw * scale;
                const rh = vh * scale;
                const dx = (rw - cw) / 2;
                const dy = (rh - ch) / 2;

                const depth = smoothedPosRef.current.z || -50;
                const fovRad = (camera.fov * Math.PI) / 180;
                const frustumHalfH = Math.abs(depth) * Math.tan(fovRad / 2);
                const frustumHalfW = frustumHalfH * (cw / ch);

                const posAttr = faceGeo.attributes.position;
                const linesPosAttr = linesGeo ? linesGeo.attributes.position : null;

                // 1. Map all 478 front face landmarks
                for (let i = 0; i < landmarks.length; i++) {
                  const lm = landmarks[i];
                  const sx = (1.0 - lm.x) * rw - dx;
                  const sy = lm.y * rh - dy;

                  const u = (sx / cw - 0.5) * 2;
                  const v = -(sy / ch - 0.5) * 2;

                  const px = u * frustumHalfW;
                  const py = v * frustumHalfH;
                  const pz = depth - (lm.z || 0) * (frustumHalfW * 2) * 1.35;
                  posAttr.setXYZ(i, px, py, pz);

                  if (linesPosAttr) {
                    linesPosAttr.setXYZ(i, px, py, pz);
                  }
                }

                // 2. Update Stylized Key Landmark Points (Matching left photo)
                if (pointsGeo) {
                  const ptsAttr = pointsGeo.attributes.position;
                  for (let i = 0; i < STYLIZED_VERTEX_ARRAY.length; i++) {
                    const lmIdx = STYLIZED_VERTEX_ARRAY[i];
                    ptsAttr.setXYZ(i, posAttr.getX(lmIdx), posAttr.getY(lmIdx), posAttr.getZ(lmIdx));
                  }
                  ptsAttr.needsUpdate = true;
                }

                if (linesPosAttr) {
                  linesPosAttr.needsUpdate = true;
                }

                // 3. Measure Biometric Dimensions (Temple-to-Temple Width and Forehead-to-Chin Height)
                const earLX = posAttr.getX(234);
                const earLY = posAttr.getY(234);
                const earLZ = posAttr.getZ(234);

                const earRX = posAttr.getX(454);
                const earRY = posAttr.getY(454);
                const earRZ = posAttr.getZ(454);

                const foreheadX = posAttr.getX(10);
                const foreheadY = posAttr.getY(10);
                const foreheadZ = posAttr.getZ(10);

                const chinX = posAttr.getX(152);
                const chinY = posAttr.getY(152);
                const chinZ = posAttr.getZ(152);

                const faceWidthCm = Math.hypot(earRX - earLX, earRY - earLY, earRZ - earLZ);
                const faceHeightCm = Math.hypot(chinX - foreheadX, chinY - foreheadY, chinZ - foreheadZ);

                // Head direction vectors in 3D camera space
                const headForward = new THREE.Vector3(0, 0, 1).applyQuaternion(smoothedQuatRef.current);
                const headUp = new THREE.Vector3(0, 1, 0).applyQuaternion(smoothedQuatRef.current);

                // 4. Extrude Cranium Back from the Live 36-Point Face Oval Contour
                // Protects helmet chin bar: the chin contour connects smoothly towards the throat/neck
                for (let i = 0; i < FACE_OVAL_RING.length; i++) {
                  const ringIdx = FACE_OVAL_RING[i];
                  const fx = posAttr.getX(ringIdx);
                  const fy = posAttr.getY(ringIdx);
                  const fz = posAttr.getZ(ringIdx);

                  const angleRatio = i / FACE_OVAL_RING.length;
                  const distBack = 11.0 + Math.cos(angleRatio * Math.PI * 2) * 2.5;

                  // Near chin (indices 15..22): curve backwards into throat so occluder NEVER erases the chin bar
                  const isChinRegion = i >= 15 && i <= 23;
                  const bx = fx - headForward.x * (isChinRegion ? 7.0 : distBack);
                  const by = fy - headForward.y * (isChinRegion ? 7.0 : distBack) - (isChinRegion ? 4.0 : 0);
                  const bz = fz - headForward.z * (isChinRegion ? 7.0 : distBack);

                  posAttr.setXYZ(478 + i, bx, by, bz);
                }

                // Cranium Apex (Vertex 514): Top/rear pole of head
                const craniumApexX = (earLX + earRX) * 0.5 - headForward.x * 12.5 + headUp.x * 4.0;
                const craniumApexY = (earLY + earRY) * 0.5 - headForward.y * 12.5 + headUp.y * 4.0;
                const craniumApexZ = (earLZ + earRZ) * 0.5 - headForward.z * 12.5 + headUp.z * 4.0;
                posAttr.setXYZ(514, craniumApexX, craniumApexY, craniumApexZ);

                posAttr.needsUpdate = true;
                faceGeo.computeVertexNormals();

                if (faceMeshMeshRef.current) {
                  faceMeshMeshRef.current.visible = true;
                }

                // 5. AUTOMATIC HEIGHT, WIDTH & DEPTH ADJUSTMENT (Fixes hair sticking out & chin bar clipping)
                // - Outer Width: standard adult helmet width (~26.0 - 28.5 cm)
                // - Outer Height: full cranium + hair volume (~31.5 - 35.0 cm, expands for long faces)
                // - Outer Depth: generous clearance so chin bar clears chin (~30.5 - 34.0 cm)
                const targetW = Math.max(faceWidthCm * 1.70, 26.0);
                const targetH = Math.max(faceHeightCm * 1.62, 31.5);
                const targetD = Math.max(targetW * 1.14, targetH * 0.96, 30.5);

                smoothedScaleRef.current.x += (targetW - smoothedScaleRef.current.x) * 0.25;
                smoothedScaleRef.current.y += (targetH - smoothedScaleRef.current.y) * 0.25;
                smoothedScaleRef.current.z += (targetD - smoothedScaleRef.current.z) * 0.25;

                // 6. POSITION HELMET WITH FORWARD CLEARANCE FOR CHIN BAR
                // Vertical Center: Centered between chin and top of skull dome (forehead + 7.5cm hair volume)
                const skullDomeY = foreheadY + headUp.y * 7.5;
                const helmetCenterY = (chinY + skullDomeY) * 0.5;
                const helmetCenterX = (earLX + earRX) * 0.5;
                const helmetCenterZ = (earLZ + earRZ) * 0.5;

                // Push helmet forward by +2.2 cm so the chin bar has generous clearance in front of the chin
                const helmetCenterPos = new THREE.Vector3(helmetCenterX, helmetCenterY, helmetCenterZ)
                  .addScaledVector(headForward, 2.2);

                headAnchorGroup.matrix.compose(
                  helmetCenterPos,
                  smoothedQuatRef.current,
                  new THREE.Vector3(1, 1, 1)
                );

                if (helmetContainer) {
                  const userScaleMultiplier = activeHelmetConfigRef.current?.scale || 1.0;
                  helmetContainer.scale.set(
                    smoothedScaleRef.current.x * userScaleMultiplier,
                    smoothedScaleRef.current.y * userScaleMultiplier,
                    smoothedScaleRef.current.z * userScaleMultiplier
                  );
                }

                headAnchorGroup.visible = true;
                setIsFaceDetected(true);

                // 7. Extract Live Facial Expressions (Smile & Jaw Movement)
                if (results.faceBlendshapes && results.faceBlendshapes[0]?.categories) {
                  const categories = results.faceBlendshapes[0].categories;
                  const smileL = categories.find((c) => c.categoryName === 'mouthSmileLeft')?.score || 0;
                  const smileR = categories.find((c) => c.categoryName === 'mouthSmileRight')?.score || 0;
                  const jaw = categories.find((c) => c.categoryName === 'jawOpen')?.score || 0;

                  const now = performance.now();
                  if (now - lastBiometricsUpdate > 100) {
                    lastBiometricsUpdate = now;
                    setBiometrics({
                      faceWidthCm: parseFloat(faceWidthCm.toFixed(1)),
                      faceHeightCm: parseFloat(faceHeightCm.toFixed(1)),
                      smilePercent: Math.round(Math.max(smileL, smileR) * 100),
                      jawOpenPercent: Math.round(jaw * 100),
                    });
                  }
                }
              } else {
                missingFaceFramesRef.current += 1;
                if (missingFaceFramesRef.current > 8) {
                  headAnchorGroup.visible = false;
                  if (faceMeshMeshRef.current) {
                    faceMeshMeshRef.current.visible = false;
                  }
                  setIsFaceDetected(false);
                  hasInitialPoseRef.current = false;
                }
              }
            }
          }

          if (rendererRef.current && sceneRef.current && camera) {
            rendererRef.current.render(sceneRef.current, camera);
          }
        };

        renderLoop();
      } catch (err) {
        console.error('AR Initialization Error:', err);
        if (err.message && err.message.startsWith('INSECURE_CONTEXT:')) {
          const targetUrl = err.message.replace('INSECURE_CONTEXT:', '');
          setInsecureHttpsUrl(targetUrl);
          setCameraError('HTTPS is required on mobile devices to access the front camera.');
        } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setCameraError(
            'Camera permission was denied. Please allow camera access in your mobile browser settings to try on helmets.'
          );
        } else {
          setCameraError(`Camera initialization failed: ${err.message}`);
        }
        setIsLoading(false);
      }
    }

    initAR();

    return () => {
      isCancelled = true;
      if (animFrameId) cancelAnimationFrame(animFrameId);
      if (streamInstance) {
        streamInstance.getTracks().forEach((track) => track.stop());
      }
    };
  }, [loadHelmetModel]);

  // --- 5. COMPOSITE SNAPSHOT GENERATOR ---
  const handleTakeSnapshot = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 350);

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;

    // 1. Draw mirrored video feed
    ctx.save();
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, width, height);
    ctx.restore();

    // 2. Draw 3D helmet overlay (already mirrored in 3D math)
    ctx.drawImage(canvas, 0, 0, width, height);

    // 3. Watermark
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.roundRect(24, height - 70, 240, 46, 12);
    ctx.fill();
    ctx.font = '600 18px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('🪖 3D Helmet Try-On', 40, height - 41);
    ctx.restore();

    // 4. Download
    offscreen.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `helmet-tryon-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSnapshotToast(true);
      setTimeout(() => setSnapshotToast(false), 3500);
    }, 'image/png');
  }, []);

  // --- 6. CALIBRATION HELPERS ---
  const updateActiveHelmet = (field, subfield, value) => {
    setHelmets((prev) => {
      const next = [...prev];
      const cur = { ...next[selectedIdx] };
      if (subfield) {
        cur[field] = { ...cur[field], [subfield]: parseFloat(value) };
      } else {
        cur[field] = parseFloat(value);
      }
      next[selectedIdx] = cur;
      return next;
    });
  };

  const resetCurrentCalibration = () => {
    const original = INITIAL_HELMETS.find((h) => h.id === helmets[selectedIdx].id);
    if (!original) return;
    setHelmets((prev) => {
      const next = [...prev];
      next[selectedIdx] = { ...original };
      return next;
    });
  };

  const copyConfigJson = () => {
    const active = helmets[selectedIdx];
    const exportConfig = {
      id: active.id,
      name: active.name,
      scale: active.scale,
      offset: active.offset,
      rotationOffset: active.rotationOffset,
    };
    navigator.clipboard.writeText(JSON.stringify(exportConfig, null, 2));
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2500);
  };

  const activeHelmet = helmets[selectedIdx];

  return (
    <div
      ref={containerRef}
      className="relative w-screen h-screen overflow-hidden bg-black flex items-center justify-center select-none"
    >
      {/* SHUTTER FLASH EFFECT */}
      {shutterFlash && (
        <div className="absolute inset-0 z-50 bg-white pointer-events-none animate-shutter-flash" />
      )}

      {/* --- LAYER 1: VIDEO FEED (Mirrored Selfie, z-1) --- */}
      <video
        ref={videoRef}
        playsInline
        webkit-playsinline="true"
        autoPlay
        muted
        style={{ transform: 'scaleX(-1)' }}
        className="absolute inset-0 w-full h-full object-cover z-[1]"
      />

      {/* --- LAYER 2: THREE.JS AR CANVAS (Directly composited, z-2) --- */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover z-[2] pointer-events-none"
      />

      {/* --- MOBILE AUTOPLAY TAP OVERLAY --- */}
      {needsUserTapToPlay && (
        <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center mb-4">
            <Smartphone className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Tap to Enable Camera</h2>
          <p className="text-xs text-zinc-300 max-w-xs mb-6">
            Mobile browsers require a single user tap to start video streaming.
          </p>
          <button
            onClick={async () => {
              if (videoRef.current) {
                try {
                  await videoRef.current.play();
                  setNeedsUserTapToPlay(false);
                } catch (e) {
                  console.error('Play failed on tap:', e);
                }
              }
            }}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-bold text-sm shadow-xl shadow-cyan-500/30 flex items-center gap-2 active:scale-95 transition-all"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Start Live Camera</span>
          </button>
        </div>
      )}

      {/* --- TOP BAR HEADER --- */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/85 via-black/45 to-transparent">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <span className="text-xl leading-none">🪖</span>
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              HelmetVision 3D
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 font-semibold border border-cyan-500/30">
                AR
              </span>
            </h1>
            <p className="text-[11px] text-gray-400">Live Auto-Fit AR Try-On</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Tracking Status Pill */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border backdrop-blur-md transition-all ${
              isLoading
                ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                : isFaceDetected || demoMode
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-zinc-800/80 border-zinc-700/50 text-zinc-400'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isLoading
                  ? 'bg-yellow-400 animate-pulse'
                  : isFaceDetected || demoMode
                  ? 'bg-emerald-400'
                  : 'bg-zinc-500'
              }`}
            />
            <span>
              {isLoading
                ? 'Init...'
                : demoMode
                ? 'Center Preview'
                : isFaceDetected
                ? 'Face Active'
                : 'Look at Camera'}
            </span>
          </div>

          {/* Center Preview Toggle */}
          <button
            onClick={() => setDemoMode((prev) => !prev)}
            title={demoMode ? 'Switch to Camera Face Tracking' : 'Force Show Helmet in Center'}
            className={`p-2 rounded-xl backdrop-blur-md border transition-all text-xs flex items-center gap-1 ${
              demoMode
                ? 'bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-600/30'
                : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-zinc-700/60'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{demoMode ? 'Live Track' : 'Preview'}</span>
          </button>

          {/* Stylized Face Mesh Wireframe Toggle (Yellow reference photo look) */}
          <button
            onClick={() => setShowFaceMeshDebug((prev) => !prev)}
            title={showFaceMeshDebug ? 'Hide Stylized Cyber Mesh' : 'Show Stylized Face Mesh'}
            className={`p-2 rounded-xl backdrop-blur-md border transition-all ${
              showFaceMeshDebug
                ? 'bg-yellow-400 text-black border-yellow-300 shadow-lg shadow-yellow-400/25'
                : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-zinc-700/60'
            }`}
          >
            {showFaceMeshDebug ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>

          {/* Calibrate Fit Toggle */}
          <button
            onClick={() => setShowCalibration((prev) => !prev)}
            title="Adjust Helmet Calibration"
            className={`p-2 rounded-xl backdrop-blur-md border transition-all ${
              showCalibration
                ? 'bg-cyan-500 text-black border-cyan-400 shadow-lg shadow-cyan-500/25'
                : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-zinc-700/60'
            }`}
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* Help Modal Toggle */}
          <button
            onClick={() => setShowHelpModal(true)}
            title="How to add custom .glb helmets"
            className="p-2 rounded-xl bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/60 backdrop-blur-md transition-all"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* --- LIVE BIOMETRICS HUD PILLS --- */}
      {isFaceDetected && !isLoading && (
        <div className="absolute top-16 left-4 z-20 flex flex-col gap-1.5 pointer-events-none">
          {/* Measured Face Width & Height */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900/85 border border-zinc-700/70 backdrop-blur-md text-cyan-300 text-[11px] shadow-lg">
            <span>📐</span>
            <span>
              W: <strong className="text-white">{biometrics.faceWidthCm} cm</strong> | H: <strong className="text-white">{biometrics.faceHeightCm} cm</strong>
            </span>
            <span className="text-[9px] bg-cyan-900/70 text-cyan-300 px-1 rounded">Auto-Fit</span>
          </div>

          {/* Real-Time Smile Detection */}
          {biometrics.smilePercent > 25 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/85 border border-emerald-500/50 backdrop-blur-md text-emerald-300 text-[11px] shadow-lg animate-pulse">
              <Smile className="w-3.5 h-3.5 text-emerald-400" />
              <span>Smiling: <strong className="text-white">{biometrics.smilePercent}%</strong></span>
            </div>
          )}

          {/* Real-Time Jaw Open Detection */}
          {biometrics.jawOpenPercent > 25 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/85 border border-amber-500/50 backdrop-blur-md text-amber-300 text-[11px] shadow-lg">
              <span>😮</span>
              <span>Jaw Open: <strong className="text-white">{biometrics.jawOpenPercent}%</strong></span>
            </div>
          )}
        </div>
      )}

      {/* --- FALLBACK ACTIVE NOTICE PILL --- */}
      {isFallbackActive && !isLoading && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 backdrop-blur-md text-cyan-300 text-[11px] flex items-center gap-1.5 shadow-lg shadow-cyan-950/50">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
          <span>Procedural 3D Helmet Active (Drop custom .glb into public/models/)</span>
        </div>
      )}

      {/* --- FACE GUIDE OVERLAY --- */}
      {!isFaceDetected && !demoMode && !isLoading && !cameraError && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
          <div className="w-64 h-80 rounded-[48%] border-2 border-dashed border-cyan-400/40 animate-pulse flex items-center justify-center">
            <span className="text-xs text-cyan-200/70 bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
              Align Face Here
            </span>
          </div>
        </div>
      )}

      {/* --- LOADING SPINNER OVERLAY --- */}
      {isLoading && (
        <div className="absolute inset-0 z-40 bg-black/90 backdrop-blur-lg flex flex-col items-center justify-center p-6 text-center">
          <div className="relative mb-6">
            <div className="w-16 h-16 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin" />
            <span className="absolute inset-0 flex items-center justify-center text-2xl">🪖</span>
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Setting Up Your 3D Try-On</h2>
          <p className="text-sm text-cyan-400 font-medium animate-pulse">{loadingStep}</p>
          <p className="text-xs text-zinc-500 mt-4 max-w-xs">
            Using Google MediaPipe 478-Point Tracking with Auto-Fit Proportions & Chin Clearance.
          </p>
        </div>
      )}

      {/* --- CAMERA ERROR / INSECURE CONTEXT CARD --- */}
      {cameraError && (
        <div className="absolute inset-0 z-40 bg-black/95 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-zinc-900/90 border border-red-500/30 rounded-2xl p-6 text-center backdrop-blur-xl shadow-2xl">
            {insecureHttpsUrl ? (
              <>
                <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">HTTPS Required for Mobile Camera</h3>
                <p className="text-xs text-zinc-300 mb-4 leading-relaxed">
                  Mobile browsers (iOS Safari & Android Chrome) disable camera APIs when accessed over plain HTTP on a local Wi-Fi IP. Please use the secure HTTPS address:
                </p>
                <a
                  href={insecureHttpsUrl}
                  className="w-full py-2.5 px-4 mb-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-bold text-xs hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Switch to HTTPS Link</span>
                </a>
                <p className="text-[11px] text-zinc-400">
                  Tip: When prompted with "Your connection is not private" (due to Vite's local dev SSL certificate), tap <strong>Advanced</strong> and then <strong>Proceed</strong>.
                </p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Camera Access Required</h3>
                <p className="text-sm text-zinc-400 mb-6">{cameraError}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Retry Camera
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* --- SNAPSHOT SUCCESS TOAST --- */}
      {snapshotToast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-black font-semibold text-xs rounded-full shadow-xl shadow-emerald-500/30 animate-bounce">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>Snapshot Saved to Downloads!</span>
        </div>
      )}

      {/* --- BOTTOM FLOATING CAROUSEL & CONTROLS --- */}
      <footer className="absolute bottom-0 left-0 right-0 z-20 p-4 pb-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col items-center gap-3.5">
        {/* Active Helmet Info Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900/80 border border-zinc-700/60 backdrop-blur-md">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: activeHelmet.thumbnailColor }}
          />
          <span className="text-xs font-semibold text-white">{activeHelmet.name}</span>
          <span className="text-[10px] text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-800">
            {activeHelmet.badge}
          </span>
        </div>

        {/* Helmet Selection Carousel */}
        <div className="w-full max-w-md flex items-center justify-center gap-3 overflow-x-auto py-1 px-2 no-scrollbar">
          {helmets.map((helmet, idx) => {
            const isSelected = idx === selectedIdx;
            return (
              <button
                key={helmet.id}
                onClick={() => setSelectedIdx(idx)}
                className={`relative group flex-shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-2xl border transition-all duration-200 active:scale-95 ${
                  isSelected
                    ? 'bg-zinc-800/90 border-cyan-400 shadow-lg shadow-cyan-500/20 scale-105'
                    : 'bg-zinc-900/70 hover:bg-zinc-800/60 border-zinc-800 text-zinc-400'
                }`}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shadow-inner relative overflow-hidden transition-transform group-hover:scale-105"
                  style={{
                    background: `radial-gradient(circle at 35% 35%, ${helmet.thumbnailColor}, #09090b)`,
                  }}
                >
                  <span className="text-xl">🪖</span>
                  {isSelected && (
                    <div className="absolute inset-0 border-2 border-cyan-400 rounded-xl" />
                  )}
                </div>

                <span
                  className={`text-[11px] font-medium max-w-[70px] truncate ${
                    isSelected ? 'text-white font-bold' : 'text-zinc-400'
                  }`}
                >
                  {helmet.name.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Snapshot Shutter Button */}
        <div className="flex items-center justify-center w-full mt-1">
          <button
            onClick={handleTakeSnapshot}
            disabled={isLoading || !!cameraError}
            title="Take AR Selfie Snapshot"
            className="group relative flex items-center justify-center w-16 h-16 rounded-full bg-white text-black shadow-xl hover:shadow-cyan-500/30 hover:scale-105 active:scale-90 transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            <div className="w-13 h-13 rounded-full border-2 border-black flex items-center justify-center">
              <Camera className="w-6 h-6 text-zinc-900 group-hover:text-cyan-600 transition-colors" />
            </div>
          </button>
        </div>
      </footer>

      {/* --- DEVELOPER CALIBRATION DRAWER --- */}
      {showCalibration && (
        <aside className="absolute top-16 right-4 bottom-24 z-30 w-80 max-w-[calc(100vw-2rem)] bg-zinc-950/95 border border-zinc-800 rounded-2xl backdrop-blur-2xl p-4 flex flex-col shadow-2xl overflow-y-auto">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold text-white tracking-wide uppercase">
                Fine-Tune 3D Fit
              </h3>
            </div>
            <button
              onClick={() => setShowCalibration(false)}
              className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[11px] text-zinc-400 mb-4">
            Custom adjustments for <span className="text-cyan-400 font-semibold">{activeHelmet.name}</span>:
          </p>

          <div className="space-y-4 text-xs">
            {/* SCALE MULTIPLIER SLIDER */}
            <div>
              <div className="flex justify-between text-zinc-300 mb-1">
                <span className="font-medium">Fit Scale Multiplier</span>
                <span className="font-mono text-cyan-400">{activeHelmet.scale.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.70"
                max="1.50"
                step="0.01"
                value={activeHelmet.scale}
                onChange={(e) => updateActiveHelmet('scale', null, e.target.value)}
                className="w-full accent-cyan-400 bg-zinc-800 rounded-lg cursor-pointer h-1.5"
              />
              <div className="flex justify-between text-[10px] text-zinc-500 mt-0.5">
                <span>Snug (0.7x)</span>
                <span>Default (1.0x)</span>
                <span>Loose (1.5x)</span>
              </div>
            </div>

            {/* TRANSLATION OFFSETS */}
            <div className="space-y-2 pt-2 border-t border-zinc-800/80">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                Position Offset (cm)
              </span>

              <div>
                <div className="flex justify-between text-zinc-300 mb-1">
                  <span>Horizontal (X)</span>
                  <span className="font-mono text-cyan-400">{activeHelmet.offset.x.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="-8.0"
                  max="8.0"
                  step="0.1"
                  value={activeHelmet.offset.x}
                  onChange={(e) => updateActiveHelmet('offset', 'x', e.target.value)}
                  className="w-full accent-cyan-400 bg-zinc-800 rounded-lg cursor-pointer h-1.5"
                />
              </div>

              <div>
                <div className="flex justify-between text-zinc-300 mb-1">
                  <span>Height (Y)</span>
                  <span className="font-mono text-cyan-400">{activeHelmet.offset.y.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="-8.0"
                  max="8.0"
                  step="0.1"
                  value={activeHelmet.offset.y}
                  onChange={(e) => updateActiveHelmet('offset', 'y', e.target.value)}
                  className="w-full accent-cyan-400 bg-zinc-800 rounded-lg cursor-pointer h-1.5"
                />
              </div>

              <div>
                <div className="flex justify-between text-zinc-300 mb-1">
                  <span>Depth (Z)</span>
                  <span className="font-mono text-cyan-400">{activeHelmet.offset.z.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="-10.0"
                  max="10.0"
                  step="0.1"
                  value={activeHelmet.offset.z}
                  onChange={(e) => updateActiveHelmet('offset', 'z', e.target.value)}
                  className="w-full accent-cyan-400 bg-zinc-800 rounded-lg cursor-pointer h-1.5"
                />
              </div>
            </div>

            {/* ROTATION OFFSETS */}
            <div className="space-y-2 pt-2 border-t border-zinc-800/80">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                Rotation Angles (rad)
              </span>

              <div>
                <div className="flex justify-between text-zinc-300 mb-1">
                  <span>Pitch (Tilt Up/Down)</span>
                  <span className="font-mono text-cyan-400">
                    {activeHelmet.rotationOffset.x.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="-0.8"
                  max="0.8"
                  step="0.02"
                  value={activeHelmet.rotationOffset.x}
                  onChange={(e) => updateActiveHelmet('rotationOffset', 'x', e.target.value)}
                  className="w-full accent-cyan-400 bg-zinc-800 rounded-lg cursor-pointer h-1.5"
                />
              </div>

              <div>
                <div className="flex justify-between text-zinc-300 mb-1">
                  <span>Yaw (Turn Left/Right)</span>
                  <span className="font-mono text-cyan-400">
                    {activeHelmet.rotationOffset.y.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="-0.8"
                  max="0.8"
                  step="0.02"
                  value={activeHelmet.rotationOffset.y}
                  onChange={(e) => updateActiveHelmet('rotationOffset', 'y', e.target.value)}
                  className="w-full accent-cyan-400 bg-zinc-800 rounded-lg cursor-pointer h-1.5"
                />
              </div>
            </div>

            {/* STYLIZED CYBER WIREFRAME DEBUG TOGGLE */}
            <div className="pt-2 border-t border-zinc-800/80">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900 border border-zinc-800">
                <div>
                  <span className="text-xs font-semibold text-yellow-400 block">
                    Stylized Low-Density Mesh
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    Crisp yellow contour, polygonal facets & key landmark dots
                  </span>
                </div>
                <button
                  onClick={() => setShowFaceMeshDebug((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                    showFaceMeshDebug
                      ? 'bg-yellow-400 text-black'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {showFaceMeshDebug ? 'Visible' : 'Hidden'}
                </button>
              </div>
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="mt-6 pt-3 border-t border-zinc-800 space-y-2">
            <button
              onClick={copyConfigJson}
              className="w-full py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold flex items-center justify-center gap-1.5 transition-all text-xs active:scale-95 shadow-md shadow-cyan-500/20"
            >
              {copiedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Config JSON Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Config JSON</span>
                </>
              )}
            </button>

            <button
              onClick={resetCurrentCalibration}
              className="w-full py-1.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 font-medium flex items-center justify-center gap-1.5 transition-all text-xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Defaults</span>
            </button>
          </div>
        </aside>
      )}

      {/* --- HELP MODAL: SKETCHFAB .GLB IMPORT GUIDE --- */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-zinc-300 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">🪖</span>
                <h3 className="text-base font-bold text-white">How to Add Custom Helmets</h3>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ol className="space-y-3 text-xs leading-relaxed">
              <li className="flex gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center text-[11px]">
                  1
                </span>
                <span>
                  Download any 3D helmet model in <strong className="text-white">.glb / .gltf</strong> format (e.g. from Sketchfab).
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center text-[11px]">
                  2
                </span>
                <span>
                  Place your file into the folder: <code className="text-cyan-300 bg-zinc-800 px-1.5 py-0.5 rounded">public/models/helmet1.glb</code>. The app automatically scales width and height to fit your face!
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 font-bold flex items-center justify-center text-[11px]">
                  3
                </span>
                <span>
                  Open <strong className="text-white">Fine-Tune 3D Fit</strong> (sliders icon), adjust fine-tuning scale and offsets, then click <strong className="text-white">Copy Config JSON</strong> to save.
                </span>
              </li>
            </ol>

            <button
              onClick={() => setShowHelpModal(false)}
              className="w-full mt-6 py-2.5 rounded-xl bg-cyan-500 text-black font-semibold text-xs hover:bg-cyan-400 transition-colors"
            >
              Got it, let's try!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
