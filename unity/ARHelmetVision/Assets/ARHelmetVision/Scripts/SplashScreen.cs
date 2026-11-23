using System.Collections;
using System.IO;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;
using UnityEngine.Video;

namespace ARHelmetVision
{
    /// <summary>
    /// Screen 0: plays the "Made with Unity" clip (Assets/StreamingAssets/madewithunity.mp4) once,
    /// then fades out into the Welcome screen. Tapping skips it, and any video error or stall
    /// falls through to the Welcome screen so the app can never get stuck here.
    /// </summary>
    public class SplashScreen : MonoBehaviour
    {
        const string ClipFile = "madewithunity.mp4";
        const float MaxSeconds = 8f;                 // safety net if the video never prepares
        const float FadeSeconds = 0.35f;
        const int VideoWidth = 720, VideoHeight = 1280;
        static readonly Color Backdrop = new Color(0.137f, 0.122f, 0.125f); // same dark grey as the clip

        VideoPlayer _player;
        RenderTexture _texture;
        CanvasGroup _group;
        bool _leaving;

        void Start()
        {
            Application.targetFrameRate = 60;

            var canvas = UIFactory.CreateCanvas("Splash");
            _group = canvas.gameObject.AddComponent<CanvasGroup>();

            var bg = UIFactory.Image("Background", canvas.transform, Backdrop);
            bg.rectTransform.Place(Vector2.zero, Vector2.one);
            var skip = bg.gameObject.AddComponent<Button>();
            skip.transition = Selectable.Transition.None;
            skip.onClick.AddListener(Leave);

            _texture = new RenderTexture(VideoWidth, VideoHeight, 0);
            var raw = UIFactory.Rect("Video", canvas.transform).gameObject.AddComponent<RawImage>();
            raw.texture = _texture;
            raw.raycastTarget = false;
            raw.rectTransform.Place(Vector2.zero, Vector2.one);
            var fit = raw.gameObject.AddComponent<AspectRatioFitter>();
            fit.aspectMode = AspectRatioFitter.AspectMode.FitInParent;
            fit.aspectRatio = VideoWidth / (float)VideoHeight;

            _player = gameObject.AddComponent<VideoPlayer>();
            _player.playOnAwake = false;
            _player.isLooping = false;
            _player.source = VideoSource.Url;
            _player.url = Path.Combine(Application.streamingAssetsPath, ClipFile);
            _player.renderMode = VideoRenderMode.RenderTexture;
            _player.targetTexture = _texture;
            _player.audioOutputMode = VideoAudioOutputMode.Direct;
            _player.prepareCompleted += p => p.Play();
            _player.loopPointReached += _ => Leave();
            _player.errorReceived += (_, message) =>
            {
                Debug.LogWarning($"[HelmetAR] Splash video failed: {message}");
                Leave();
            };
            _player.Prepare();

            StartCoroutine(Safety());
        }

        void OnDestroy()
        {
            if (_texture) _texture.Release();
        }

        IEnumerator Safety()
        {
            yield return new WaitForSecondsRealtime(MaxSeconds);
            Leave();
        }

        void Leave()
        {
            if (_leaving) return;
            _leaving = true;
            StartCoroutine(FadeAndLoad());
        }

        IEnumerator FadeAndLoad()
        {
            float t = 0f;
            while (t < FadeSeconds)
            {
                t += Time.unscaledDeltaTime;
                _group.alpha = 1f - Mathf.Clamp01(t / FadeSeconds);
                yield return null;
            }
            if (_player) _player.Stop();
            SceneManager.LoadScene(AppState.WelcomeScene);
        }
    }
}
