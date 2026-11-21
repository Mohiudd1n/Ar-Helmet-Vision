/**
 * Multi-Helmet Configuration Catalog
 * 
 * Each entry provides model URLs and default calibration parameters:
 * - scale: Multiplier applied on top of the auto-calculated biometric face width fit
 * - offset: { x, y, z } translation offset from head anchor origin (in centimeters)
 * - rotationOffset: { x, y, z } Euler rotation offset in radians
 * - Procedural styling values used if .glb is missing or fails to fetch
 */

export const INITIAL_HELMETS = [
  {
    id: "helmet-1",
    name: "Carbon Racing Full-Face",
    badge: "Track Edition",
    thumbnailColor: "#ef4444",
    modelUrl: "/models/helmet1.glb",
    scale: 1.0,
    offset: { x: 0.0, y: 1.2, z: -1.2 },
    rotationOffset: { x: 0.0, y: 0.0, z: 0.0 },
    // Procedural Fallback Style
    type: "full-face",
    shellColor: "#17171a",
    accentColor: "#ef4444",
    visorTint: "#38bdf8",
    description: "Aerodynamic carbon fiber weave with high-speed stability spoiler & smoke anti-fog visor."
  },
  {
    id: "helmet-2",
    name: "Matte Black Street",
    badge: "Urban Stealth",
    thumbnailColor: "#374151",
    modelUrl: "/models/helmet2.glb",
    scale: 1.0,
    offset: { x: 0.0, y: 1.0, z: -1.0 },
    rotationOffset: { x: 0.0, y: 0.0, z: 0.0 },
    // Procedural Fallback Style
    type: "street",
    shellColor: "#222226",
    accentColor: "#f59e0b",
    visorTint: "#1e293b",
    description: "Stealth matte finish with reinforced chin bar and dual top ventilation channels."
  },
  {
    id: "helmet-3",
    name: "Retro Classic Open-Face",
    badge: "Cafe Racer",
    thumbnailColor: "#d97706",
    modelUrl: "/models/helmet3.glb",
    scale: 1.0,
    offset: { x: 0.0, y: 1.4, z: -0.8 },
    rotationOffset: { x: 0.04, y: 0.0, z: 0.0 },
    // Procedural Fallback Style
    type: "open-face",
    shellColor: "#ede8df",
    accentColor: "#b45309",
    visorTint: "#f59e0b",
    description: "Vintage cafe-racer open-face helmet with chrome rim lining and flip-up bubble visor."
  },
  {
    id: "helmet-4",
    name: "Cyber Neon Sport",
    badge: "Pro Series",
    thumbnailColor: "#06b6d4",
    modelUrl: "/models/helmet4.glb",
    scale: 1.0,
    offset: { x: 0.0, y: 1.2, z: -1.0 },
    rotationOffset: { x: 0.0, y: 0.0, z: 0.0 },
    // Procedural Fallback Style
    type: "neon-sport",
    shellColor: "#0b1329",
    accentColor: "#06b6d4",
    visorTint: "#a855f7",
    description: "Futuristic race spec with iridescent photochromic visor and electric cyan accents."
  }
];
