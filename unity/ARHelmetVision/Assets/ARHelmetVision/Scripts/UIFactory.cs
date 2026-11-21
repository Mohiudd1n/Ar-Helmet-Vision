using System;
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

        public static Button Button(string name, Transform parent, string label, Color bg, Color fg, int fontSize, Action onClick)
        {
            var img = Image(name, parent, bg);
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

        public static InputField Input(string name, Transform parent, string value, string placeholder, int fontSize)
        {
            var img = Image(name, parent, Panel);
            var field = img.gameObject.AddComponent<InputField>();
            var text = Text("Text", img.transform, "", fontSize, Color.white);
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
