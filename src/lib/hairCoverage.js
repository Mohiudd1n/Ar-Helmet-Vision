import * as THREE from 'three';
import { SKULL, HAIR_VOLUME_CM } from './headOccluder.js';
import { CANONICAL_FACE_VERTICES } from './canonicalFace.js';

/**
 * Developer checks for helmet fits (used by the Fit Studio, head space in cm):
 *
 *  - hair coverage: in every direction from the skull centre, does the helmet shell reach
 *    past the hair volume (skull + HAIR_VOLUME_CM)? Only directions where hair grows are
 *    checked: above the hairline at the front, above the ears at the sides, and down to the
 *    nape at the back.
 *  - face checks: how much of the view out of the eyes the shell blocks (visor meshes don't
 *    count), and whether a full-face chin bar stays in front of the mouth and reaches below the chin.
 *
 * Works on a point cloud of the helmet's vertices, so a candidate fit (shift + scale) can be
 * scored without rebuilding the model; `autoFitHair` searches small changes to `fit`.
 */

const AZ = 32; // azimuth bins around the vertical axis
const EL = 16; // elevation bins, bottom to top
const BIN_COUNT = AZ * EL;
const MAX_POINTS = 16000;
const C = new THREE.Vector3(...SKULL.center);
const HAIR_R = SKULL.radii.map((r) => r + HAIR_VOLUME_CM);

const fv = (i) => new THREE.Vector3(CANONICAL_FACE_VERTICES[i * 3], CANONICAL_FACE_VERTICES[i * 3 + 1], CANONICAL_FACE_VERTICES[i * 3 + 2]);
const mid = (a, b) => fv(a).add(fv(b)).multiplyScalar(0.5);
const EYES = [mid(159, 145), mid(386, 374)];
// A small grid of sight lines around each eye (cm offsets), so one thin frame edge doesn't decide.
const EYE_RAYS = EYES.flatMap((e) => [-1, 0, 1].flatMap((dx) => [-0.6, 0, 0.6].map((dy) => e.clone().add(new THREE.Vector3(dx, dy, 0)))));
const MOUTH = mid(13, 14);
const CHIN = fv(152);

const binOf = (x, y, z) => {
  const az = Math.min(AZ - 1, Math.floor(((Math.atan2(x, z) + Math.PI) / (2 * Math.PI)) * AZ));
  const el = Math.min(EL - 1, Math.max(0, Math.floor(((y + 1) / 2) * EL))); // equal-area rows
  return el * AZ + az;
};

// Direction bins (equal-area grid: uniform in azimuth and in height); each keeps the hair-surface point at its centre and its region.
const BINS = (() => {
  const bins = [];
  for (let i = 0; i < BIN_COUNT; i++) {
    const az = ((i % AZ) + 0.5) / AZ * 2 * Math.PI - Math.PI;
    const el = Math.asin(((Math.floor(i / AZ) + 0.5) / EL) * 2 - 1);
    const d = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    // Point on the hair ellipsoid in direction d from the centre.
    const k = 1 / Math.sqrt((d.x / HAIR_R[0]) ** 2 + (d.y / HAIR_R[1]) ** 2 + (d.z / HAIR_R[2]) ** 2);
    const p = d.clone().multiplyScalar(k).add(C);
    let region = null;
    if (p.z > 0) { if (p.y >= 8) region = 'front'; }
    else if (p.z > -8) { if (p.y >= 2) region = p.y > 10 ? 'top' : p.x > 0 ? 'right' : 'left'; }
    else if (p.y >= -3) region = p.y > 10 ? 'top' : 'back';
    bins.push({ d, hairDist: k, region });
  }
  return bins;
})();

/**
 * Points spread evenly over the helmet's surface (area-weighted, in head space), split into
 * all points and shell points (visor meshes excluded). Even spacing matters: big smooth shell
 * panels have few vertices, so sampling vertices would leave holes in the coverage map.
 */
export function sampleHelmet(fitted, visorNames = []) {
  fitted.updateMatrixWorld(true);
  const toHead = new THREE.Matrix4().copy(fitted.parent ? fitted.parent.matrixWorld : new THREE.Matrix4()).invert();
  const tris = []; // [a, b, c, area, isVisor]
  let totalArea = 0;
  fitted.traverse((o) => {
    if (!o.isMesh || !o.visible || o.name === 'helmet-liner') return;
    const pos = o.geometry.attributes.position;
    const index = o.geometry.index;
    const m = new THREE.Matrix4().multiplyMatrices(toHead, o.matrixWorld);
    const isVisor = visorNames.includes(o.name);
    const count = index ? index.count : pos.count;
    const at = (i) => new THREE.Vector3().fromBufferAttribute(pos, index ? index.getX(i) : i).applyMatrix4(m);
    for (let i = 0; i + 2 < count; i += 3) {
      const a = at(i), b = at(i + 1), c = at(i + 2);
      const area = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).length() / 2;
      if (area <= 0) continue;
      tris.push([a, b, c, area, isVisor]);
      totalArea += area;
    }
  });
  const all = [];
  const shell = [];
  const perArea = MAX_POINTS / totalArea;
  let carry = 0;
  for (const [a, b, c, area, isVisor] of tris) {
    carry += area * perArea;
    const n = Math.floor(carry);
    carry -= n;
    for (let j = 0; j < n; j++) {
      let r1 = Math.random(), r2 = Math.random();
      if (r1 + r2 > 1) { r1 = 1 - r1; r2 = 1 - r2; }
      const x = a.x + (b.x - a.x) * r1 + (c.x - a.x) * r2;
      const y = a.y + (b.y - a.y) * r1 + (c.y - a.y) * r2;
      const z = a.z + (b.z - a.z) * r1 + (c.z - a.z) * r2;
      all.push(x, y, z);
      if (!isVisor) shell.push(x, y, z);
    }
  }
  return { all: new Float32Array(all), shell: new Float32Array(shell) };
}

