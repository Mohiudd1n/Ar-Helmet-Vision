import * as THREE from 'three';
import { FaceLandmarker } from '@mediapipe/tasks-vision';
import { CANONICAL_FACE_VERTICES } from './canonicalFace.js';
import { EYE_LOOP_LEFT, EYE_LOOP_RIGHT, LIPS_INNER_LOOP } from './faceTopology.js';

/**
 * A head-shaped, depth-only mesh that lives in head space (canonical face frame, cm).
 *
 * It is drawn before the helmet with colorWrite=false, so it writes depth without
 * drawing any colour. Helmet geometry that sits *behind* the user's real head
 * (inner liner, back of the shell seen through the eye port, strap anchors) fails the
 * depth test and the camera image shows through. Parts in front of the head (chin bar,
 * visor, peak, cheek pads hugging the face) still draw normally.
 *
 * Built from three rigid parts, all attached to the tracked head pose, so the occluder
 * moves exactly with the helmet and never jitters on its own:
 *   1. the canonical face surface (eyes and mouth closed up, pushed back slightly)
 *   2. a skull ellipsoid covering forehead, crown, sides and back of the head
 *   3. a neck cylinder, so the helmet's lower rim is hidden behind the neck
 */

const FACE_INSET_CM = 0.6; // keep helmet parts that hug the face visible

function fanTriangles(loop) {
  const tris = [];
  for (let i = 1; i < loop.length - 1; i++) tris.push(loop[0], loop[i], loop[i + 1]);
  return tris;
}

function buildFaceGeometry() {
  const tess = FaceLandmarker.FACE_LANDMARKS_TESSELATION;
  const indices = [];
  for (let i = 0; i + 2 < tess.length; i += 3) {
    indices.push(tess[i].start, tess[i + 1].start, tess[i + 2].start);
  }
  // Close the eye and mouth openings so the helmet interior can't show through them.
  indices.push(...fanTriangles(EYE_LOOP_LEFT), ...fanTriangles(EYE_LOOP_RIGHT), ...fanTriangles(LIPS_INNER_LOOP));

  const positions = new Float32Array(CANONICAL_FACE_VERTICES);
  for (let i = 0; i < positions.length; i += 3) positions[i + 2] -= FACE_INSET_CM;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  return geo;
}

export const SKULL = { center: [0, 3.0, -4.8], radii: [7.8, 10.2, 9.6] };
export const NECK = { center: [0, -14, -5.5], radius: 5.6, height: 22 };

export function createHeadOccluder({ debug = false } = {}) {
  const material = debug
    ? new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true, transparent: true, opacity: 0.35 })
    : new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, depthTest: true });
  material.side = THREE.DoubleSide;

  const group = new THREE.Group();
  group.name = 'head-occluder';

  const face = new THREE.Mesh(buildFaceGeometry(), material);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), material);
  skull.position.set(...SKULL.center);
  skull.scale.set(...SKULL.radii);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(NECK.radius, NECK.radius * 1.1, NECK.height, 28), material);
  neck.position.set(...NECK.center);
  neck.rotation.x = -0.12; // the neck leans forward slightly under the skull

  for (const mesh of [face, skull, neck]) {
    mesh.renderOrder = -10; // draw before every helmet mesh
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  return group;
}

/** Typical hair volume around the skull (cm). Helmet shells must cover this. */
export const HAIR_VOLUME_CM = 2.5;
const FACE_CUT_Z = -1.5; // liner is open in front of this depth (cm) below the brow line

/**
 * Dark padded comfort liner, like the EPS/foam lining of a real helmet.
 * A visible (not depth-only) cap just outside the skull, open in front of the face
 * below `browY` and cut off below `bottomY`. Through the eye port you see padding
 * on the forehead, temples and around the ears instead of the user's hair.
 * It sits inside the shell, so from outside the shell hides it.
 */
export function createHelmetLiner({ browY = 4.6, bottomY = -3, thicknessCm = 1.2, color = 0x17171a } = {}) {
  const sphere = new THREE.SphereGeometry(1, 64, 40).toNonIndexed();
  const pos = sphere.attributes.position;
  const radii = SKULL.radii.map((r) => r + thicknessCm);
  const kept = [];
  const v = new THREE.Vector3();
  const tri = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (let i = 0; i < pos.count; i += 3) {
    for (let k = 0; k < 3; k++) {
      v.fromBufferAttribute(pos, i + k);
      tri[k].set(v.x * radii[0] + SKULL.center[0], v.y * radii[1] + SKULL.center[1], v.z * radii[2] + SKULL.center[2]);
    }
    // Coarse cut here (whole triangles well inside the face opening / below the rim);
    // the exact, smooth edge is cut per pixel in the shader below.
    const maxY = Math.max(tri[0].y, tri[1].y, tri[2].y);
    const minZ = Math.min(tri[0].z, tri[1].z, tri[2].z);
    if (maxY < bottomY || (maxY < browY && minZ > FACE_CUT_Z)) continue;
    for (const p of tri) kept.push(p.x, p.y, p.z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(kept, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uBrowY = { value: browY };
    shader.uniforms.uBottomY = { value: bottomY };
    shader.uniforms.uFaceCutZ = { value: FACE_CUT_Z };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHeadPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHeadPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHeadPos;\nuniform float uBrowY;\nuniform float uBottomY;\nuniform float uFaceCutZ;')
      .replace('void main() {', 'void main() {\n  if (vHeadPos.y < uBottomY || (vHeadPos.y < uBrowY && vHeadPos.z > uFaceCutZ)) discard;');
  };
  mat.customProgramCacheKey = () => `liner:${browY}:${bottomY}`;
  const liner = new THREE.Mesh(geo, mat);
  liner.name = 'helmet-liner';
  liner.frustumCulled = false;
  return liner;
}
