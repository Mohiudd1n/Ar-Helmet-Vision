using System;
using UnityEngine;

namespace ARHelmetVision
{
    public enum VisorMode { Smoked, Up, Down }

    /// <summary>
    /// App-wide state shared by the three screens (Welcome, Catalog, Try-On)
    /// and the face rig. Plain static state + change events; survives scene loads.
    /// </summary>
    public static class AppState
    {
        public const string SplashScene = "00_Splash";
        public const string WelcomeScene = "01_Welcome";
        public const string CatalogScene = "02_Catalog";
        public const string TryOnScene = "03_TryOn";

        static HelmetCatalog _catalog;
        public static HelmetCatalog Catalog => _catalog ? _catalog : (_catalog = Resources.Load<HelmetCatalog>("HelmetCatalog"));

        static int _selected;
        public static int SelectedIndex
        {
            get => Mathf.Clamp(_selected, 0, Mathf.Max(0, Catalog.helmets.Length - 1));
            set { _selected = value; Changed?.Invoke(); }
        }
        public static HelmetData SelectedHelmet => Catalog.helmets.Length > 0 ? Catalog.helmets[SelectedIndex] : null;

        static float _sizeScale = 1f;
        public static float SizeScale { get => _sizeScale; set { _sizeScale = value; Changed?.Invoke(); } }

        static VisorMode _visor = VisorMode.Smoked;
        public static VisorMode Visor { get => _visor; set { _visor = value; Changed?.Invoke(); } }

        static bool _showMesh = true;
        public static bool ShowFaceMesh { get => _showMesh; set { _showMesh = value; Changed?.Invoke(); } }

        // Calibration between head space and the AR face pose, kept per device.
        // AR Foundation's face frame differs slightly per platform; these let you correct it in-app.
        public static bool FlipFront
        {
            get => PlayerPrefs.GetInt("hv.flipFront", 0) == 1;
            set { PlayerPrefs.SetInt("hv.flipFront", value ? 1 : 0); Changed?.Invoke(); }
        }
        public static Vector3 HeadOffsetCm
        {
            get => new Vector3(0f, PlayerPrefs.GetFloat("hv.offY", 0f), PlayerPrefs.GetFloat("hv.offZ", 0f));
            set { PlayerPrefs.SetFloat("hv.offY", value.y); PlayerPrefs.SetFloat("hv.offZ", value.z); Changed?.Invoke(); }
        }

        public static string UserName
        {
            get => PlayerPrefs.GetString("hv.name", "");
            set => PlayerPrefs.SetString("hv.name", value ?? "");
        }

        public static event Action Changed;
    }
}