function rayBlocked(points, origin, k, center, shift, radius = 0.5) {
  // Is any point within `radius` of the forward (+Z) ray from `origin`?
  for (let i = 0; i < points.length; i += 3) {
    const x = center.x + (points[i] - center.x) * k + shift.x;
    const y = center.y + (points[i + 1] - center.y) * k + shift.y;
    const z = center.z + (points[i + 2] - center.z) * k + shift.z;
    if (z > origin.z + 0.5 && (x - origin.x) ** 2 + (y - origin.y) ** 2 < radius * radius) return true;
  }
  return false;
}

/**
 * Score a fit. `k` scales the helmet about `center` (the fit centre) and `shift` moves it,
 * i.e. the candidate is { width: width * k, center: center + shift }.
 */
export function scoreFit(sample, center, k = 1, shift = new THREE.Vector3()) {
  const maxR = new Float32Array(BIN_COUNT).fill(-Infinity);
  const pts = sample.all;
  const u = new THREE.Vector3();
  for (let i = 0; i < pts.length; i += 3) {
    u.set(center.x + (pts[i] - center.x) * k + shift.x, center.y + (pts[i + 1] - center.y) * k + shift.y, center.z + (pts[i + 2] - center.z) * k + shift.z).sub(C);
    const r = u.length();
    const best = binOf(u.x / r, u.y / r, u.z / r);
    if (r > maxR[best]) maxR[best] = r;
  }
  const regions = {};
  let checked = 0, covered = 0, worst = Infinity;
  BINS.forEach((bin, b) => {
    if (!bin.region) return;
    const margin = maxR[b] - bin.hairDist;
    checked++;
    if (margin >= 0) covered++;
    worst = Math.min(worst, margin);
    regions[bin.region] = Math.min(regions[bin.region] ?? Infinity, margin);
  });
  const eyeBlock = EYE_RAYS.filter((e) => rayBlocked(sample.shell, e, k, center, shift)).length / EYE_RAYS.length;
  const mouthCovered = rayBlocked(sample.all, MOUTH, k, center, shift, 1.5);
  // Chin bar reaches below the chin (front, centre): the chin stays inside a full-face helmet.
  let lowestFront = Infinity;
  for (let i = 0; i < pts.length; i += 3) {
    const x = center.x + (pts[i] - center.x) * k + shift.x;
    const z = center.z + (pts[i + 2] - center.z) * k + shift.z;
    if (z > CHIN.z - 2 && Math.abs(x) < 4) lowestFront = Math.min(lowestFront, center.y + (pts[i + 1] - center.y) * k + shift.y);
  }
  const chinCovered = lowestFront < CHIN.y - 1;
  return { coverage: covered / checked, worst, regions, eyeBlock, mouthCovered, chinCovered };
}

/** Readable summary for the studio panel / console. */
export function describeScore(s) {
  const r = Object.entries(s.regions).map(([k, v]) => `${k} ${v >= 0 ? '+' : ''}${v.toFixed(1)}`).join(' · ');
  return `hair ${(s.coverage * 100).toFixed(0)}% covered (worst ${s.worst.toFixed(1)} cm) · ${r} · eye lines blocked ${(s.eyeBlock * 100).toFixed(0)}%`;
}

/**
 * Search small changes to the fit that cover the hair while keeping the eyes clear
 * (and a full-face chin bar in front of the mouth). Prefers the smallest change.
 * Returns { fit, score }.
 */
export function autoFitHair(sample, fit, { maxGrow = 1.2, minMargin = 1.0, eyeSlack = 0.12 } = {}) {
  const center = new THREE.Vector3(...fit.center);
  const base = scoreFit(sample, center);
  const fullFace = base.mouthCovered; // keep chin bar over mouth and chin
  const eyeLimit = base.eyeBlock + eyeSlack; // never hide noticeably more of the eyes than the calibrated fit
  let best = null;
  for (let k = 1; k <= maxGrow + 1e-6; k += 0.025) {
    for (let dy = -1; dy <= 4.01; dy += 0.5) {
      for (let dz = -3; dz <= 1.51; dz += 0.5) {
        const shift = new THREE.Vector3(0, dy, dz);
        const s = scoreFit(sample, center, k, shift);
        if (s.eyeBlock > eyeLimit || (fullFace && (!s.mouthCovered || !s.chinCovered))) continue;
        // Cover everything (up to minMargin), then prefer the smallest change.
        const short = Math.max(0, minMargin - s.worst);
        const cost = short * 100 + s.eyeBlock * 20 + (k - 1) * 40 + Math.abs(dy) * 0.6 + Math.abs(dz) * 0.6;
        if (!best || cost < best.cost) best = { cost, k, shift, score: s };
      }
    }
  }
  if (!best) return { fit, score: base };
  return {
    fit: {
      rotation: fit.rotation,
      width: +(fit.width * best.k).toFixed(2),
      center: [center.x + best.shift.x, center.y + best.shift.y, center.z + best.shift.z].map((v) => +v.toFixed(2)),
    },
    score: best.score,
  };
}
