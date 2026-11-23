using System.Collections.Generic;
using UnityEngine;

namespace ARHelmetVision
{
    /// <summary>
    /// Instantiates a helmet prefab and normalises it into head space (metres here):
    /// rotate so the front faces +Z, scale so the shell is fitWidthCm wide, and place the
    /// bounding-box centre at fitCenterCm. Same maths as createFittedHelmet() in the web app.
    /// </summary>
    public static class HelmetFitter
    {
        public static FittedHelmet Create(HelmetData data, Transform parent)
        {
            var root = new GameObject($"Helmet ({data.DisplayName})").transform;
            root.SetParent(parent, false);

            var scaled = new GameObject("Scaled").transform;
            scaled.SetParent(root, false);

            var oriented = new GameObject("Oriented").transform;
            oriented.SetParent(scaled, false);
            oriented.localRotation = Quaternion.Euler(data.fitRotation);

            var model = Object.Instantiate(data.prefab, oriented, false);
            model.transform.localPosition = Vector3.zero;
            model.transform.localRotation = Quaternion.identity;
            model.transform.localScale = Vector3.one;

            // Drop parts that aren't the helmet (ground planes, straps) so they neither show
            // nor skew the bounds; inactive renderers are skipped by LocalBounds below.
            foreach (var r in model.GetComponentsInChildren<Renderer>())
                if (MeshNames.MatchesAny(r.gameObject.name, data.hiddenMeshPrefixes)) r.gameObject.SetActive(false);

            // Measure in the root's local frame (root may already be under a moving parent).
            var bounds = LocalBounds(root, model);
            float scale = (data.fitWidthCm / 100f) / Mathf.Max(bounds.size.x, 1e-5f);

            oriented.localPosition = -bounds.center;
            scaled.localScale = Vector3.one * scale;
            scaled.localPosition = data.fitCenterCm / 100f;

            foreach (var r in model.GetComponentsInChildren<Renderer>())
            {
                r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                r.receiveShadows = false;
            }

            return new FittedHelmet(root.gameObject, model, data);
        }

        static Bounds LocalBounds(Transform space, GameObject model)
        {
            var renderers = model.GetComponentsInChildren<Renderer>();
            var toLocal = space.worldToLocalMatrix;
            bool any = false;
            var b = new Bounds();
            foreach (var r in renderers)
            {
                var mf = r.GetComponent<MeshFilter>();
                Mesh mesh = mf ? mf.sharedMesh : (r is SkinnedMeshRenderer smr ? smr.sharedMesh : null);
                if (!mesh) continue;
                var m = toLocal * r.transform.localToWorldMatrix;
                var mb = mesh.bounds;
                for (int i = 0; i < 8; i++)
                {
                    var corner = mb.center + Vector3.Scale(mb.extents, new Vector3((i & 1) == 0 ? -1 : 1, (i & 2) == 0 ? -1 : 1, (i & 4) == 0 ? -1 : 1));
                    var p = m.MultiplyPoint3x4(corner);
                    if (!any) { b = new Bounds(p, Vector3.zero); any = true; } else b.Encapsulate(p);
                }
            }
            return b;
        }
    }

    /// <summary>
    /// Mesh-name matching shared with the web app's helmets.js. three.js loads names with
    /// whitespace turned into '_' and '.', ':', '/', '[', ']' removed (e.g. "Sphere.001_0" ->
    /// "Sphere001_0"); glTFast keeps the raw names. Both sides are normalised the same way,
    /// so one list of names works in both apps.
    /// </summary>
    public static class MeshNames
    {
        public static string Normalize(string name)
        {
            var sb = new System.Text.StringBuilder(name.Length);
            foreach (var c in name)
            {
                if (char.IsWhiteSpace(c)) sb.Append('_');
                else if (c != '.' && c != ':' && c != '/' && c != '[' && c != ']') sb.Append(c);
            }
            return sb.ToString();
        }

        public static bool MatchesAny(string name, string[] prefixes)
        {
            if (prefixes == null) return false;
            var n = Normalize(name);
            foreach (var p in prefixes) if (!string.IsNullOrEmpty(p) && n.StartsWith(Normalize(p))) return true;
            return false;
        }
    }

    /// <summary>A fitted helmet instance with visor controls.</summary>
    public class FittedHelmet
    {
        public readonly GameObject Root;
        readonly List<(Renderer renderer, Material[] original, Material[] smoked)> _visors = new();

        public FittedHelmet(GameObject root, GameObject model, HelmetData data)
        {
            Root = root;
            if (!data.HasVisor) return;
            // Template material lives in Resources so its shader is always included in builds.
            var smokedTemplate = Resources.Load<Material>("ARHV_SmokedVisor");
            foreach (var r in model.GetComponentsInChildren<Renderer>(true))
            {
                if (!MeshNames.MatchesAny(r.gameObject.name, data.visorMeshPrefixes)) continue;
                var original = r.sharedMaterials;
                var smoked = new Material[original.Length];
                for (int i = 0; i < smoked.Length; i++)
                {
                    smoked[i] = new Material(smokedTemplate);
                    smoked[i].SetColor("_Tint", data.visorTint);
                }
                _visors.Add((r, original, smoked));
            }
        }

        public void SetVisor(VisorMode mode)
        {
            foreach (var (r, original, smoked) in _visors)
            {
                r.enabled = mode != VisorMode.Up;
                r.sharedMaterials = mode == VisorMode.Down ? original : smoked;
            }
        }

        public void SetSize(float scale) => Root.transform.localScale = Vector3.one * scale;
    }
}
