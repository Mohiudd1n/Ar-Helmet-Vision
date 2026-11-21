using System;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace ARHelmetVision
{
    /// <summary>Screen 1: greets the user (time of day + saved name) and leads to the catalog.</summary>
    public class WelcomeScreen : MonoBehaviour
    {
        Text _hello;

        void Start()
        {
            var canvas = UIFactory.CreateCanvas();
            var bg = UIFactory.Image("Background", canvas.transform, new Color(0.03f, 0.04f, 0.07f));
            bg.rectTransform.Place(Vector2.zero, Vector2.one);
            var root = UIFactory.SafeArea(canvas.transform);

            var brand = UIFactory.Text("Brand", root, "HelmetVision  AR", 44, new Color(0.4f, 0.9f, 1f), TextAnchor.MiddleLeft, FontStyle.Bold);
            brand.rectTransform.Place(new Vector2(0, 1), new Vector2(1, 1), new Vector2(70, -170), new Vector2(-70, -80));

            var greet = UIFactory.Text("Greeting", root, Greeting() + ",", 52, UIFactory.Muted);
            greet.rectTransform.Place(new Vector2(0, 1), new Vector2(1, 1), new Vector2(70, -420), new Vector2(-70, -330));

            _hello = UIFactory.Text("Name", root, "", 110, Color.white, TextAnchor.MiddleLeft, FontStyle.Bold);
            _hello.rectTransform.Place(new Vector2(0, 1), new Vector2(1, 1), new Vector2(70, -560), new Vector2(-70, -420));
            RefreshName();

            var body = UIFactory.Text("Body", root,
                $"Find your next helmet. Try real 3D models from {AppState.Catalog.helmets.Length} brands on your own head, live through the front camera.",
                44, new Color(0.85f, 0.87f, 0.9f));
            body.rectTransform.Place(new Vector2(0, 1), new Vector2(1, 1), new Vector2(70, -820), new Vector2(-70, -600));

            var nameField = UIFactory.Input("NameInput", root, AppState.UserName, "Your name (optional)", 46);
            nameField.GetComponent<RectTransform>().Place(new Vector2(0, 1), new Vector2(1, 1), new Vector2(70, -1000), new Vector2(-70, -880));
            nameField.onEndEdit.AddListener(v => { AppState.UserName = v.Trim(); RefreshName(); });

            var go = UIFactory.Button("Explore", root, "Explore helmets  →", Color.white, Color.black, 54,
                () => SceneManager.LoadScene(AppState.CatalogScene));
            go.GetComponent<RectTransform>().Place(new Vector2(0, 0), new Vector2(1, 0), new Vector2(70, 120), new Vector2(-70, 290));

            var note = UIFactory.Text("Privacy", root, "Camera images stay on your device.", 32, UIFactory.Muted, TextAnchor.MiddleCenter);
            note.rectTransform.Place(new Vector2(0, 0), new Vector2(1, 0), new Vector2(70, 40), new Vector2(-70, 110));
        }

        void RefreshName()
        {
            var n = AppState.UserName;
            _hello.text = string.IsNullOrEmpty(n) ? "Rider" : n;
        }

        static string Greeting()
        {
            int h = DateTime.Now.Hour;
            if (h < 5) return "Riding late";
            if (h < 12) return "Good morning";
            if (h < 17) return "Good afternoon";
            return "Good evening";
        }
    }
}
