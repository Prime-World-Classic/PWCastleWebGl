// Uber shader. Leave first line not functional
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
varying vec2 fragTexCoord;
#endif

#if defined(VS_UV16)
attribute vec2 vertTexCoord;
varying vec2 fragTexCoord;
#endif

#if defined(VS_UV2) || defined(VS_UV2_UNUSED)
attribute vec2 vertTexCoord2;
varying vec2 fragTexCoord2;
#endif

#ifdef VS_COLOR
attribute vec4 vertColor;
varying vec4 fragColor;
#endif

uniform mat4 mWorld;
uniform mat4 mViewProj;

/*
int half2float(int h) {
	return ((h & int(0x8000)) << int(16)) | ((( h & uint(0x7c00)) + int(0x1c000)) << int(13)) | ((h & uint(0x03ff)) << uint(13));
}

vec2 unpackHalf2x16(int v) {	
	return vec2(uintBitsToFloat(half2float(v & int(0xffff))),
		    uintBitsToFloat(half2float(v >> int(16))));
}
*/

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
#ifdef VS_UV
  fragTexCoord = vertTexCoord;
#endif
#ifdef VS_UV16
  fragTexCoord = half_to_float(vertTexCoord);
#endif
#ifdef VS_UV2
  fragTexCoord2 = vertTexCoord2;
#endif

#ifdef VS_COLOR
  fragColor = vertColor / 255.0;
#endif

  gl_Position = mViewProj * mWorld * vec4(vertPosition, 1.0); // TODO: lighting
  
#ifdef VS_NORMAL
  fragNormal = vertNormal;
#endif

#if defined(VS_TANGENT)
  gl_Position += vertTangent.xxxx * 0.00001; // TODO: Implement
#endif

#if defined(VS_UV2) || defined(VS_UV2_UNUSED)
  gl_Position += vertTexCoord2.xxxx * 0.001; // TODO: Implement
#endif
}