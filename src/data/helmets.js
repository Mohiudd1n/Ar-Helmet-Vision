/**
 * Helmet catalog: real, artist-made 3D models of branded helmets (from Sketchfab).
 *
 * `fit` maps the raw .glb into head space (MediaPipe canonical face frame, cm):
 *   rotation  Euler radians that turn the model so its front faces +Z and top faces +Y
 *   width     outer shell width in cm (sets the uniform scale)
 *   center    where the centre of the model's bounding box sits relative to the head
 * Calibrated visually in the Fit Studio (#/studio/<id>) against the canonical head.
 *
 * `visor.meshes` names the visor meshes so the try-on can show them smoked or flipped up.
 * Licences: CC BY 4.0 models must show the credit (the catalog and try-on screens do).
 */

export const HELMETS = [
  {
    id: 'axor-mx-carbon',
    brand: 'Axor',
    model: 'MX Carbon',
    category: 'Motocross',
    tagline: 'Carbon off-road helmet with peak and wide goggle port',
    features: ['Carbon-fibre shell', 'Adjustable peak', 'Goggle-ready eye port'],
    accent: '#f59e0b',
    modelUrl: '/models/helmet3.glb',
    sizeMb: 27.7,
    fit: { rotation: [0, 0, 0], width: 27, center: [0, 1.5, -2.5] },
    visor: null,
    credit: {
      author: 'PEKUKEY',
      url: 'https://sketchfab.com/3d-models/axor-mx-carbon-helmet-0a2432f2c1ec419e84e39678cfa4fcb8',
      license: 'Sketchfab Standard',
    },
  },
  {
    id: 'vertigo-jet',
    brand: 'Vertigo',
    model: 'Classic Jet',
    category: 'Open-Face Retro',
    tagline: 'Leather-look open-face helmet for city and café-racer rides',
    features: ['Open-face jet design', 'Snap visor studs', 'Padded chin strap'],
    accent: '#a3a3a3',
    modelUrl: '/models/helmet2.glb',
    sizeMb: 4.7,
    fit: { rotation: [0, 0, 0], width: 25, center: [0, -2.3, -5] },
    visor: null,
    credit: {
      author: 'Aleksandr Sagidullin',
      url: 'https://sketchfab.com/3d-models/moto-helmet-with-vertigo-logo-cc2d7c15d4484363bbc1f9c2000799ec',
      license: 'CC BY 4.0',
    },
  },
];

export const getHelmet = (id) => HELMETS.find((h) => h.id === id);
