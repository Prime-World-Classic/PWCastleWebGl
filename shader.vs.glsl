// Uber shader. Leave first line non functional
#ifdef VS_POSITION
attribute vec3 vertPosition;
#endif

#ifdef VS_TANGENT
attribute vec4 vertTangent;
#endif

#ifdef VS_NORMAL
attribute vec3 vertNormal;
varying vec3 fragNormal;
#endif

#if defined(VS_UV)
attribute vec2 vertTexCoord;
#endif

#if defined(VS_UV16)
attribute vec2 vertTexCoord;
#endif
varying vec2 fragTexCoord;

#if defined(VS_UV2) || defined(VS_UV2_UNUSED)
attribute vec2 vertTexCoord2;
varying vec2 fragTexCoord2;
#endif

#ifdef VS_COLOR
attribute vec4 vertColor;
varying vec4 fragColor;
#endif

#ifdef RENDER_PASS_COLOR
uniform mat4 lightViewProj;

varying vec4 v_projectedTexcoord;
#endif

#ifdef PS_GRID
varying vec2 posXZ;
#endif

uniform mat4 mWorld;
uniform mat4 mViewProj;

// Pizdos. Ebaniy webgl cannot convert half to float natively
// Also there's no bitwise operations so I had to use floats only
vec2 half_to_float(vec2 h)
{
  vec2 signBit = vec2(step(h.x, 32768.0), step(h.y, 32768.0));
  vec2 exponentBits = floor((h - (1.0 - signBit) * 32768.0) / 1024.0);
  vec2 fractionBits = h - (1.0 - signBit) * 32768.0 - exponentBits * 1024.0;

  vec2 sign = signBit * 2.0 - 1.0;
  vec2 exponent = exp2(exponentBits - 15.0);
  vec2 fraction = 1.0 + fractionBits / 1024.0;
  return sign * exponent * fraction;
}

void main()
{
#if defined(VS_UV) || defined(VS_UV16)
  #ifdef VS_UV
    fragTexCoord = vertTexCoord;
  #endif
  #ifdef VS_UV16
    fragTexCoord = half_to_float(vertTexCoord);
  #endif
#else
  fragTexCoord = vec2(vertPosition.xy); //fract(vertPosition.xx);
#endif

#ifdef VS_UV2
  fragTexCoord2 = vertTexCoord2;
#endif
#ifdef VS_COLOR
  fragColor = vertColor / 255.0;
#endif

// Transforms
  vec4 worldPos = mWorld * vec4(vertPosition, 1.0);
  gl_Position = mViewProj * worldPos;
#ifdef VS_NORMAL
  vec4 worldNormal = mWorld * vec4(normalize(vertNormal), 0.0);
  fragNormal = (worldNormal.xyz);
#endif

// Unused, but neccesary for input assembler
#if defined(VS_TANGENT)
  gl_Position += vertTangent.xxxx * 0.0000001; // TODO: Implement
#endif
#if defined(VS_UV2) || defined(VS_UV2_UNUSED)
  gl_Position += vertTexCoord2.xxxx * 0.001; // TODO: Implement
#endif

// SM projection
#ifdef RENDER_PASS_COLOR
  v_projectedTexcoord = lightViewProj * worldPos;
#endif

#ifdef PS_GRID
posXZ = vertPosition.xz;
#endif
}