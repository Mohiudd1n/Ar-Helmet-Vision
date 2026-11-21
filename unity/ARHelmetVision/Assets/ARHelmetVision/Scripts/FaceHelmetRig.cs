using UnityEngine;
using UnityEngine.XR.ARFoundation;

namespace ARHelmetVision
{
    /// <summary>
    /// Lives on the AR face prefab (spawned by ARFaceManager for each tracked face).
    /// Builds the rigid head occluder (skull + neck), mounts the selected helmet in head
    /// space, and keeps both in sync with AppState. The live ARFace mesh itself is also an
    /// occluder (its MeshRenderer uses the depth-mask material), so the helmet interior
    /// never shows through the face.
    /// </summary>
    [RequireComponent(typeof(ARFace))]
    public class FaceHelmetRig : MonoBehaviour
    {
        // Same head proportions as src/lib/headOccluder.js (cm, canonical face frame).
        static readonly Vector3 SkullCenterCm = new Vector3(0f, 3.0f, -4.8f);
        static readonly Vector3 SkullRadiiCm = new Vector3(7.8f, 10.2f, 9.6f);
        static readonly Vector3 NeckCenterCm = new Vector3(0f, -14f, -5.5f);
        const float NeckRadiusCm = 5.6f;
        const float NeckHeightCm = 22f;

        Transform _headSpace;     // head-space frame (front = +Z), flipped/offset by calibration
        Transform _helmetSlot;
        FittedHelmet _helmet;
        HelmetData _helmetData;
        ARFace _face;
        FaceWireframe _wireframe;

        public static int TrackedCount { get; private set; }

        void Awake()
        {
            _face = GetComponent<ARFace>();
            _headSpace = new GameObject("HeadSpace").transform;
            _headSpace.SetParent(transform, false);

            var depthMask = Resources.Load<Material>("ARHV_DepthMask");
            CreateOccluder(PrimitiveType.Sphere, "SkullOccluder", SkullCenterCm, SkullRadiiCm * 2f, depthMask);
            var neck = CreateOccluder(PrimitiveType.Cylinder, "NeckOccluder", NeckCenterCm,
                new Vector3(NeckRadiusCm * 2f, NeckHeightCm / 2f, NeckRadiusCm * 2f), depthMask);
            neck.localRotation = Quaternion.Euler(-7f, 0f, 0f);

            _helmetSlot = new GameObject("HelmetSlot").transform;
            _helmetSlot.SetParent(_headSpace, false);

            _wireframe = GetComponentInChildren<FaceWireframe>(true);
        }

        Transform CreateOccluder(PrimitiveType type, string name, Vector3 centerCm, Vector3 sizeCm, Material mat)
        {
            var go = GameObject.CreatePrimitive(type);
            go.name = name;
            Destroy(go.GetComponent<Collider>());
            go.transform.SetParent(_headSpace, false);
            go.transform.localPosition = centerCm / 100f;
            go.transform.localScale = sizeCm / 100f;
            var r = go.GetComponent<MeshRenderer>();
            r.sharedMaterial = mat;
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            return go.transform;
        }

        void OnEnable()
        {
            TrackedCount++;
            AppState.Changed += Apply;
            Apply();
        }

        void OnDisable()
        {
            TrackedCount--;
            AppState.Changed -= Apply;
        }

        void Update()
        {
            // Hide everything while the face is lost so a frozen helmet never floats on screen.
            bool tracked = _face.trackingState == UnityEngine.XR.ARSubsystems.TrackingState.Tracking;
            if (_headSpace.gameObject.activeSelf != tracked) _headSpace.gameObject.SetActive(tracked);
        }

        void Apply()
        {
            // Calibration: which way is "front" for this platform's face pose, plus a small offset.
            _headSpace.localRotation = AppState.FlipFront ? Quaternion.Euler(0f, 180f, 0f) : Quaternion.identity;
            _headSpace.localPosition = AppState.HeadOffsetCm / 100f;

            var wanted = AppState.SelectedHelmet;
            if (wanted && wanted != _helmetData)
            {
                if (_helmet != null) Destroy(_helmet.Root);
                _helmetData = wanted;
                _helmet = HelmetFitter.Create(wanted, _helmetSlot);
            }
            if (_helmet != null)
            {
                _helmet.SetSize(AppState.SizeScale);
                _helmet.SetVisor(AppState.Visor);
            }
            if (_wireframe) _wireframe.gameObject.SetActive(AppState.ShowFaceMesh);
        }
    }
}
