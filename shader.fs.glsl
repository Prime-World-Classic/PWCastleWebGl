// Uber shader. Leave first line not functional
#if defined(VS_UV) || defined(VS_UV16)
varying vec2 fragTexCoord;
#endif


uniform sampler2D sampler;

void main()
{
  gl_FragColor = texture2D(sampler, fragTexCoord);
  #ifdef PS_ALPHAKILL
  if (gl_FragColor.a - 0.9 < 0.0) {
    discard;
  }
  #endif
}