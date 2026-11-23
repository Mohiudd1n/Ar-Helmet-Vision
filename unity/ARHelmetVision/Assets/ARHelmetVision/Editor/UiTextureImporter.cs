using UnityEditor;

namespace ARHelmetVision.EditorTools
{
    /// <summary>
    /// Imports everything under Assets/ARHelmetVision/Resources/UI/ as an uncropped, non-power-of-two
    /// Sprite (used by the landing screen's helmet artwork), without any manual import settings.
    /// </summary>
    public class UiTextureImporter : AssetPostprocessor
    {
        void OnPreprocessTexture()
        {
            if (!assetPath.Replace('\\', '/').Contains("/ARHelmetVision/Resources/UI/")) return;
            var importer = (TextureImporter)assetImporter;
            importer.textureType = TextureImporterType.Sprite;
            importer.spriteImportMode = SpriteImportMode.Single;
            importer.npotScale = TextureImporterNPOTScale.None;
            importer.mipmapEnabled = false;
            importer.alphaIsTransparency = true;
            importer.maxTextureSize = 2048;
        }
    }
}
