using System.Collections.Generic;
using System.IO;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace ARHelmetVision
{
    /// <summary>
    /// Screen 3: AR try-on UI. The AR work happens in FaceHelmetRig (on the AR face prefab);
    /// this screen only changes AppState: helmet, size, visor, face-mesh overlay, calibration.
    /// </summary>
    public class TryOnScreen : MonoBehaviour
    {
        static readonly (string label, float scale)[] Sizes = { ("S", 0.95f), ("M", 1f), ("L", 1.05f), ("XL", 1.1f) };

        Text _title, _status, _credit;
        Button _meshBtn, _visorBtn;
        readonly List<Button> _helmetBtns = new();
        GameObject _calibPanel;
        readonly List<Button> _sizeBtns = new();

        void Start()
        {
            Application.targetFrameRate = 60;
            Screen.sleepTimeout = SleepTimeout.NeverSleep;
            BuildUI();
            AppState.Changed += Refresh;
            Refresh();
        }

        void OnDestroy()
        {
            AppState.Changed -= Refresh;
            Screen.sleepTimeout = SleepTimeout.SystemSetting;
        }

        void Update()
        {
            _status.text = FaceHelmetRig.TrackedCount > 0 ? "● Face locked" : "Looking for your face…";
            _status.color = FaceHelmetRig.TrackedCount > 0 ? new Color(0.3f, 0.9f, 0.6f) : new Color(1f, 0.8f, 0.3f);
        }

        void BuildUI()
        {
            var canvas = UIFactory.CreateCanvas();
            var root = UIFactory.SafeArea(canvas.transform);

            UIFactory.Button("Back", root, "←", new Color(0, 0, 0, 0.45f), Color.white, 60, () => SceneManager.LoadScene(AppState.CatalogScene), 60)
                .GetComponent<RectTransform>().Place(new Vector2(0, 1), new Vector2(0, 1), new Vector2(40, -170), new Vector2(160, -50));
            _title = UIFactory.Text("Title", root, "", 46, Color.white, TextAnchor.MiddleLeft, FontStyle.Bold);
            _title.rectTransform.Place(new Vector2(0, 1), new Vector2(1, 1), new Vector2(190, -170), new Vector2(-40, -50));
            _status = UIFactory.Text("Status", root, "", 34, Color.white);
            _status.rectTransform.Place(new Vector2(0, 1), new Vector2(1, 1), new Vector2(190, -230), new Vector2(-40, -170));

            // Side tools
            _meshBtn = SideButton(root, "Mesh", 0, () => AppState.ShowFaceMesh = !AppState.ShowFaceMesh);
            _visorBtn = SideButton(root, "Visor", 1, () => AppState.Visor = (VisorMode)(((int)AppState.Visor + 1) % 3));
            SideButton(root, "Fit", 2, () => _calibPanel.SetActive(!_calibPanel.activeSelf));
            SideButton(root, "Photo", 3, TakePhoto);

            // Sizes
            for (int i = 0; i < Sizes.Length; i++)
            {
                var s = Sizes[i];
                var b = UIFactory.Button($"Size {s.label}", root, s.label, UIFactory.DarkGlass, Color.white, 40, () => AppState.SizeScale = s.scale, 45);
                float x0 = 0.5f + (i - 2) * 0.11f;
                b.GetComponent<RectTransform>().Place(new Vector2(x0, 0), new Vector2(x0 + 0.1f, 0), new Vector2(0, 330), new Vector2(0, 420));
                _sizeBtns.Add(b);
            }

            // Helmet switcher
            var helmets = AppState.Catalog.helmets;
            float w = 1f / Mathf.Max(1, helmets.Length);
            for (int i = 0; i < helmets.Length; i++)
            {
                int idx = i;
                var b = UIFactory.Button($"Helmet {helmets[i].brand}", root, helmets[i].brand, new Color(0, 0, 0, 0.55f), Color.white, 34, () => AppState.SelectedIndex = idx, 65);
                b.GetComponent<RectTransform>().Place(new Vector2(w * i, 0), new Vector2(w * (i + 1), 0), new Vector2(12, 160), new Vector2(-12, 290));
                _helmetBtns.Add(b);
            }

            _credit = UIFactory.Text("Credit", root, "", 24, UIFactory.Muted, TextAnchor.MiddleCenter);
            _credit.rectTransform.Place(new Vector2(0, 0), new Vector2(1, 0), new Vector2(40, 60), new Vector2(-40, 130));

            BuildCalibration(root);
        }

        Button SideButton(Transform root, string label, int slot, System.Action onClick)
        {
            var b = UIFactory.Button(label, root, label, new Color(0, 0, 0, 0.5f), Color.white, 30, onClick, 40);
            float y = 0.62f - slot * 0.075f;
            b.GetComponent<RectTransform>().Place(new Vector2(1, y), new Vector2(1, y), new Vector2(-200, -60), new Vector2(-30, 60));
            return b;
        }

        void BuildCalibration(Transform root)
        {
            var panel = UIFactory.Image("Calibration", root, new Color(0.05f, 0.05f, 0.07f, 0.92f)).Rounded(48);
            panel.rectTransform.Place(new Vector2(0, 0.45f), new Vector2(0.8f, 0.75f), new Vector2(30, 0), new Vector2(0, 0));
            _calibPanel = panel.gameObject;

            var t = UIFactory.Text("Hint", panel.transform, "Fit calibration (saved on this device)", 32, Color.white, TextAnchor.MiddleLeft, FontStyle.Bold);
            t.rectTransform.Place(new Vector2(0, 1), new Vector2(1, 1), new Vector2(30, -90), new Vector2(-30, -20));

            UIFactory.Button("Flip", panel.transform, "Helmet faces wrong way? Flip", UIFactory.Panel, Color.white, 30, () => AppState.FlipFront = !AppState.FlipFront)
                .GetComponent<RectTransform>().Place(new Vector2(0, 1), new Vector2(1, 1), new Vector2(30, -200), new Vector2(-30, -110));

            Nudge(panel.transform, "Up", -290, new Vector3(0, 0.5f, 0));
            Nudge(panel.transform, "Down", -290, new Vector3(0, -0.5f, 0), right: true);
            Nudge(panel.transform, "Forward", -390, new Vector3(0, 0, 0.5f));
            Nudge(panel.transform, "Back", -390, new Vector3(0, 0, -0.5f), right: true);
            UIFactory.Button("Reset", panel.transform, "Reset", UIFactory.Panel, Color.white, 30, () => { AppState.HeadOffsetCm = Vector3.zero; AppState.FlipFront = false; })
                .GetComponent<RectTransform>().Place(new Vector2(0, 1), new Vector2(1, 1), new Vector2(30, -560), new Vector2(-30, -470));
            _calibPanel.SetActive(false);
        }

        void Nudge(Transform parent, string label, float top, Vector3 deltaCm, bool right = false)
        {
            var b = UIFactory.Button(label, parent, $"{label} 0.5 cm", UIFactory.Panel, Color.white, 30, () => AppState.HeadOffsetCm += deltaCm);
            b.GetComponent<RectTransform>().Place(new Vector2(right ? 0.5f : 0f, 1), new Vector2(right ? 1f : 0.5f, 1), new Vector2(30, top - 80), new Vector2(-30, top));
        }

        void Refresh()
        {
            var h = AppState.SelectedHelmet;
            if (!h) return;
            _title.text = h.DisplayName;
            _credit.text = $"3D model by {h.creditAuthor} · {h.creditLicense}";
            _meshBtn.GetComponent<Image>().color = AppState.ShowFaceMesh ? UIFactory.Accent : UIFactory.DarkGlass;
            _visorBtn.gameObject.SetActive(h.HasVisor);
            _visorBtn.SetLabel($"Visor\n{AppState.Visor}");
            for (int i = 0; i < Sizes.Length; i++)
                _sizeBtns[i].GetComponent<Image>().color = Mathf.Approximately(Sizes[i].scale, AppState.SizeScale) ? UIFactory.Accent : UIFactory.DarkGlass;
            for (int i = 0; i < _helmetBtns.Count; i++)
                _helmetBtns[i].GetComponent<Image>().color = i == AppState.SelectedIndex ? UIFactory.Accent : new Color(0, 0, 0, 0.55f);
        }

        void TakePhoto()
        {
            var file = $"HelmetAR-{System.DateTime.Now:yyyyMMdd-HHmmss}.png";
            ScreenCapture.CaptureScreenshot(file); // saved to Application.persistentDataPath on device
            Debug.Log($"Saved photo to {Path.Combine(Application.persistentDataPath, file)}");
        }
    }
}
