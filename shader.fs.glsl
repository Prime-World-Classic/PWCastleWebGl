// Uber shader. Leave first line not functional
#if defined(VS_UV) || defined(VS_UV16)
varying vec2 fragTexCoord;
#endif

#if defined(VS_UV2) || defined(VS_UV2_UNUSED)
varying vec2 fragTexCoord2;
#endif

#ifdef VS_COLOR
varying vec4 fragColor;
#endif

uniform sampler2D tex0;

#ifdef TEX2
uniform sampler2D tex1;
#endif

#ifdef TEX3
uniform sampler2D tex2;
#endif

#ifdef TEX4
uniform sampler2D tex3;
#endif

#ifdef VS_NORMAL
varying vec3 fragNormal;
#endif

void main()
{
  float light = max(0.5, dot(normalize(fragNormal), normalize(vec3(1, 1, 1))));
#ifdef VS_COLOR
  gl_FragColor = texture2D(tex0, fragTexCoord * 2.0) * vec4(fragColor.www, 1);
#else
  gl_FragColor = texture2D(tex0, fragTexCoord);
#endif

#ifdef PS_ALPHAKILL
  if (gl_FragColor.a - 0.9 < 0.0) {
    discard;
  }
#endif

#ifdef TEX2
  gl_FragColor = texture2D(tex1, fragTexCoord * 2.0) * vec4(fragColor.www, 1);
  gl_FragColor = mix(gl_FragColor, texture2D(tex0, fragTexCoord * 3.0), fragColor.x);
#endif
#ifdef TEX3
  gl_FragColor = mix(gl_FragColor, texture2D(tex2, fragTexCoord * 5.0), fragColor.y);
#endif
#ifdef TEX4
  //gl_FragColor = mix(gl_FragColor, texture2D(tex3, fragTexCoord2), fragColor.w);
#endif
  gl_FragColor *= vec4(light, light, light, 1.0);
}