using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem.UI;
using UnityEngine.UI;

namespace ARHelmetVision
{
    /// <summary>Builds the uGUI screens in code, so scenes stay tiny and easy to regenerate.</summary>
    public static class UIFactory
    {
        static Font _font;
        public static Font Font => _font ? _font : (_font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf"));

        public static readonly Color Panel = new Color(1f, 1f, 1f, 0.08f);
        public static readonly Color Muted = new Color(0.65f, 0.67f, 0.72f);

        // HelmetAR palette (matches the web app): brand red-orange, near-black ink, light surfaces.
        public static readonly Color Accent = new Color(0.851f, 0.263f, 0.122f);   // #D9431F
        public static readonly Color Ink = new Color(0.063f, 0.063f, 0.071f);
        public static readonly Color InkMuted = new Color(0.36f, 0.36f, 0.39f);
        public static readonly Color Surface = new Color(1f, 1f, 1f, 0.72f);
        public static readonly Color DarkGlass = new Color(0f, 0f, 0f, 0.5f);

        public static Color Hex(string hex)
        {
            ColorUtility.TryParseHtmlString(hex.StartsWith("#") ? hex : "#" + hex, out var c);
            return c;
        }

        static readonly Dictionary<int, Sprite> _rounded = new Dictionary<int, Sprite>();

        /// <summary>9-sliced rounded-rectangle sprite (white), cached per corner radius.</summary>
        static Sprite RoundedSprite(int radius)
        {
            if (_rounded.TryGetValue(radius, out var cached) && cached) return cached;
            int size = radius * 2 + 16;
            var tex = new Texture2D(size, size, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear };
            var px = new Color32[size * size];
            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    float cx = Mathf.Clamp(x + 0.5f, radius, size - radius);
                    float cy = Mathf.Clamp(y + 0.5f, radius, size - radius);
                    float d = Vector2.Distance(new Vector2(x + 0.5f, y + 0.5f), new Vector2(cx, cy));
                    float a = Mathf.Clamp01(radius - d + 0.5f);
                    px[y * size + x] = new Color32(255, 255, 255, (byte)Mathf.RoundToInt(a * 255f));
                }
            }
            tex.SetPixels32(px);
            tex.Apply();
            var sprite = Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f, 0, SpriteMeshType.FullRect,
                new Vector4(radius, radius, radius, radius));
            _rounded[radius] = sprite;
            return sprite;
        }

        /// <summary>Turns an Image into a rounded rectangle (radius in canvas units).</summary>
        public static Image Rounded(this Image img, int radius)
        {
            img.sprite = RoundedSprite(radius);
            img.type = UnityEngine.UI.Image.Type.Sliced;
            return img;
        }

        /// <summary>A 1-pixel-wide vertical gradient sprite; stops are (position 0 = top .. 1 = bottom, colour).</summary>
        public static Sprite VerticalGradient(params (float t, Color c)[] stops)
        {
            const int h = 256;
            var tex = new Texture2D(2, h, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear };
            for (int row = 0; row < h; row++)
            {
                float t = row / (h - 1f);                // 0 = top of the screen
                Color c = stops[stops.Length - 1].c;
                for (int i = 1; i < stops.Length; i++)
                {
                    if (t <= stops[i].t)
                    {
                        float k = Mathf.InverseLerp(stops[i - 1].t, stops[i].t, t);
                        c = Color.Lerp(stops[i - 1].c, stops[i].c, k);
                        break;
                    }
                }
                if (t <= stops[0].t) c = stops[0].c;
                tex.SetPixel(0, h - 1 - row, c);
                tex.SetPixel(1, h - 1 - row, c);
            }
            tex.Apply();
            return Sprite.Create(tex, new Rect(0, 0, 2, h), new Vector2(0.5f, 0.5f), 100f);
        }

        public static Canvas CreateCanvas(string name = "UI")
        {
            if (!UnityEngine.Object.FindAnyObjectByType<EventSystem>())
            {
                var es = new GameObject("EventSystem", typeof(EventSystem), typeof(InputSystemUIInputModule));
                UnityEngine.Object.DontDestroyOnLoad(es);
            }
            var go = new GameObject(name, typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            var canvas = go.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = go.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1080, 1920);
            scaler.matchWidthOrHeight = 0.5f;
            return canvas;
        }

        /// <summary>Full-screen rect inset by the device safe area (notches, home bar).</summary>
        public static RectTransform SafeArea(Transform canvas)
        {
            var rt = Rect("SafeArea", canvas);
            var safe = Screen.safeArea;
            rt.anchorMin = new Vector2(safe.xMin / Screen.width, safe.yMin / Screen.height);
            rt.anchorMax = new Vector2(safe.xMax / Screen.width, safe.yMax / Screen.height);
            rt.offsetMin = rt.offsetMax = Vector2.zero;
            return rt;
        }

        public static RectTransform Rect(string name, Transform parent)
        {
            var go = new GameObject(name, typeof(RectTransform));
            var rt = (RectTransform)go.transform;
            rt.SetParent(parent, false);
            return rt;
        }

        /// <summary>Place by anchors (0..1) with pixel insets.</summary>
        public static RectTransform Place(this RectTransform rt, Vector2 anchorMin, Vector2 anchorMax, Vector2 offsetMin = default, Vector2 offsetMax = default)
        {
            rt.anchorMin = anchorMin;
            rt.anchorMax = anchorMax;
            rt.offsetMin = offsetMin;
            rt.offsetMax = offsetMax;
            return rt;
        }

        public static Image Image(string name, Transform parent, Color color)
        {
            var rt = Rect(name, parent);
            var img = rt.gameObject.AddComponent<Image>();
            img.color = color;
            return img;
        }

        public static Text Text(string name, Transform parent, string text, int size, Color color, TextAnchor align = TextAnchor.MiddleLeft, FontStyle style = FontStyle.Normal)
        {
            var rt = Rect(name, parent);
            var t = rt.gameObject.AddComponent<Text>();
            t.font = Font;
            t.text = text;
            t.fontSize = size;
            t.color = color;
            t.alignment = align;
            t.fontStyle = style;
            t.horizontalOverflow = HorizontalWrapMode.Wrap;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            t.raycastTarget = false;
            return t;
        }

        public static Button Button(string name, Transform parent, string label, Color bg, Color fg, int fontSize, Action onClick, int radius = 48)
        {
            var img = Image(name, parent, bg).Rounded(radius);
            var btn = img.gameObject.AddComponent<Button>();
            var colors = btn.colors;
            colors.pressedColor = new Color(0.8f, 0.8f, 0.8f);
            btn.colors = colors;
            btn.onClick.AddListener(() => onClick?.Invoke());
            var t = Text("Label", img.transform, label, fontSize, fg, TextAnchor.MiddleCenter, FontStyle.Bold);
            t.rectTransform.Place(Vector2.zero, Vector2.one);
            return btn;
        }

        public static void SetLabel(this Button b, string text) => b.GetComponentInChildren<Text>().text = text;

        public static void SetLabelColor(this Button b, Color color) => b.GetComponentInChildren<Text>().color = color;

        public static InputField Input(string name, Transform parent, string value, string placeholder, int fontSize, Color bg = default, Color fg = default)
        {
            var img = Image(name, parent, bg.a > 0f ? bg : Panel).Rounded(48);
            var field = img.gameObject.AddComponent<InputField>();
            var text = Text("Text", img.transform, "", fontSize, fg.a > 0f ? fg : Color.white);
            text.rectTransform.Place(Vector2.zero, Vector2.one, new Vector2(30, 0), new Vector2(-30, 0));
            text.raycastTarget = true;
            var ph = Text("Placeholder", img.transform, placeholder, fontSize, Muted, TextAnchor.MiddleLeft, FontStyle.Italic);
            ph.rectTransform.Place(Vector2.zero, Vector2.one, new Vector2(30, 0), new Vector2(-30, 0));
            field.textComponent = text;
            field.placeholder = ph;
            field.characterLimit = 24;
            field.text = value;
            return field;
        }
    }
}
