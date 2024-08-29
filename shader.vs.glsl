// Uber shader. Leave first line not functional
#ifdef VS_POSITION
attribute vec3 vertPosition;
#endif

#ifdef VS_TANGENT
attribute vec4 vertTangent;
#endif

#ifdef VS_TANGENT16
attribute vec4 vertTangent;
#endif

#ifdef VS_NORMAL
attribute vec3 vertNormal;
#endif

#ifdef VS_UV
attribute vec2 vertTexCoord;
varying vec2 fragTexCoord;
#endif

#ifdef VS_UV16
attribute vec2 vertTexCoord;
varying vec2 fragTexCoord;
#endif

#ifdef VS_UV2
attribute vec2 vertTexCoord2;
#endif

#ifdef VS_COLOR
attribute vec4 vertColor;
#endif

uniform mat4 mWorld;
uniform mat4 mView;
uniform mat4 mProj;

void main()
{
  fragTexCoord = vertTexCoord;
#ifdef VS_UV2
  fragTexCoord = vertTexCoord2;
#endif

  gl_Position = mProj * mView * mWorld * vec4(vertPosition, 1.0); // TODO: lighting
  
#ifdef VS_NORMAL
  gl_Position += vertNormal.xxxx * 0.001; // TODO: Implement
#endif

#if defined(VS_TANGENT) || defined(VS_TANGENT16)
  gl_Position += vertTangent.xxxx * 0.001; // TODO: Implement
#endif

#ifdef VS_COLOR
  gl_Position += vertColor.xxxx * 0.001; // TODO: Implement
#endif
}