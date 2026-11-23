using System.IO;
using Unity.XR.CoreUtils;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.XR;
using UnityEngine.Rendering;
using UnityEngine.SceneManagement;
using UnityEngine.XR.ARFoundation;

namespace ARHelmetVision.EditorTools
{
    /// <summary>
    /// One-click project setup: Tools ▸ AR Helmet Vision ▸ Set Up Everything.
    /// Copies the helmet .glb files from the web app, creates the catalog with the same
    /// calibrated fits as src/data/helmets.js, builds the AR face prefab and the three
    /// scenes (Splash, Welcome, Catalog, Try-On), and applies mobile AR player settings.
    /// Safe to run again; it overwrites what it generated.
    /// </summary>
    public static class ARHelmetVisionSetup
    {
        const string Root = "Assets/ARHelmetVision";
        const string ModelsDir = Root + "/Models";
        const string HelmetsDir = Root + "/Helmets";
        const string PrefabsDir = Root + "/Prefabs";
        const string ScenesDir = Root + "/Scenes";
        const string ResourcesDir = Root + "/Resources";

        // Same values as the web catalog (src/data/helmets.js). Rotation in degrees.
        struct Def
        {
            public string id, brand, model, category, tagline, file, author, license, url, accent;
            public Vector3 rot, center; public float width; public string[] visor, hide;
        }

