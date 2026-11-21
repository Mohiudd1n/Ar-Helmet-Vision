import * as THREE from 'three';

/**
 * Procedural 3D Helmet Generator
 * 
 * Creates a detailed, PBR-shaded helmet group using native Three.js primitives.
 * Automatically used as a zero-crash fallback if a .glb model is missing or fails to load.
 * 
 * Supports variants:
 * - 'full-face' : Aerodynamic racing shell, full chin guard, clear/tinted curved visor, rear spoiler
 * - 'street'    : Urban matte shell, angular chin bar, vents, smoke visor
 * - 'open-face' : Classic 3/4 retro open shell, chrome lining trim, bubble shield
 * - 'neon-sport': Aggressive race vents, iridescent visor, dual intakes
 */
export function createProceduralHelmet(config) {
  const helmetGroup = new THREE.Group();
  helmetGroup.name = `procedural-helmet-${config.id || 'default'}`;

  const type = config.type || 'full-face';
  const shellHex = config.shellColor || '#1c1c20';
  const accentHex = config.accentColor || '#ef4444';
  const visorHex = config.visorTint || '#38bdf8';

  // --- Materials ---
  // Using MeshPhysicalMaterial for shell so clearcoat and clearcoatRoughness are fully supported
  const shellMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(shellHex),
    roughness: type === 'street' ? 0.75 : 0.2,
    metalness: type === 'open-face' ? 0.15 : 0.6,
    clearcoat: type === 'street' ? 0.1 : 0.85,
    clearcoatRoughness: 0.15,
    side: THREE.DoubleSide,
  });

  const accentMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(accentHex),
    roughness: 0.25,
    metalness: 0.8,
    side: THREE.DoubleSide,
  });

  const paddingMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(type === 'open-face' ? '#451a03' : '#111113'),
    roughness: 0.95,
    metalness: 0.05,
    side: THREE.BackSide,
  });

  const chromeMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#e2e8f0'),
    roughness: 0.1,
    metalness: 0.95,
  });

  const darkVentMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#09090b'),
    roughness: 0.7,
    metalness: 0.3,
  });

  const visorMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(visorHex),
    transparent: true,
    opacity: 0.7,
    transmission: 0.55,
    roughness: 0.08,
    metalness: 0.15,
    ior: 1.5,
    side: THREE.DoubleSide,
    depthWrite: false, // Allows seeing interior face through visor
  });

  // Base dimensions: head is ~8.5cm radius, helmet outer shell is ~11.5cm radius
  const shellRadius = 11.5;

  // 1. TOP DOME SHELL (Upper hemisphere covering skull)
  // Starts at top pole (0) and sweeps down to eyebrow level (0.44 * PI)
  const topDomeGeo = new THREE.SphereGeometry(
    shellRadius,
    40,
    20,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.44
  );
  const topDome = new THREE.Mesh(topDomeGeo, shellMaterial);
  topDome.position.set(0, 1.2, -0.5);
  topDome.scale.set(1.0, 1.05, 1.08);
  helmetGroup.add(topDome);

  // 2. BACK & SIDES WRAPAROUND SHELL
  // Cylinder arc wrapping from left ear, around the back of head, to right ear
  // Leaves the FRONT open for the face/visor opening!
  // Theta start at PI * 0.22, length PI * 1.56 (leaving ~80 deg front face open)
  const rearWrapGeo = new THREE.CylinderGeometry(
    shellRadius,
    shellRadius * 0.94,
    10.5,
    36,
    1,
    true,
    Math.PI * 0.22,
    Math.PI * 1.56
  );
  const rearWrap = new THREE.Mesh(rearWrapGeo, shellMaterial);
  rearWrap.position.set(0, -3.2, -0.8);
  rearWrap.scale.set(1.0, 1.0, 1.08);
  helmetGroup.add(rearWrap);

  // Inner padding for rear wrap
  const rearPadGeo = new THREE.CylinderGeometry(
    shellRadius * 0.92,
    shellRadius * 0.86,
    10.0,
    32,
    1,
    true,
    Math.PI * 0.22,
    Math.PI * 1.56
  );
  const rearPad = new THREE.Mesh(rearPadGeo, paddingMaterial);
  rearPad.position.copy(rearWrap.position);
  rearPad.scale.copy(rearWrap.scale);
  helmetGroup.add(rearPad);

  // 3. FULL-FACE & SPORT: CHIN GUARD BAR
  if (type !== 'open-face') {
    // Chin bar wraps across the front jaw
    // Arc across the front: -PI * 0.28 to +PI * 0.28 (~100 deg)
    const chinBarGeo = new THREE.CylinderGeometry(
      shellRadius * 1.01,
      shellRadius * 0.95,
      4.6,
      32,
      1,
      true,
      -Math.PI * 0.28,
      Math.PI * 0.56
    );
    const chinBar = new THREE.Mesh(chinBarGeo, shellMaterial);
    chinBar.position.set(0, -7.2, 0.4);
    chinBar.scale.set(1.02, 1.0, 1.15);
    helmetGroup.add(chinBar);

    // Front chin air vent grill
    const grillGeo = new THREE.BoxGeometry(4.2, 1.5, 1.0);
    const grillMesh = new THREE.Mesh(grillGeo, darkVentMaterial);
    grillMesh.position.set(0, -7.2, 11.2);
    helmetGroup.add(grillMesh);

    // Chin accent strip
    const chinAccentGeo = new THREE.BoxGeometry(4.8, 0.45, 1.1);
    const chinAccentMesh = new THREE.Mesh(chinAccentGeo, accentMaterial);
    chinAccentMesh.position.set(0, -5.8, 11.0);
    helmetGroup.add(chinAccentMesh);
  }

  // 4. VISOR SHIELD (Transparent front shield)
  if (type === 'open-face') {
    // Retro curved bubble shield
    const bubbleGeo = new THREE.SphereGeometry(
      shellRadius * 1.05,
      32,
      20,
      -Math.PI * 0.28,
      Math.PI * 0.56,
      Math.PI * 0.28,
      Math.PI * 0.44
    );
    const bubbleMesh = new THREE.Mesh(bubbleGeo, visorMaterial);
    bubbleMesh.position.set(0, -1.0, 0.2);
    bubbleMesh.scale.set(1.02, 1.05, 1.14);
    helmetGroup.add(bubbleMesh);
  } else {
    // Aerodynamic full-face curved visor covering eye opening
    const visorGeo = new THREE.CylinderGeometry(
      shellRadius * 1.04,
      shellRadius * 1.02,
      5.8,
      36,
      1,
      true,
      -Math.PI * 0.28,
      Math.PI * 0.56
    );
    const visorMesh = new THREE.Mesh(visorGeo, visorMaterial);
    visorMesh.position.set(0, -2.1, 0.5);
    visorMesh.scale.set(1.02, 1.0, 1.15);
    helmetGroup.add(visorMesh);

    // Visor top rubber seal
    const sealGeo = new THREE.TorusGeometry(shellRadius * 1.02, 0.22, 8, 32, Math.PI * 0.56);
    const sealMesh = new THREE.Mesh(sealGeo, darkVentMaterial);
    sealMesh.rotation.x = Math.PI * 0.48;
    sealMesh.rotation.z = Math.PI * 0.72;
    sealMesh.position.set(0, 0.8, 1.5);
    helmetGroup.add(sealMesh);
  }

  // 5. RACING STRIPES & GRAPHICS
  if (type !== 'open-face') {
    const stripeGeo = new THREE.SphereGeometry(
      shellRadius * 1.015,
      24,
      16,
      -0.12,
      0.24,
      0,
      Math.PI * 0.44
    );
    const stripeMesh = new THREE.Mesh(stripeGeo, accentMaterial);
    stripeMesh.position.copy(topDome.position);
    stripeMesh.scale.copy(topDome.scale);
    helmetGroup.add(stripeMesh);
  }

  // 6. VISOR PIVOT HARDWARE (Left & Right bolts on ear positions)
  const pivotGeo = new THREE.CylinderGeometry(1.3, 1.3, 0.7, 24);
  const leftPivot = new THREE.Mesh(pivotGeo, chromeMaterial);
  leftPivot.position.set(11.2, -1.8, -0.2);
  leftPivot.rotation.z = Math.PI * 0.5;
  helmetGroup.add(leftPivot);

  const rightPivot = leftPivot.clone();
  rightPivot.position.set(-11.2, -1.8, -0.2);
  helmetGroup.add(rightPivot);

  // Pivot accent rings
  const ringGeo = new THREE.TorusGeometry(1.5, 0.22, 8, 24);
  const leftRing = new THREE.Mesh(ringGeo, accentMaterial);
  leftRing.position.copy(leftPivot.position);
  leftRing.rotation.y = Math.PI * 0.5;
  helmetGroup.add(leftRing);

  const rightRing = leftRing.clone();
  rightRing.position.copy(rightPivot.position);
  helmetGroup.add(rightRing);

  // 7. TOP AIR INTAKE VENTS (Racing / Street / Neon)
  if (type !== 'open-face') {
    const ventGeo = new THREE.BoxGeometry(1.8, 0.7, 4.5);
    const leftVent = new THREE.Mesh(ventGeo, darkVentMaterial);
    leftVent.position.set(3.2, 10.5, 1.5);
    leftVent.rotation.x = -Math.PI * 0.2;
    leftVent.rotation.y = -0.15;
    helmetGroup.add(leftVent);

    const rightVent = leftVent.clone();
    rightVent.position.set(-3.2, 10.5, 1.5);
    rightVent.rotation.y = 0.15;
    helmetGroup.add(rightVent);
  }

  // 8. REAR SPOILER (Full-Face & Neon-Sport)
  if (type === 'full-face' || type === 'neon-sport') {
    const spoilerGeo = new THREE.BoxGeometry(10.5, 1.2, 4.0);
    const spoilerMesh = new THREE.Mesh(spoilerGeo, accentMaterial);
    spoilerMesh.position.set(0, 3.2, -11.5);
    spoilerMesh.rotation.x = Math.PI * 0.2;
    spoilerMesh.scale.set(1.0, 0.5, 1.0);
    helmetGroup.add(spoilerMesh);

    // Spoiler vertical fins
    const finGeo = new THREE.BoxGeometry(0.5, 1.6, 2.5);
    const leftFin = new THREE.Mesh(finGeo, darkVentMaterial);
    leftFin.position.set(3.8, 3.5, -11.6);
    helmetGroup.add(leftFin);

    const rightFin = leftFin.clone();
    rightFin.position.set(-3.8, 3.5, -11.6);
    helmetGroup.add(rightFin);
  }

  // 9. BOTTOM NECK ROLL PADDING
  const neckGeo = new THREE.TorusGeometry(9.8, 1.2, 12, 36, Math.PI * 1.55);
  const neckMesh = new THREE.Mesh(neckGeo, paddingMaterial);
  neckMesh.rotation.x = Math.PI * 0.52;
  neckMesh.rotation.z = Math.PI * 0.22;
  neckMesh.position.set(0, -9.0, -1.5);
  helmetGroup.add(neckMesh);

  // Chrome rim for Retro Open-Face
  if (type === 'open-face') {
    const rimGeo = new THREE.TorusGeometry(10.2, 0.35, 12, 36, Math.PI * 1.55);
    const rimMesh = new THREE.Mesh(rimGeo, chromeMaterial);
    rimMesh.rotation.x = Math.PI * 0.52;
    rimMesh.rotation.z = Math.PI * 0.22;
    rimMesh.position.set(0, -9.0, -1.5);
    helmetGroup.add(rimMesh);
  }

  // CRITICAL AR RULE: Ensure all meshes in helmet group have renderOrder = 2
  // so they render AFTER the occluder (renderOrder = 1)
  helmetGroup.traverse((child) => {
    if (child.isMesh) {
      child.renderOrder = 2;
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return helmetGroup;
}
