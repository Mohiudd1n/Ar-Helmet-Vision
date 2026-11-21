// Writes depth but no colour. Drawn before the helmet so helmet parts behind the
// user's real head are hidden and the camera image shows through (head occluder).
Shader "ARHelmetVision/DepthMask"
{
    SubShader
    {
        Tags { "Queue" = "Geometry-10" "RenderType" = "Opaque" }
        Pass
        {
            ZWrite On
            ZTest LEqual
            ColorMask 0
            Cull Off

            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            float4 vert (float4 vertex : POSITION) : SV_POSITION { return UnityObjectToClipPos(vertex); }
            fixed4 frag () : SV_Target { return 0; }
            ENDCG
        }
    }
}