        static readonly Def[] Helmets =
        {
            new Def { id = "axor-mx-carbon", brand = "Axor", model = "MX Carbon", category = "Motocross",
                tagline = "Carbon off-road helmet with peak and wide goggle port", file = "helmet3.glb",
                rot = Vector3.zero, width = 27f, center = new Vector3(0, 1.5f, -2.5f), visor = new string[0], accent = "#f59e0b",
                author = "PEKUKEY", license = "Sketchfab Standard", url = "https://sketchfab.com/3d-models/axor-mx-carbon-helmet-0a2432f2c1ec419e84e39678cfa4fcb8" },
            new Def { id = "vertigo-jet", brand = "Vertigo", model = "Classic Jet", category = "Open-Face Retro",
                tagline = "Leather-look open-face helmet for city and café-racer rides", file = "helmet2.glb",
                rot = Vector3.zero, width = 25f, center = new Vector3(0, -2.3f, -5f), visor = new string[0], accent = "#a3a3a3",
                author = "Aleksandr Sagidullin", license = "CC BY 4.0", url = "https://sketchfab.com/3d-models/moto-helmet-with-vertigo-logo-cc2d7c15d4484363bbc1f9c2000799ec" },

            // New models (feat/adding-new-models): same fits, visors and hidden parts as src/data/helmets.js
            // (calibrated in the Fit Studio to cover a head plus 3 cm of hair). Mesh names use the web
            // spelling; MeshNames matches both.
            new Def { id = "scorpion-street-fighter", brand = "Scorpion", model = "Street Fighter", category = "Full-Face Sport",
                tagline = "Aggressive street motorcycle helmet with aerodynamic chin contour", file = "helmet1.glb",
                rot = new Vector3(0, -90f, 0), width = 26f, center = new Vector3(0, 3.5f, -1.5f), visor = new string[0], accent = "#e11d48",
                author = "ANDRIANIAINAToky", license = "CC BY 4.0", url = "https://sketchfab.com/3d-models/motorcycle-helmet-ca804fced1fb489fb88b69f9d27ede15" },
            new Def { id = "elementza-racer-fullface", brand = "Elementza", model = "Racer Full-Face", category = "Full-Face Sport",
                tagline = "Glossy aerodynamic track helmet with dark visor and streamlined profile", file = "helmet4.glb",
                rot = Vector3.zero, width = 26.25f, center = new Vector3(0, 5.3f, -4.7f), visor = new string[0], accent = "#dc2626",
                author = "BasedOptimal", license = "CC BY 4.0", url = "https://sketchfab.com/3d-models/elementza-bike-helmet-02cc6c3b10d14048b06a518bb6870c40" },
            new Def { id = "fox-mtb-fullface", brand = "Fox Racing", model = "Full Face MTB", category = "Downhill / MTB",
                tagline = "Lightweight downhill full-face mountain bike helmet with peak", file = "helmet5.glb",
                rot = Vector3.zero, width = 30f, center = new Vector3(0, 4.2f, -2.3f), visor = new string[0], accent = "#10b981",
                author = "chett33", license = "CC BY 4.0", url = "https://sketchfab.com/3d-models/full-face-mtb-helmet-2b0bb690bbca4453b6d385e4ee0f3294" },
            new Def { id = "bell-f1-norris", brand = "Bell", model = "HP77 F1 Lando Norris", category = "Formula 1",
                tagline = "Formula 1 high-speed racing helmet replica with aero winglets", file = "helmet6.glb",
                rot = new Vector3(0, -90f, 0), width = 28.7f, center = new Vector3(0, 3.2f, -3.8f), visor = new[] { "Sphere008_bake_0" }, accent = "#eab308",
                author = "step4n", license = "CC BY-NC-ND 4.0", url = "https://sketchfab.com/3d-models/f1-helmet-lando-norris-875ae397a4aa499dbd7d385e4d772c08" },
            new Def { id = "fox-v3-goggles", brand = "Fox Racing", model = "V3 MX & 100% Goggles", category = "Motocross",
                tagline = "Pro motocross helmet with peak and integrated 100% race goggles", file = "helmet7.glb",
                rot = new Vector3(0, 90f, 0), width = 28.75f, center = new Vector3(0, 1.5f, -3.0f), visor = new string[0], accent = "#f97316",
                author = "moto man 135", license = "CC BY 4.0", url = "https://sketchfab.com/3d-models/fox-helmet-with-100-googles-d3575d05240647d09dd3909e586d1e35" },
            new Def { id = "biltwell-gringo-retro", brand = "Biltwell", model = "Gringo Retro", category = "Retro Full-Face",
                tagline = "Vintage 70s full-face cafe racer helmet with custom liner", file = "helmet8.glb",
                rot = new Vector3(0, -90f, 0), width = 26.15f, center = new Vector3(0, 2.3f, -3.8f), visor = new[] { "glass_PBR1_0" }, accent = "#d97706",
                author = "13baym", license = "CC BY-NC 4.0", url = "https://sketchfab.com/3d-models/retro-motorcycle-helmet-8fc9219aecb6498981a905db1fddfcd5" },
            new Def { id = "bell-moto-3", brand = "Bell", model = "Moto-3 Classic", category = "Vintage MX",
                tagline = "Iconic vintage motocross helmet with classic 5-snap sun visor", file = "helmet9.glb",
                rot = Vector3.zero, width = 26f, center = new Vector3(0, 2.0f, -3.2f), visor = new string[0], accent = "#ef4444",
                author = "Netovanniy", license = "CC BY 4.0", url = "https://sketchfab.com/3d-models/moto-iii-helmet-7c4b35c5cf8f43aa89924008971b90cd" },
            new Def { id = "agv-corsa-street", brand = "AGV", model = "Corsa GP", category = "Sport Racing",
                tagline = "Track-ready motorcycle helmet with biplano aerodynamic spoiler", file = "helmet10.glb",
                rot = Vector3.zero, width = 29.25f, center = new Vector3(0, 3.3f, -3.0f), visor = new[] { "Sphere001_0" }, accent = "#06b6d4",
                author = "djengala", license = "CC BY 4.0", url = "https://sketchfab.com/3d-models/motorcycle-helmet-1d489db9cdc24161a7537926a20bb17b" },
            new Def { id = "torc-route-vintage", brand = "Torc", model = "Route 66 Vintage", category = "Open-Face Retro",
                tagline = "Classic open-face custom helmet with chrome trim and sun peak", file = "helmet11.glb",
                rot = Vector3.zero, width = 25f, center = new Vector3(0, 1.3f, -4.0f), visor = new string[0], hide = new[] { "CASCO001_tira_tela_0", "CASCO001_13_CROMO004_0" }, accent = "#8b5cf6",
                author = "geovaniduran1", license = "CC BY 4.0", url = "https://sketchfab.com/3d-models/vintage-helmet-fc57f1351bfc41038dfbb6c08771ecfc" },
            new Def { id = "shoei-x-spirit-racing", brand = "Shoei", model = "X-Spirit Racing", category = "MotoGP Racing",
                tagline = "Track-proven aerodynamic racing helmet with vortex generators", file = "helmet12.glb",
                rot = new Vector3(0, 180f, 0), width = 26f, center = new Vector3(0, 2.0f, -4.0f), visor = new[] { "Object_8", "Object_29" }, accent = "#3b82f6",
                author = "ramyouny", license = "Sketchfab Standard", url = "https://sketchfab.com/3d-models/motorcycle-helmet-racing-helmet-b2ead0381b914a88810a8be9fc13f47a" },
            new Def { id = "arai-gp6-racing", brand = "Arai", model = "GP-6S Track", category = "Motorsport Track",
                tagline = "Auto-racing helmet engineered for track days, karting, and cockpit safety", file = "helmet13.glb",
                rot = new Vector3(0, 90f, 0), width = 25f, center = new Vector3(0, 3.5f, -2.3f), visor = new string[0], hide = new[] { "Plane002_Material005_0" }, accent = "#ec4899",
                author = "MizuCorp", license = "CC BY 4.0", url = "https://sketchfab.com/3d-models/racing-helmet-b92c1426837e47778db2487f2c2d7121" },
            new Def { id = "stilo-f1-chinese-gp", brand = "Stilo", model = "ST5 F1 Zhou Guanyu", category = "Formula 1",
                tagline = "Special edition Formula 1 Chinese Grand Prix tribute helmet", file = "helmet14.glb",
                rot = new Vector3(0, 180f, 0), width = 28.05f, center = new Vector3(0, 3.1f, -2.3f), visor = new[] { "Helmet_glass_Helmet_glass_0" }, accent = "#14b8a6",
                author = "Miopass", license = "CC BY 4.0", url = "https://sketchfab.com/3d-models/f1-helmet-zhouguanyu-chinesegp-helmet-31f9f2c1e83c4eac9f444d73a853b2a9" },
        };

