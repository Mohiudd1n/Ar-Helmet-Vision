using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace ARHelmetVision
{
    /// <summary>
    /// Screen 1: the HelmetAR landing page. Grey gradient background, the helmet artwork across the top with
    /// "Ride with / Confidence" tucked into its empty bottom-left corner, a one-line description and a
    /// red-orange GET STARTED button that opens the catalog.
    /// </summary>
    public class WelcomeScreen : MonoBehaviour
    {
        const float HeroTextureAspectFallback = 408f / 612f;

        void Start()
        {
            var canvas = UIFactory.CreateCanvas();

            // Background gradient (dark grey at the top to light grey at the bottom).
            var bg = UIFactory.Image("Background", canvas.transform, Color.white);
            bg.sprite = UIFactory.VerticalGradient(
                (0f, UIFactory.Hex("6f6f72")),
                (0.30f, UIFactory.Hex("a9a9ac")),
                (0.58f, UIFactory.Hex("dcdcde")),
                (1f, UIFactory.Hex("ececee")));
            bg.raycastTarget = false;
            bg.rectTransform.Place(Vector2.zero, Vector2.one);

            // Canvas size in canvas units (CanvasScaler: reference 1080x1920, match 0.5).
            float scale = Mathf.Pow(2f, Mathf.Lerp(Mathf.Log(Screen.width / 1080f, 2f), Mathf.Log(Screen.height / 1920f, 2f), 0.5f));
            float canvasW = Screen.width / scale;
            float canvasH = Screen.height / scale;

            // Helmet artwork (Resources/UI/helmet-hero.png, imported as a Sprite by UiTextureImporter).
            var heroSprite = Resources.Load<Sprite>("UI/helmet-hero");
            float aspect = heroSprite ? heroSprite.rect.width / heroSprite.rect.height : HeroTextureAspectFallback;
            float heroH = Mathf.Min(canvasW / aspect, canvasH * 0.68f);
            float heroW = heroH * aspect;

            var hero = UIFactory.Image("Helmet", canvas.transform, Color.white);
            hero.sprite = heroSprite;
            hero.enabled = heroSprite != null;
            hero.raycastTarget = false;
            var rt = hero.rectTransform;
            rt.anchorMin = rt.anchorMax = new Vector2(0f, 1f);
            rt.pivot = new Vector2(0f, 1f);
            rt.sizeDelta = new Vector2(heroW, heroH);
            rt.anchoredPosition = Vector2.zero;

            // Headline, in the helmet image's empty bottom-left corner (sizes scale with the artwork).
            int big = Mathf.RoundToInt(heroW * 0.095f);
            int light = Mathf.RoundToInt(heroW * 0.077f);
            float left = heroW * 0.06f;
            float baseY = heroH * 0.01f;

            var confidence = UIFactory.Text("Confidence", hero.transform, "Confidence", big, UIFactory.Ink, TextAnchor.LowerLeft, FontStyle.Bold);
            confidence.rectTransform.Place(new Vector2(0, 0), new Vector2(1, 0), new Vector2(left, baseY), new Vector2(0, baseY + big * 1.3f));

            var rideWith = UIFactory.Text("RideWith", hero.transform, "Ride with", light, new Color(0.43f, 0.43f, 0.45f), TextAnchor.LowerLeft, FontStyle.Normal);
            rideWith.rectTransform.Place(new Vector2(0, 0), new Vector2(1, 0), new Vector2(left, baseY + big * 1.2f), new Vector2(0, baseY + big * 1.2f + light * 1.3f));

            var root = UIFactory.SafeArea(canvas.transform);

            // Brand (top left)
            var brand = UIFactory.Text("Brand", root, "HelmetAR", 56, Color.white, TextAnchor.MiddleLeft, FontStyle.Bold);
            brand.rectTransform.Place(new Vector2(0, 1), new Vector2(0.8f, 1), new Vector2(60, -170), new Vector2(0, -70));

            // Description and call to action, at the bottom
            var body = UIFactory.Text("Body", root, "Try real helmets on your own head, live through your camera.",
                36, new Color(0.2f, 0.2f, 0.22f), TextAnchor.LowerLeft);
            body.rectTransform.Place(new Vector2(0, 0), new Vector2(0.78f, 0), new Vector2(60, 295), new Vector2(0, 420));

            var go = UIFactory.Button("Explore", root, "GET STARTED  →", UIFactory.Accent, Color.white, 46,
                () => SceneManager.LoadScene(AppState.CatalogScene), 80);
            go.GetComponent<RectTransform>().Place(new Vector2(0, 0), new Vector2(1, 0), new Vector2(60, 110), new Vector2(-60, 270));
        }
    }
}
