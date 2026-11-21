using UnityEngine;

namespace ARHelmetVision
{
    /// <summary>The list of helmets shown in the catalog. Lives at Resources/HelmetCatalog.asset.</summary>
    [CreateAssetMenu(menuName = "AR Helmet Vision/Helmet Catalog", fileName = "HelmetCatalog")]
    public class HelmetCatalog : ScriptableObject
    {
        public HelmetData[] helmets = new HelmetData[0];
    }
}