        [MenuItem("Tools/AR Helmet Vision/Set Up Everything", priority = 0)]
        public static void SetUpEverything()
        {
            ImportModels();
            CreateMaterials();
            CreateCatalog();
            BuildScenes();
            ApplyPlayerSettings();
            EditorUtility.DisplayDialog("AR Helmet Vision",
                "Setup finished.\n\nLast manual step: Project Settings ▸ XR Plug-in Management ▸ tick ARCore (Android tab) and ARKit (iOS tab), and enable Face Tracking in the ARKit settings.\n\nThen open Scenes/00_Splash (the app starts there) and build.",
                "OK");
        }

        [MenuItem("Tools/AR Helmet Vision/1. Import Helmet Models")]
        public static void ImportModels()
        {
            var projectRoot = Directory.GetParent(Application.dataPath).FullName;
            var webModels = Path.GetFullPath(Path.Combine(projectRoot, "..", "..", "public", "models"));
            if (!Directory.Exists(webModels))
            {
                Debug.LogError($"Web app models not found at {webModels}. Copy the .glb files into {ModelsDir} manually.");
                return;
            }
            Directory.CreateDirectory(Path.Combine(projectRoot, ModelsDir));
            foreach (var def in Helmets)
            {
                var from = Path.Combine(webModels, def.file);
                var to = Path.Combine(projectRoot, ModelsDir, def.file);
                if (!File.Exists(from)) { Debug.LogError($"Missing {from}"); continue; }
                if (!File.Exists(to) || new FileInfo(to).Length != new FileInfo(from).Length) File.Copy(from, to, true);
            }
            AssetDatabase.Refresh(); // glTFast imports each .glb as a prefab-like asset
            Debug.Log("[AR Helmet Vision] Helmet models imported.");
        }

        [MenuItem("Tools/AR Helmet Vision/2. Create Materials")]
        public static void CreateMaterials()
        {
            EnsureFolder(ResourcesDir);
            CreateMaterial("ARHV_DepthMask", "ARHelmetVision/DepthMask");
            CreateMaterial("ARHV_OverlayLines", "ARHelmetVision/OverlayLines");
            CreateMaterial("ARHV_SmokedVisor", "ARHelmetVision/SmokedVisor");
        }

        static Material CreateMaterial(string name, string shader)
        {
            var path = $"{ResourcesDir}/{name}.mat";
            var mat = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (!mat)
            {
                mat = new Material(Shader.Find(shader)) { name = name };
                AssetDatabase.CreateAsset(mat, path);
            }
            else mat.shader = Shader.Find(shader);
            return mat;
        }

