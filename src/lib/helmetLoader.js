import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { cachedFetchBuffer } from './assetCache.js';
import { createHelmetLiner } from './headOccluder.js';

/**
 * Loads helmet .glb files once and hands out fitted clones.
 *
 * Every helmet is normalised into "head space": the MediaPipe canonical face
 * coordinate frame (centimetres, +Y up, +Z out of the face). Once a helmet is in
 * head space it can be parented directly to the tracked head pose, rendered in
 * the catalog next to nothing at all, or checked against the canonical face in
 * the Fit Studio. All three use exactly the same transform.
 */

const loader = new GLTFLoader();
const sceneCache = new Map(); // url -> Promise<THREE.Object3D>

export function loadHelmetScene(url, onProgress) {
  if (!sceneCache.has(url)) {
    // Bytes come from Cache Storage after the first visit; GLTFLoader just parses them.
    const promise = cachedFetchBuffer(url, onProgress)
      .then((buffer) => new Promise((resolve, reject) => {
        loader.parse(buffer, '', (gltf) => {
          const root = gltf.scene || gltf.scenes[0];
          prepareMaterials(root);
          resolve(root);
        }, reject);
      }))
      .catch((err) => {
        sceneCache.delete(url);
        throw err;
      });
    sceneCache.set(url, promise);
  }
  return sceneCache.get(url);
}

/** Start downloading a helmet in the background (e.g. while the user browses). */
export function preloadHelmet(helmet) {
  return loadHelmetScene(helmet.modelUrl).catch(() => {});
}

function prepareMaterials(root) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.frustumCulled = false; // the head moves fast; never pop out at screen edges
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const m of mats) {
      if (!m) continue;
      if (m.map) m.map.anisotropy = 4;
      // Sketchfab exports sometimes flag opaque shells as transparent, which breaks
      // depth sorting against the head occluder. Only keep blending for real glass.
      if (m.transparent && m.opacity >= 0.98 && !m.alphaMap && !(m.transmission > 0)) {
        m.transparent = false;
        m.depthWrite = true;
      }
      m.needsUpdate = true;
    }
  });
}

/**
 * Returns a THREE.Group whose children are a clone of the helmet model,
 * oriented, scaled and positioned into head space according to `helmet.fit`:
 *
 *   fit.rotation  [x, y, z] radians – turns the raw model so its front faces +Z and top faces +Y
 *   fit.width     outer shell width in cm (left-right), sets the uniform scale
 *   fit.center    [x, y, z] cm – where the centre of the shell's bounding box sits in head space
 *
 * `sizeScale` (S/M/L/XL) multiplies the scale around the head centre.
 */
export async function createFittedHelmet(helmet, { sizeScale = 1 } = {}) {
  const source = await loadHelmetScene(helmet.modelUrl);
  const model = source.clone(true);

  // Drop meshes that aren't part of the helmet (ground planes, dangling straps) before
  // measuring, so they neither show nor skew the bounding box used for scale and centre.
  if (helmet.hide?.length) {
    const drop = [];
    model.traverse((o) => { if (o.isMesh && helmet.hide.includes(o.name)) drop.push(o); });
    drop.forEach((o) => o.removeFromParent());
  }

  const oriented = new THREE.Group();
  oriented.rotation.set(...helmet.fit.rotation);
  oriented.add(model);
  oriented.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(oriented, true);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const scale = helmet.fit.width / Math.max(size.x, 1e-6);
  const scaled = new THREE.Group();
  scaled.add(oriented);
  oriented.position.copy(center).multiplyScalar(-1); // centre the bbox on the origin
  scaled.scale.setScalar(scale);

  const fitted = new THREE.Group();
  fitted.name = `helmet:${helmet.id}`;
  fitted.add(scaled);
  scaled.position.set(...helmet.fit.center);
  // Opt-in padded inner liner (in head space) so hair never shows through the eye port.
  if (helmet.liner) fitted.add(createHelmetLiner(helmet.liner === true ? {} : helmet.liner));
  fitted.scale.setScalar(sizeScale);

  fitted.userData.dimensionsCm = size.clone().multiplyScalar(scale);
  fitted.userData.setVisor = createVisorController(model, helmet.visor);
  return fitted;
}

/**
 * Visor modes for helmets whose visor is a separate mesh:
 *   'smoked' – see-through tinted shield (default in AR so the face stays visible)
 *   'down'   – the original opaque look from the model
 *   'up'     – visor hidden, as if flipped up / removed
 * Returns a setter, or a no-op for helmets without a visor.
 */
function createVisorController(model, visorConfig) {
  if (!visorConfig) return () => {};
  const visorMeshes = [];
  model.traverse((o) => {
    if (o.isMesh && visorConfig.meshes.includes(o.name)) visorMeshes.push(o);
  });
  if (!visorMeshes.length) return () => {};

  for (const mesh of visorMeshes) {
    const original = mesh.material;
    const smoked = original.clone();
    smoked.transparent = true;
    smoked.opacity = 0.42;
    smoked.depthWrite = false;
    smoked.color = new THREE.Color(visorConfig.tint || '#111111');
    smoked.map = null; // a plain tinted shield reads better than the baked texture
    smoked.roughness = 0.05;
    smoked.metalness = 0.1;
    smoked.envMapIntensity = 1.4;
    mesh.userData.visorMaterials = { down: original, smoked };
    mesh.renderOrder = 2; // after the opaque shell
  }

  return (mode) => {
    for (const mesh of visorMeshes) {
      mesh.visible = mode !== 'up';
      mesh.material = mode === 'down' ? mesh.userData.visorMaterials.down : mesh.userData.visorMaterials.smoked;
    }
  };
}

/** Scale multipliers for the size selector (M is the calibrated fit). */
export const HELMET_SIZES = [
  { id: 'S', label: 'S', scale: 0.95, headCm: '55–56' },
  { id: 'M', label: 'M', scale: 1.0, headCm: '57–58' },
  { id: 'L', label: 'L', scale: 1.05, headCm: '59–60' },
  { id: 'XL', label: 'XL', scale: 1.1, headCm: '61–62' },
];
