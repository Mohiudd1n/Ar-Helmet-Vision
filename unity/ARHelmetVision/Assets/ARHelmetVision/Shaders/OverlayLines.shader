// Unlit lines drawn on top of everything, so the face-tracking mesh stays visible
// at any head angle, even where the helmet covers the face.
Shader "ARHelmetVision/OverlayLines"
{
    Properties
    {
        _Color ("Color", Color) = (0.13, 0.83, 0.93, 0.85)
    }
    SubShader
    {
        Tags { "Queue" = "Overlay" "RenderType" = "Transparent" "IgnoreProjector" = "True" }
        Pass
        {
            ZWrite Off
            ZTest Always
            Cull Off
            Blend SrcAlpha OneMinusSrcAlpha

            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            fixed4 _Color;
            float4 vert (float4 vertex : POSITION) : SV_POSITION { return UnityObjectToClipPos(vertex); }
            fixed4 frag () : SV_Target { return _Color; }
            ENDCG
        }
    }
}