        [MenuItem("Tools/AR Helmet Vision/3. Create Helmet Catalog")]
        public static void CreateCatalog()
        {
            EnsureFolder(HelmetsDir);
            EnsureFolder(ResourcesDir);
            var list = new HelmetData[Helmets.Length];
            for (int i = 0; i < Helmets.Length; i++)
            {
                var d = Helmets[i];
                var path = $"{HelmetsDir}/{d.id}.asset";
                var h = AssetDatabase.LoadAssetAtPath<HelmetData>(path);
                if (!h) { h = ScriptableObject.CreateInstance<HelmetData>(); AssetDatabase.CreateAsset(h, path); }
                h.id = d.id; h.brand = d.brand; h.model = d.model; h.category = d.category; h.tagline = d.tagline;
                ColorUtility.TryParseHtmlString(d.accent, out h.accent);
                h.prefab = AssetDatabase.LoadAssetAtPath<GameObject>($"{ModelsDir}/{d.file}");
                if (!h.prefab) Debug.LogWarning($"[AR Helmet Vision] {d.file} is not imported yet (is glTFast installed?).");
                h.fitRotation = d.rot; h.fitWidthCm = d.width; h.fitCenterCm = d.center;
                h.visorMeshPrefixes = d.visor;
                h.hiddenMeshPrefixes = d.hide ?? new string[0];
                h.creditAuthor = d.author; h.creditLicense = d.license; h.creditUrl = d.url;
                EditorUtility.SetDirty(h);
                list[i] = h;
            }
            var catPath = $"{ResourcesDir}/HelmetCatalog.asset";
            var cat = AssetDatabase.LoadAssetAtPath<HelmetCatalog>(catPath);
            if (!cat) { cat = ScriptableObject.CreateInstance<HelmetCatalog>(); AssetDatabase.CreateAsset(cat, catPath); }
            cat.helmets = list;
            EditorUtility.SetDirty(cat);
            AssetDatabase.SaveAssets();
        }

        [MenuItem("Tools/AR Helmet Vision/4. Build Scenes")]
        public static void BuildScenes()
        {
            EnsureFolder(PrefabsDir);
            EnsureFolder(ScenesDir);
            var facePrefab = BuildFacePrefab();

            var splash = NewScene();
            CreateUiCamera(new Color(0.137f, 0.122f, 0.125f));
            new GameObject("SplashScreen").AddComponent<SplashScreen>();
            Save(splash, AppState.SplashScene);

            var welcome = NewScene();
            CreateUiCamera(new Color(0.925f, 0.925f, 0.933f));
            new GameObject("WelcomeScreen").AddComponent<WelcomeScreen>();
            Save(welcome, AppState.WelcomeScene);

            var catalog = NewScene();
            var cam = CreateUiCamera(new Color(0.80f, 0.80f, 0.82f));
            cam.transform.position = new Vector3(0f, -0.16f, 0.95f);
            cam.transform.LookAt(new Vector3(0f, -0.16f, 0f));
            cam.fieldOfView = 32f;
            CreateLight();
            var turntable = new GameObject("Turntable").transform;
            var screen = new GameObject("CatalogScreen").AddComponent<CatalogScreen>();
            var so = new SerializedObject(screen);
            so.FindProperty("turntable").objectReferenceValue = turntable;
            so.ApplyModifiedPropertiesWithoutUndo();
            Save(catalog, AppState.CatalogScene);

            var tryOn = NewScene();
            BuildArRig(facePrefab);
            CreateLight();
            new GameObject("TryOnScreen").AddComponent<TryOnScreen>();
            Save(tryOn, AppState.TryOnScene);

            EditorBuildSettings.scenes = new[]
            {
                new EditorBuildSettingsScene($"{ScenesDir}/{AppState.SplashScene}.unity", true),
                new EditorBuildSettingsScene($"{ScenesDir}/{AppState.WelcomeScene}.unity", true),
                new EditorBuildSettingsScene($"{ScenesDir}/{AppState.CatalogScene}.unity", true),
                new EditorBuildSettingsScene($"{ScenesDir}/{AppState.TryOnScene}.unity", true),
            };
            EditorSceneManager.OpenScene($"{ScenesDir}/{AppState.SplashScene}.unity");
        }

