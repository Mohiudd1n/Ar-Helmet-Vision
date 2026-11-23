using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace ARHelmetVision
{
    /// <summary>
    /// Screen 2: helmet catalog. Shows the selected real 3D model on a turntable,
    /// brand tabs to switch, and "Try on in AR" to open screen 3.
    /// </summary>
    public class CatalogScreen : MonoBehaviour
    {
        [SerializeField] Transform turntable;
        [SerializeField] float spinSpeed = 30f;

        Text _brand, _model, _category, _tagline, _credit;
        readonly List<Button> _tabs = new();
        GameObject _shown;

        void Start()
        {
            if (!turntable) turntable = new GameObject("Turntable").transform;
            BuildUI();
            Show(AppState.SelectedIndex);
        }

        void Update()
        {
            turntable.Rotate(0f, spinSpeed * Time.deltaTime, 0f, Space.World);
        }

        void BuildUI()
        {
            var canvas = UIFactory.CreateCanvas();
            var root = UIFactory.SafeArea(canvas.transform);

            UIFactory.Button("Back", root, "←", Color.white, UIFactory.Ink, 60, () => SceneManager.LoadScene(AppState.WelcomeScene), 60)
                .GetComponent<RectTransform>().Place(new Vector2(0, 1), new Vector2(0, 1), new Vector2(50, -170), new Vector2(170, -50));
            var title = UIFactory.Text("Title", root, "Helmet catalog", 56, UIFactory.Ink, TextAnchor.MiddleLeft, FontStyle.Bold);
            title.rectTransform.Place(new Vector2(0, 1), new Vector2(1, 1), new Vector2(200, -170), new Vector2(-50, -50));

            // Info panel
            var panel = UIFactory.Image("Info", root, new Color(1f, 1f, 1f, 0.9f)).Rounded(64);
            panel.rectTransform.Place(new Vector2(0, 0), new Vector2(1, 0), new Vector2(30, 30), new Vector2(-30, 830));

            _brand = UIFactory.Text("Brand", panel.transform, "", 40, Color.white, TextAnchor.MiddleLeft, FontStyle.Bold);
            _brand.rectTransform.Place(new Vector2(0, 1), new Vector2(1, 1), new Vector2(50, -110), new Vector2(-50, -40));
            _model = UIFactory.Text("Model", panel.transform, "", 72, UIFactory.Ink, TextAnchor.MiddleLeft, FontStyle.Bold);
            _model.rectTransform.Place(new Vector2(0, 1), new Vector2(1, 1), new Vector2(50, -210), new Vector2(-50, -110));
            _category = UIFactory.Text("Category", panel.transform, "", 34, UIFactory.InkMuted);
            _category.rectTransform.Place(new Vector2(0, 1), new Vector2(1, 1), new Vector2(50, -270), new Vector2(-50, -210));
            _tagline = UIFactory.Text("Tagline", panel.transform, "", 38, new Color(0.2f, 0.2f, 0.23f));
            _tagline.rectTransform.Place(new Vector2(0, 1), new Vector2(1, 1), new Vector2(50, -380), new Vector2(-50, -270));

            // Brand tabs
            var helmets = AppState.Catalog.helmets;
            float w = 1f / Mathf.Max(1, helmets.Length);
            for (int i = 0; i < helmets.Length; i++)
            {
                int idx = i;
                var tab = UIFactory.Button($"Tab {helmets[i].brand}", panel.transform, helmets[i].brand, new Color(0f, 0f, 0f, 0.06f), UIFactory.Ink, 34, () => Show(idx), 50);
                tab.GetComponent<RectTransform>().Place(new Vector2(w * i, 1), new Vector2(w * (i + 1), 1), new Vector2(12, -520), new Vector2(-12, -420));
                _tabs.Add(tab);
            }

            UIFactory.Button("TryOn", panel.transform, "Try on in AR", UIFactory.Accent, Color.white, 52, () => SceneManager.LoadScene(AppState.TryOnScene), 75)
                .GetComponent<RectTransform>().Place(new Vector2(0, 0), new Vector2(1, 0), new Vector2(50, 110), new Vector2(-50, 260));

            _credit = UIFactory.Text("Credit", panel.transform, "", 26, UIFactory.InkMuted, TextAnchor.MiddleCenter);
            _credit.rectTransform.Place(new Vector2(0, 0), new Vector2(1, 0), new Vector2(50, 30), new Vector2(-50, 100));
        }

        void Show(int index)
        {
            AppState.SelectedIndex = index;
            var h = AppState.SelectedHelmet;
            if (!h) return;

            _brand.text = h.brand.ToUpperInvariant();
            _brand.color = h.accent;
            _model.text = h.model;
            _category.text = h.category;
            _tagline.text = h.tagline;
            _credit.text = $"3D model by {h.creditAuthor} · {h.creditLicense}";
            for (int i = 0; i < _tabs.Count; i++)
            {
                bool on = i == index;
                _tabs[i].GetComponent<Image>().color = on ? UIFactory.Ink : new Color(0f, 0f, 0f, 0.06f);
                _tabs[i].SetLabelColor(on ? Color.white : UIFactory.Ink);
            }

            if (_shown) Destroy(_shown);
            if (!h.prefab) return;
            var fitted = HelmetFitter.Create(h, turntable);
            // Centre the shell on the turntable axis (fitCenter is where its bounds centre sits).
            fitted.Root.transform.localPosition = -h.fitCenterCm / 100f;
            fitted.SetVisor(VisorMode.Down);
            _shown = fitted.Root;
        }
    }
}
