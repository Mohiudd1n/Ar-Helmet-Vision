# 🪖 AR Helmet Vision — Virtual Helmet Try-On

Try real branded helmets on your own head through the front camera. The project ships as two apps
that share the same 3D models and the same calibrated fits:

| | Web app (this folder) | Unity app (`unity/ARHelmetVision`) |
|---|---|---|
| Runs on | Any phone or desktop browser | Native Android (ARCore) / iOS (ARKit) |
| Tech | React 18 · Vite 5 · Three.js · MediaPipe Face Landmarker · Tailwind | Unity 6 · AR Foundation 6 · glTFast · uGUI |
| Status | Built and tested | Written, not yet compiled (needs the Unity Editor). See its README |

## Screens

1. **Welcome**: greets the user by time of day, with an optional saved name and a spinning 3D helmet.
2. **Catalog**: 4 brands of real helmet models (Axor, Scorpion, Elementza, Vertigo) as live 3D
   turntables, with brand filters. Tap a helmet to try it on.
3. **AR Try-On**: the helmet tracks your head with a face-mesh overlay that stays visible at every
   angle. It has S–XL sizes, visor modes (smoked / up / tinted), a helmet switcher, photo capture and model credits.

## Tech stack

- **Web**: React 18, Vite 5, Three.js r165 (GLTFLoader, PBR, RoomEnvironment), `@mediapipe/tasks-vision` Face Landmarker, Tailwind CSS, lucide-react
- **Native**: Unity 6, AR Foundation 6 (ARCore Augmented Faces / ARKit face tracking), glTFast, Input System, uGUI

## Quick start (web)

```bash
npm install
npm run dev        # HTTPS on :3000, reachable from phones on the same Wi-Fi
npm run dev:local  # plain HTTP on localhost:3001 (desktop testing; localhost counts as secure)
npm run build
```

On a phone, open the `https://<your-LAN-IP>:3000` address Vite prints, accept the self-signed
certificate warning, and allow camera access.

**Test without a camera:** add `?src=/path/to/face.jpg` (or `.mp4`) before the `#`, e.g.
`http://localhost:3001/?src=/__test__/portrait.jpg#/try/axor-mx-carbon`. Put test media in
`public/__test__/`, which git ignores.

## How the AR works (web)

- **Pose**: MediaPipe returns a rigid 4×4 head pose of its canonical face model, in centimetres, for a camera
  with a 63° vertical field of view. The Three.js camera uses exactly that FOV and the video's aspect
  ratio, and the canvas is laid out at exactly the video's size and position, so a helmet placed in
  canonical head space lands on the real head with no guessed depth or scale. (`src/lib/arEngine.js`)
- **Smoothing**: a One Euro filter on position and rotation removes jitter without adding lag when you move. (`src/lib/oneEuroFilter.js`)
- **Occlusion**: a depth-only head made of the canonical face (eye and mouth holes closed), a skull
  ellipsoid and a neck rides on the same anchor as the helmet. Helmet parts behind your real head
  are hidden, so you see your face through the eye port. The chin bar, visor and peak stay in front. (`src/lib/headOccluder.js`)
- **Face mesh overlay**: built from the live 478 landmarks every frame and drawn on top of everything. Tracking
  thresholds are lowered and a short pose hold covers brief dropouts, so it stays visible when you turn
  sideways or look up or down.
- **Fitting**: each helmet's `fit` (rotation, shell width in cm, centre in cm) in `src/data/helmets.js` maps the
  raw `.glb` into head space. Tune it visually in the **Fit Studio** at `#/studio/<helmet-id>`.
- **Lighting**: tone-mapping exposure follows the camera image's brightness, so the helmet matches the room.

## Project layout

```
public/models/            real helmet .glb files (Sketchfab, see credits)
scripts/copy-mediapipe.mjs   copies the matching MediaPipe WASM into public/ (runs before dev/build)
src/App.jsx               hash router: #/  #/catalog  #/try/<id>  #/studio/<id>
src/screens/              WelcomeScreen, CatalogScreen, TryOnScreen, FitStudio
src/components/HelmetPreview.jsx   live 3D turntables + thumbnails (one shared WebGL context)
src/lib/                  arEngine, helmetLoader, headOccluder, faceTopology, canonicalFace, oneEuroFilter, camera
src/data/helmets.js       catalog + calibrated fits
unity/ARHelmetVision/     Unity 6 AR Foundation app (see its README)
```

## Adding a helmet

1. Put the `.glb` in `public/models/`.
2. Add an entry to `src/data/helmets.js` with a rough `fit`.
3. Open `#/studio/<id>`, use the Front/Side views with X-ray on, adjust rotation, width and centre until the
   canonical head sits inside the shell with the eyes in the eye port, then copy the JSON into the entry.
4. If the visor is a separate mesh, list its mesh names in `visor.meshes`.

## Model credits

- Scorpion EXO-Combat by Marcin.Adamski, CC BY 4.0
- Axor MX Carbon by PEKUKEY, Sketchfab Standard licence
- Elementza helmet by BasedOptimal, CC BY 4.0
- Vertigo moto helmet by Aleksandr Sagidullin, CC BY 4.0

Links are in `src/data/helmets.js`, and the app shows the credits on the catalog cards and in the try-on info panel.
