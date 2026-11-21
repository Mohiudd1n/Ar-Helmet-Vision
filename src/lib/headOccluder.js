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
