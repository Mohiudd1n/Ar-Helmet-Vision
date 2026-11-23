using UnityEngine;

namespace ARHelmetVision
{
    /// <summary>
    /// One helmet in the catalog. Mirrors an entry in the web app's src/data/helmets.js
    /// so both apps fit the same real 3D models the same way.
    ///
    /// Fit values are in "head space": the MediaPipe / ARCore canonical face frame,
    /// in centimetres, origin at the centre of the head, +Y up, +Z out of the face.
    /// </summary>
    [CreateAssetMenu(menuName = "AR Helmet Vision/Helmet", fileName = "Helmet")]
    public class HelmetData : ScriptableObject
    {
        public string id;
        public string brand;
        public string model;
        public string category;
        [TextArea] public string tagline;
        public Color accent = Color.white;

        [Tooltip("The helmet .glb imported by glTFast (drag the imported asset here).")]
        public GameObject prefab;

        [Header("Fit (head space, cm)")]
        [Tooltip("Euler degrees that turn the raw model so its front faces +Z and top faces +Y.")]
        public Vector3 fitRotation;
        [Tooltip("Outer shell width in cm; sets the uniform scale.")]
        public float fitWidthCm = 26f;
        [Tooltip("Where the centre of the model's bounding box sits relative to the head centre.")]
        public Vector3 fitCenterCm = new Vector3(0f, 1.5f, -3f);

        [Header("Visor")]
        [Tooltip("Name prefixes of the visor meshes (empty = no visor controls).")]
        public string[] visorMeshPrefixes = new string[0];
        public Color visorTint = new Color(0.05f, 0.05f, 0.06f, 0.45f);

        [Header("Hidden parts")]
        [Tooltip("Name prefixes of meshes that aren't part of the helmet (ground planes, straps). Removed before fitting.")]
        public string[] hiddenMeshPrefixes = new string[0];

        [Header("Credit (shown in the app)")]
        public string creditAuthor;
        public string creditLicense;
        public string creditUrl;

        public string DisplayName => $"{brand} {model}";
        public bool HasVisor => visorMeshPrefixes != null && visorMeshPrefixes.Length > 0;
    }
}
