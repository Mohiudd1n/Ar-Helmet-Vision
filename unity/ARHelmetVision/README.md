# HelmetVision AR — Unity app (Android / iOS)

Native version of the web try-on, built with **Unity 6 + AR Foundation 6** (ARCore Augmented Faces on
Android, ARKit face tracking on iOS). It uses the same real helmet models and the same calibrated
fits as the web app, with the same three screens:

1. **Welcome**: greeting by time of day and the user's saved name
2. **Catalog**: the 4 brands (Axor, Scorpion, Elementza, Vertigo) on a 3D turntable
3. **Try-On**: AR face tracking with the helmet on the head, a head occluder, the face mesh overlay always on top,
   S–XL sizes, visor modes, a fit calibration panel and screenshots

> **Status:** written without access to the Unity Editor, so it hasn't been compiled or run on a
> device yet. Expect to fix small API or setup issues on first open (see *Troubleshooting*).

## Requirements

- Unity **6000.0 LTS** (Unity 6) with **Android Build Support** and/or **iOS Build Support**
- An ARCore-supported Android phone (Android 7+), or an iPhone with a TrueDepth camera or an A12+ chip

## Setup

1. Unity Hub → **Add project from disk** → choose `unity/ARHelmetVision`. Pick Unity 6 when asked.
   Packages in `Packages/manifest.json` install on first open: AR Foundation, ARCore, ARKit, glTFast, Input System.
2. If Unity asks to enable the new Input System backend, click **Yes** (the editor restarts).
3. Menu **Tools ▸ AR Helmet Vision ▸ Set Up Everything**. This:
   - copies the helmet `.glb` files from the web app (`../../public/models`) into `Assets/ARHelmetVision/Models`
     (glTFast imports them as prefabs)
   - creates the depth-mask, overlay-line and smoked-visor materials in `Resources/`
   - creates one `HelmetData` asset per helmet plus `Resources/HelmetCatalog.asset`, with the fits from `src/data/helmets.js`
   - builds the AR face prefab and the scenes `01_Welcome`, `02_Catalog`, `03_TryOn`, and adds them to Build Settings
   - applies the mobile AR player settings (portrait; Android IL2CPP / ARM64 / GLES3 / API 24+; iOS 13+ with a camera usage text)
4. **Project Settings ▸ XR Plug-in Management**: tick **ARCore** on the Android tab and **ARKit** on the iOS tab.
   Under **XR Plug-in Management ▸ ARKit**, turn on **Face Tracking**.
5. **File ▸ Build Settings**: switch to Android or iOS, connect a device, then **Build And Run**.

## How it works

| Piece | File |
|---|---|
| Helmet catalog entry (fit, visor, credit) | `Scripts/HelmetData.cs`, `Resources/HelmetCatalog.asset` |
| Fit a raw .glb into head space (same maths as the web app) | `Scripts/HelmetFitter.cs` |
| Rig on each tracked face: occluders and helmet mount | `Scripts/FaceHelmetRig.cs` |
| Face mesh overlay, always on top | `Scripts/FaceWireframe.cs` + `Shaders/OverlayLines.shader` |
| Head occluder (depth only) | `Shaders/DepthMask.shader` (the live ARFace mesh, a skull ellipsoid and a neck cylinder) |
| Screens | `Scripts/WelcomeScreen.cs`, `CatalogScreen.cs`, `TryOnScreen.cs` (UI is built in code by `UIFactory.cs`) |
| Shared state between screens | `Scripts/AppState.cs` |
| One-click setup | `Editor/ARHelmetVisionSetup.cs` |

**Head space** is the MediaPipe / ARCore canonical face frame: origin at the centre of the head,
+Y up, +Z out of the face, in centimetres in the catalog and metres in Unity. ARCore's face
centre pose is the origin of that canonical mesh, so the fits carry over directly from the web app.

## Calibration

AR Foundation's face frame and glTFast's import axes can differ per platform. If the helmet
faces backwards or sits a little high or low, tap **Fit** in the try-on screen:

- **Flip** turns the helmet 180° (saved on the device)
- **Up / Down / Forward / Back** nudge it in 0.5 cm steps
- **Reset** clears the calibration

To change a helmet's own fit for everyone, edit its `HelmetData` asset (rotation, width in cm,
centre in cm), or tune it in the web app's Fit Studio (`#/studio/<id>`) and copy the numbers over.

## Troubleshooting

- **Helmets are missing in the catalog**: run *Tools ▸ AR Helmet Vision ▸ 1. Import Helmet Models*, then
  *3. Create Helmet Catalog*. Check that glTFast is installed (Package Manager → *Unity glTFast*).
- **Package version errors on open**: in Package Manager, update AR Foundation / ARCore / ARKit to
  the latest 6.x and glTFast to the latest 6.x your editor offers.
- **Black screen on Android**: make sure ARCore is ticked in XR Plug-in Management and Vulkan is removed
  from Graphics APIs (the setup menu does this).
- **iOS build has no face tracking**: enable *Face Tracking* in the ARKit XR settings.

## Model credits

Models from Sketchfab: Scorpion EXO-Combat by Marcin.Adamski (CC BY 4.0), Axor MX Carbon by
PEKUKEY (Sketchfab Standard), Elementza helmet by BasedOptimal (CC BY 4.0), Vertigo moto helmet by
Aleksandr Sagidullin (CC BY 4.0). The catalog and try-on screens show the credits.
