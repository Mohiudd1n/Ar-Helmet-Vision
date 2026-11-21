using System.Collections.Generic;
using UnityEngine;
using UnityEngine.XR.ARFoundation;

namespace ARHelmetVision
{
    /// <summary>
    /// Draws the tracked face mesh as lines ("computer-vision" overlay). Rebuilt from the
    /// ARFace vertices every update so it follows expressions, and rendered with ZTest Always
    /// so it stays visible whether the head turns sideways, up or down, or the helmet covers it.
    /// Sits on a child of the face prefab; uses Resources/ARHV_OverlayLines.
    /// </summary>
    [RequireComponent(typeof(MeshFilter), typeof(MeshRenderer))]
    public class FaceWireframe : MonoBehaviour
    {
        ARFace _face;
        Mesh _mesh;
        int[] _lineIndices;
        int _sourceIndexCount = -1;
        bool _indicesSet;
        readonly List<Vector3> _verts = new();

        void Awake()
        {
            _face = GetComponentInParent<ARFace>();
            _mesh = new Mesh { name = "FaceWireframe" };
            _mesh.MarkDynamic();
            GetComponent<MeshFilter>().sharedMesh = _mesh;
            var r = GetComponent<MeshRenderer>();
            r.sharedMaterial = Resources.Load<Material>("ARHV_OverlayLines");
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
        }

        void OnEnable() { if (_face) _face.updated += OnFaceUpdated; }
        void OnDisable() { if (_face) _face.updated -= OnFaceUpdated; }

        void OnFaceUpdated(ARFaceUpdatedEventArgs args)
        {
            var vertices = _face.vertices;
            var indices = _face.indices;
            if (!vertices.IsCreated || !indices.IsCreated || vertices.Length == 0) return;

            // Topology is fixed per platform: build unique edges once.
            if (indices.Length != _sourceIndexCount)
            {
                _sourceIndexCount = indices.Length;
                var seen = new HashSet<long>();
                var lines = new List<int>(indices.Length * 2);
                for (int i = 0; i + 2 < indices.Length; i += 3)
                {
                    AddEdge(indices[i], indices[i + 1]);
                    AddEdge(indices[i + 1], indices[i + 2]);
                    AddEdge(indices[i + 2], indices[i]);
                }
                _lineIndices = lines.ToArray();

                void AddEdge(int a, int b)
                {
                    long key = a < b ? ((long)a << 32) | (uint)b : ((long)b << 32) | (uint)a;
                    if (seen.Add(key)) { lines.Add(a); lines.Add(b); }
                }
                _mesh.Clear();
                _mesh.indexFormat = vertices.Length > 65000 ? UnityEngine.Rendering.IndexFormat.UInt32 : UnityEngine.Rendering.IndexFormat.UInt16;
                _indicesSet = false;
            }

            _verts.Clear();
            for (int i = 0; i < vertices.Length; i++) _verts.Add(vertices[i]);
            _mesh.SetVertices(_verts);
            if (!_indicesSet)
            {
                _mesh.SetIndices(_lineIndices, MeshTopology.Lines, 0);
                _indicesSet = true;
            }
            _mesh.RecalculateBounds();
        }
    }
}