        static GameObject BuildFacePrefab()
        {
            var go = new GameObject("AR Face");
            go.AddComponent<ARFace>();
            go.AddComponent<MeshFilter>();
            var mr = go.AddComponent<MeshRenderer>();
            mr.sharedMaterial = AssetDatabase.LoadAssetAtPath<Material>($"{ResourcesDir}/ARHV_DepthMask.mat"); // live face mesh = occluder
            mr.shadowCastingMode = ShadowCastingMode.Off;
            go.AddComponent<ARFaceMeshVisualizer>();

            var wire = new GameObject("FaceWireframe");
            wire.transform.SetParent(go.transform, false);
            wire.AddComponent<MeshFilter>();
            wire.AddComponent<MeshRenderer>();
            wire.AddComponent<FaceWireframe>();

            go.AddComponent<FaceHelmetRig>();

            var prefab = PrefabUtility.SaveAsPrefabAsset(go, $"{PrefabsDir}/ARFace.prefab");
            Object.DestroyImmediate(go);
            return prefab;
        }

        static void BuildArRig(GameObject facePrefab)
        {
            var session = new GameObject("AR Session");
            session.AddComponent<ARSession>();
            session.AddComponent<ARInputManager>();

            var originGo = new GameObject("XR Origin");
            var origin = originGo.AddComponent<XROrigin>();
            var offset = new GameObject("Camera Offset");
            offset.transform.SetParent(originGo.transform, false);

            var camGo = new GameObject("Main Camera") { tag = "MainCamera" };
            camGo.transform.SetParent(offset.transform, false);
            var cam = camGo.AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = Color.black;
            cam.nearClipPlane = 0.01f;
            cam.farClipPlane = 20f;
            var camManager = camGo.AddComponent<ARCameraManager>();
            camManager.requestedFacingDirection = CameraFacingDirection.User; // selfie camera for face tracking
            camGo.AddComponent<ARCameraBackground>();
            var tpd = camGo.AddComponent<TrackedPoseDriver>();
            tpd.positionInput = new InputActionProperty(new InputAction("Position", binding: "<HandheldARInputDevice>/devicePosition"));
            tpd.rotationInput = new InputActionProperty(new InputAction("Rotation", binding: "<HandheldARInputDevice>/deviceRotation"));

            origin.Camera = cam;
            origin.CameraFloorOffsetObject = offset;

            var faces = originGo.AddComponent<ARFaceManager>();
            faces.facePrefab = facePrefab;
            faces.requestedMaximumFaceCount = 1;
        }

        static Camera CreateUiCamera(Color bg)
        {
            var go = new GameObject("Main Camera") { tag = "MainCamera" };
            var cam = go.AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = bg;
            cam.nearClipPlane = 0.01f;
            return cam;
        }

        static void CreateLight()
        {
            var go = new GameObject("Key Light");
            var l = go.AddComponent<Light>();
            l.type = LightType.Directional;
            l.intensity = 1.1f;
            go.transform.rotation = Quaternion.Euler(35f, -30f, 0f);
            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.75f, 0.78f, 0.82f);
            RenderSettings.ambientEquatorColor = new Color(0.45f, 0.45f, 0.48f);
            RenderSettings.ambientGroundColor = new Color(0.2f, 0.2f, 0.22f);
        }

        static Scene NewScene() => EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

        static void Save(Scene scene, string name) => EditorSceneManager.SaveScene(scene, $"{ScenesDir}/{name}.unity");

        [MenuItem("Tools/AR Helmet Vision/5. Apply Mobile AR Player Settings")]
        public static void ApplyPlayerSettings()
        {
            PlayerSettings.productName = "HelmetAR";
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.Portrait;

            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, "com.helmetvision.ar");
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel24;
            PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.Android, false);
            PlayerSettings.SetGraphicsAPIs(BuildTarget.Android, new[] { GraphicsDeviceType.OpenGLES3 });

            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.iOS, "com.helmetvision.ar");
            PlayerSettings.iOS.cameraUsageDescription = "The camera is used to show helmets on your face. Images never leave your device.";
            PlayerSettings.iOS.targetOSVersionString = "13.0";
            Debug.Log("[AR Helmet Vision] Player settings applied (Android ARM64/IL2CPP/GLES3, iOS 13+, portrait).");
        }

        static void EnsureFolder(string path)
        {
            if (AssetDatabase.IsValidFolder(path)) return;
            var parent = Path.GetDirectoryName(path).Replace('\\', '/');
            EnsureFolder(parent);
            AssetDatabase.CreateFolder(parent, Path.GetFileName(path));
        }
    }
}
