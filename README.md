# 🪖 AR Helmet Vision — Web-Based 3D Virtual Helmet Try-On

An interactive, production-ready **Web-Based Augmented Reality (AR) Virtual Helmet Try-On Application** built with **Vite, React, Three.js, and Google MediaPipe Face Landmarker**.

Live front-camera feed renders rigid `.glb` 3D helmet models anchored to the user's head with **pixel-accurate 3D occlusion** using a real-time, adaptive 478-landmark facial mesh so your real face, eyes, and mouth show naturally through the helmet visor opening.

---

## ✨ Features

- **Adaptive 478-Landmark Real-Time Face Mesh:** Uses Google MediaPipe's `FACE_LANDMARKS_TESSELATION` (852 triangles). The mesh dynamically reacts to smiles, lip movements, cheek flexing, and jaw opening.
- **Dynamic Head & Cranium Occlusion:** Extruded 36-point contour derived directly from your live `FACE_LANDMARKS_FACE_OVAL` to occlude the interior cavity of the helmet without using static sphere geometries.
- **Automatic Biometric Head Sizing:** Automatically measures temple-to-temple face width (landmarks 234 to 454) in centimeters and normalizes any `.glb` model to match your facial scale.
- **PBR Studio Lighting & Reflections:** Three.js `ACESFilmicToneMapping`, `SRGBColorSpace`, and `RoomEnvironment` through `PMREMGenerator` for realistic metallic reflections and semi-transparent visors.
- **Full Mobile Compatibility (iOS Safari & Android Chrome):**
  - Multi-tier `getUserMedia` constraint fallback progression (portrait, landscape, relaxed, generic).
  - Built-in HTTPS development server via `@vitejs/plugin-basic-ssl` (required by mobile browsers to access camera hardware).
  - Autoplay handling with fallback "Tap to Enable Camera" overlay.
  - Video inline playback (`playsInline`, `webkit-playsinline`, `muted`).
- **Composite AR Snapshot:** Captures high-res selfie photos combining the mirrored camera feed and 3D WebGL render into a downloadable PNG.
- **Zero-Crash Procedural Fallback:** If a `.glb` model is missing or fails to load, generates a procedural PBR helmet shell with visor and padding.
- **Interactive Calibration Drawer:** Real-time sliders for scale, X/Y/Z offsets, Euler pitch/yaw/roll, and a "Copy Config JSON" utility.

---

## 🛠️ Tech Stack

- **Frontend:** React 18 + Vite 5
- **3D Graphics & WebGL:** Three.js (r165+) + `GLTFLoader` + `RoomEnvironment`
- **Computer Vision & Face Tracking:** `@mediapipe/tasks-vision`
- **Styling:** Tailwind CSS + Lucide React Icons
- **Local HTTPS:** `@vitejs/plugin-basic-ssl`

---

## 🚀 Quick Start

### 1. Clone the repository:
```bash
git clone https://github.com/Mohiudd1n/Ar-Helmet-Vision.git
cd Ar-Helmet-Vision
```

### 2. Install dependencies:
```bash
npm install
```

### 3. Run development server:
```bash
npm run dev
```

Vite will serve the app over HTTPS:
- **Local:** `https://localhost:3000/`
- **Network (Mobile):** `https://<YOUR_LOCAL_IP>:3000/`

---

## 📱 Mobile Testing Instructions

1. Ensure your smartphone and development computer are connected to the **same Wi-Fi network**.
2. Open the **Network HTTPS link** displayed in the terminal (e.g., `https://192.168.x.x:3000`) on your mobile browser (Safari on iOS or Chrome on Android).
3. **Certificate Notice:** Because development uses a self-signed local SSL certificate, your browser may show a *"Your connection is not private"* warning:
   - On iOS Safari: Tap **Show Details** ➔ **visit this website**.
   - On Android Chrome: Tap **Advanced** ➔ **Proceed to site (unsafe)**.
4. Allow front camera permissions when prompted.

---

## 📁 Adding Custom 3D Helmet Models

1. Download or export any helmet model in `.glb` or `.gltf` format (e.g. from Sketchfab, Blender).
2. Place the file inside the `public/models/` folder:
   ```
   public/models/helmet1.glb
   public/models/helmet2.glb
   ```
3. Update or adjust offsets in `src/data/helmets.js` if needed:
   ```javascript
   {
     id: "helmet-1",
     name: "Custom Racing Helmet",
     modelUrl: "/models/helmet1.glb",
     scale: 1.0,
     offset: { x: 0.0, y: 1.2, z: -1.2 },
     rotationOffset: { x: 0.0, y: 0.0, z: 0.0 }
   }
   ```
4. Open the **Fine-Tune 3D Fit** drawer (sliders icon) in the app to adjust calibration in real time, then click **Copy Config JSON**.

---

## 📦 Building for Production

```bash
npm run build
```
Production assets are generated in the `dist/` directory.

---

## 📄 License

MIT License. Free for personal and commercial AR experimentation.
