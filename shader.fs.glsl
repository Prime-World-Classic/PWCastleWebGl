// Uber shader. Leave first line non functional

varying vec2 fragTexCoord;

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

#ifdef RENDER_PASS_COLOR
uniform sampler2D smTexture;
uniform vec4 zNear_zFar;

uniform mat4 lightViewProj;

varying vec4 v_projectedTexcoord;
#endif

#ifdef PS_GRID
varying vec2 posXZ;
uniform vec2 cursorGridPosition;
#endif

uniform mat4 mViewProj;
uniform vec4 tintColor;
uniform vec4 uvScale;
uniform vec2 uvScroll;

vec3 neutral(vec3 color) {
  const float startCompression = 0.8 - 0.04;
  const float desaturation = 0.15;

  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;

  float peak = max(color.r, max(color.g, color.b));
  if (peak < startCompression) return color;

  const float d = 1.0 - startCompression;
  float newPeak = 1.0 - d * d / (peak + d - startCompression);
  color *= newPeak / peak;

  float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return mix(color, vec3(newPeak), g);
}

void main()
{
  const vec3 lightColor = vec3(1.0, 1.0, 1.0) * 1.6;
  const float shadowContrast = 0.6;

  const float gridFalloffDistance = 50.0;

#ifdef PS_GRID
  // Grid cells
  gl_FragColor = vec4(0.0, 0.0, 0.0, max(0.0, (1.5 - mod(posXZ.x, 7.0))) + max(0.0, (1.5 - mod(posXZ.y, 7.0))));
  gl_FragColor.rgb += vec3(gl_FragColor.a, gl_FragColor.a, 0.1);

  // Grid falloff
  float falloff = sqrt(dot(posXZ - cursorGridPosition, posXZ - cursorGridPosition)) - gridFalloffDistance;
  gl_FragColor.a *= 1.0 - falloff;
  gl_FragColor.a = (max(0.0, gl_FragColor.a - 0.9) / 30.0);
  //gl_FragColor.a = gl_FragColor.a / (1.0 + abs(gl_FragColor.a));

  vec3 light = vec3(1.0);
#ifdef RENDER_PASS_SM
  discard; // TODO: Remove from SM pass
#endif
#else
  // Diffuse lighting
  vec3 light = lightColor;
#ifdef VS_NORMAL
  // Debug Render Normals
/*
  gl_FragColor = vec4(fragNormal * 0.5 + 0.5, 1.0);
  return;
*/

#ifdef RENDER_PASS_COLOR
  light *= max(0.0, dot(normalize(fragNormal), -normalize(vec3(lightViewProj[0].z, lightViewProj[1].z, lightViewProj[2].z))));
#endif
#endif // VS_NORMAL

  // Albedo
  gl_FragColor = texture2D(tex0, fragTexCoord + uvScroll * uvScale.xx);

  gl_FragColor *= tintColor;
#if defined(PS_FALLOFF_BLEND) && defined(VS_COLOR)
  gl_FragColor *= fragColor;
#endif
#endif // PS_GRID

  // Alpha test
#if defined(PS_ALPHAKILL)
  if (gl_FragColor.a - 0.9 < 0.0) {
    discard;
  }
#endif
  #ifndef VS_COLOR
    vec4 fragColor = tintColor;
  #endif
#ifdef TEX2
  gl_FragColor = mix(gl_FragColor, texture2D(tex0, fragTexCoord * uvScale.yy), fragColor.x);
#endif
#ifdef TEX3
  gl_FragColor = mix(gl_FragColor, texture2D(tex2, fragTexCoord * uvScale.zz), fragColor.y);
#endif
#ifdef TEX4
  // WTF?
  //gl_FragColor += texture2D(tex3, fragTexCoord2 * uvScale.ww) * (1.0 - fragColor.w);
#endif

#ifdef RENDER_PASS_COLOR
  // No division needed since there's only one light with orthogonal projection
  vec3 projectedTexcoord = vec3(v_projectedTexcoord.xy * 0.5 + 0.5, v_projectedTexcoord.z);
  float currentDepth = projectedTexcoord.z * 0.5 + 0.5 - 0.001;
  float projectedDepth = texture2D(smTexture, projectedTexcoord.xy).r;  
  bool inRange = 
      projectedTexcoord.x >= 0.0 &&
      projectedTexcoord.x <= 1.0 &&
      projectedTexcoord.y >= 0.0 &&
      projectedTexcoord.y <= 1.0;
  float shadowLight = (inRange && projectedDepth <= currentDepth) ? 0.0 : 1.0;

  // Multiply diffuse by shadow weight (0 or 1)
  light *= shadowLight;

  // Apply lighting
  gl_FragColor.xyz *= max(light, shadowContrast);

  // Tonemapping
  gl_FragColor.xyz = neutral(gl_FragColor.xyz);
#endif
}