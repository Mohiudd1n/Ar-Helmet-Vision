// Tinted, see-through visor with a fresnel sheen, so the face stays visible behind it.
Shader "ARHelmetVision/SmokedVisor"
{
    Properties
    {
        _Tint ("Tint", Color) = (0.05, 0.05, 0.06, 0.45)
        _RimColor ("Rim", Color) = (0.8, 0.85, 0.9, 1)
        _RimPower ("Rim Power", Range(0.5, 8)) = 3
    }
    SubShader
    {
        Tags { "Queue" = "Transparent" "RenderType" = "Transparent" "IgnoreProjector" = "True" }
        Pass
        {
            ZWrite Off
            Cull Off
            Blend SrcAlpha OneMinusSrcAlpha

            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            fixed4 _Tint;
            fixed4 _RimColor;
            float _RimPower;

            struct v2f { float4 pos : SV_POSITION; float3 n : TEXCOORD0; float3 v : TEXCOORD1; };

            v2f vert (appdata_base i)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(i.vertex);
                o.n = UnityObjectToWorldNormal(i.normal);
                o.v = normalize(WorldSpaceViewDir(i.vertex));
                return o;
            }

            fixed4 frag (v2f i) : SV_Target
            {
                float rim = pow(1 - saturate(abs(dot(normalize(i.n), normalize(i.v)))), _RimPower);
                fixed4 c = _Tint;
                c.rgb = lerp(c.rgb, _RimColor.rgb, rim * 0.6);
                c.a = saturate(_Tint.a + rim * 0.35);
                return c;
            }
            ENDCG
        }
    }
}
