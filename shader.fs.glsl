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

#ifdef RENDER_PASS_COLOR
uniform sampler2D smTexture;
uniform vec4 zNear_zFar;

varying vec4 v_projectedTexcoord;
#endif

void main()
{
  vec3 light = vec3(0.0);
#ifdef VS_NORMAL
/*
  gl_FragColor = vec4(fragNormal * 0.5 + 0.5, 1.0);
  return;
*/

  vec3 lightColor = vec3(1.6, 1.9, 1.5);
  light = pow(lightColor * max(0.0, dot(normalize(fragNormal), -normalize(vec3(0.00147, -0.00096, -0.00055)))), vec3(1.0/2.2));
#endif

#if defined(VS_UV) || defined(VS_UV16)
  #ifdef VS_COLOR
    #ifdef VS_UV2
      gl_FragColor = texture2D(tex0, fragTexCoord * 2.0) * vec4(fragColor.www, 1); // TODO: Implement UV scaling from CB
    #else
      gl_FragColor = texture2D(tex0, fragTexCoord) * vec4(fragColor.www, 1);
    #endif
  #else
      gl_FragColor = texture2D(tex0, fragTexCoord);
  #endif
#else
  #ifdef VS_COLOR
    gl_FragColor = vec4(pow(vec3(0.22, 0.49, 0.5), vec3(1.0/2.2)), 0.3);
  #endif
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

#ifdef RENDER_PASS_COLOR
  // No division needed since there's only one light with orthogonal projection
  vec3 projectedTexcoord = v_projectedTexcoord.xyz; // * vec3(1,-1,1);
  projectedTexcoord = vec3(projectedTexcoord.xy * 0.5 + 0.5, projectedTexcoord.z); //
  //float currentDepth = max(0.0, projectedTexcoord.z - zNear_zFar.z) / (zNear_zFar.w - zNear_zFar.z) + 0.8;
  float currentDepth = projectedTexcoord.z * 0.5 + 0.5 - 0.001;
  bool inRange = 
      projectedTexcoord.x >= 0.0 &&
      projectedTexcoord.x <= 1.0 &&
      projectedTexcoord.y >= 0.0 &&
      projectedTexcoord.y <= 1.0;
  float projectedDepth = texture2D(smTexture, projectedTexcoord.xy).r;
  float shadowLight = (inRange && projectedDepth <= currentDepth) ? 0.0 : 1.0;

  light *= shadowLight;

  gl_FragColor *= vec4(max(light, 0.5), 1.0);
#endif
}