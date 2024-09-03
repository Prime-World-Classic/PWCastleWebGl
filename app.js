var gl;

var viewMatrix;
var flipMatr;
var viewMatrix2;
var projMatrix;
var viewProjMatr;

var isSMEnabled;
var lightViewProjMatrix;
var depthTexture;
var depthFramebuffer;
const depthTextureSize = 2048;
const zNear = 0.1;
const zFar = 10000.0;

const zNearSM = 0.1;
const zFarSM = 5000.0;

var scenesJson;

var InitDemo = function () {
	// Prepare WebGL
	var canvas = document.getElementById('game-surface');
	gl = canvas.getContext('webgl');

	if (!gl) {
		console.log('WebGL not supported, falling back on experimental-webgl');
		gl = canvas.getContext('experimental-webgl');
	}

	if (!gl) {
		alert('Your browser does not support WebGL');
		return 1;
	}

	gl.enable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);
	gl.frontFace(gl.CCW);
	gl.cullFace(gl.FRONT);

	// Main camera
	viewMatrix = new Float32Array(16);
	viewMatrix2 = new Float32Array(16);
	projMatrix = new Float32Array(16);
	viewProjMatr = new Float32Array(16);
	flipMatr = new Float32Array([
		-1, 0, 0, 0,
		0, 1, 0, 0,
		0, 0, 1, 0,
		0, 0, 0, 1
	]);
	mat4.perspective(projMatrix, glMatrix.toRadian(45), canvas.width / canvas.height, zNear, zFar);

	// Light camera
	isSMEnabled = true;
	const ext = gl.getExtension('WEBGL_depth_texture');
	if (!ext) {
		isSMEnabled = false;
	}
	if (isSMEnabled) {
		// Setup matrix. Only one viewProj is needed
		var lightProjMatrix = new Float32Array(16);
		mat4.ortho(lightProjMatrix, -200, 200, -200, 200, zNearSM, zFarSM);
		var lightViewMatrix = new Float32Array([
			0.162479758, 0.285912007, -0.944380701, 0,
			0.000258785, 0.957086265, 0.289803177, 0,
			0.986711979, -0.047331572, 0.155433148, 0,
			-1581.244507, -332.2875977, 487.700531, 1

		]);
		lightViewProjMatrix = new Float32Array([
			-0.0012, -0.00206, 0.00015, 0,
			0.00147, -0.00096, -0.00055, 0,
			-0.00218, 0.00048, -0.00046, 0,
			4.00097, 1.64843, 1.05647, 1
		]);
		//mat4.multiply(lightViewProjMatrix, lightProjMatrix, lightViewMatrix);
		lightViewProjInvMatrix = new Float32Array(16);
		mat4.invert(lightViewProjInvMatrix, lightProjMatrix);

		// Setup textures
		depthTexture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, depthTexture);
		gl.texImage2D(
			gl.TEXTURE_2D,      // target
			0,                  // mip level
			gl.DEPTH_COMPONENT, // internal format
			depthTextureSize,   // width
			depthTextureSize,   // height
			0,                  // border
			gl.DEPTH_COMPONENT, // format
			gl.UNSIGNED_INT,    // type
			null);              // data
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

		depthFramebuffer = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, depthFramebuffer);
		gl.framebufferTexture2D(
			gl.FRAMEBUFFER,       // target
			gl.DEPTH_ATTACHMENT,  // attachment point
			gl.TEXTURE_2D,        // texture target
			depthTexture,         // texture
			0);                   // mip level

		const unusedTexture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, unusedTexture);
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA,
			depthTextureSize,
			depthTextureSize,
			0,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			null,
		);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

		// attach it to the framebuffer
		gl.framebufferTexture2D(
			gl.FRAMEBUFFER,        // target
			gl.COLOR_ATTACHMENT0,  // attachment point
			gl.TEXTURE_2D,         // texture target
			unusedTexture,         // texture
			0);                    // mip level
	}

	// Load scene objects (meshes + binded shader + binded texture) from json
	var shaderNames = [];
	var texNames = [];
	var sceneObjects = [];
	var uniqShaderNames = [];
	var uniqTexNames = [];

	var sceneMeshesToLoadCount = -1; // Initial value. Scene must have objects

	loadJSONResource('scenes', function (err, result) {
		if (err) {
			alert('Fatal error getting scene (see console)');
			console.error(err);
			return 1;
		} else {
			scenesJson = result;
			var loadedScenes = [];
			loadedScenes.push(result.adornia);
			// TODO: Docts

			var selectedScene = 0;
			sceneMeshesToLoadCount = loadedScenes[selectedScene].length; // Set scene objects count to some valid value

			for (const obj of loadedScenes[selectedScene]) {

				sceneObjects.push({
					meshName: obj.mesh, meshData: {}, shader: obj.shader, shaderId: {}, blend: obj.blend,
					tintColor: obj.tintColor, uvScale: obj.uvScale,
					texture: obj.texture, texture_2: obj.texture_2, texture_3: obj.texture_3, texture_4: obj.texture_4,
					textureId: {}, texture2Id: {}, texture3Id: {}, texture4Id: {}, strip: obj.strip, transform: obj.transform, indexCount: obj.indexCount
				});
				shaderNames.push(obj.shader);
				texNames.push(obj.texture);
				if (obj.texture_2) {
					texNames.push(obj.texture_2);
				}
				if (obj.texture_3) {
					texNames.push(obj.texture_3);
				}
				if (obj.texture_4) {
					texNames.push(obj.texture_4);
				}

				sceneMeshesToLoadCount--; // Decrement after each loaded object
			}
		}
	});

	// Remove duplicates from shaders/textures. Associate object with its shader and texture by id
	function waitLoadScene() {
		if (sceneMeshesToLoadCount == 0) {
			uniqShaderNames = [...new Set(shaderNames)];
			uniqTexNames = [...new Set(texNames)];

			for (var objId = 0; objId < sceneObjects.length; objId++) {
				sceneObjects[objId].shaderId = uniqShaderNames.findIndex(value => value === sceneObjects[objId].shader);
				sceneObjects[objId].textureId = uniqTexNames.findIndex(value => value === sceneObjects[objId].texture);
				sceneObjects[objId].texture2Id = uniqTexNames.findIndex(value => value === sceneObjects[objId].texture_2);
				sceneObjects[objId].texture3Id = uniqTexNames.findIndex(value => value === sceneObjects[objId].texture_3);
				sceneObjects[objId].texture4Id = uniqTexNames.findIndex(value => value === sceneObjects[objId].texture_4);
			}

			LoadResources(sceneObjects, uniqShaderNames, uniqTexNames);
		} else {
			window.setTimeout(waitLoadScene, 100);
		}
	}
	waitLoadScene();
};

var LoadResources = function (sceneObjects, shaderNames, texNames) {
	// Load shaders, textures and meshes to WebGL
	var sceneTextures = new Array(texNames.length); // Textures array
	var sceneShaders = new Array(shaderNames.length); // Compiled PSOs

	var meshesLoaded = 0;
	var texturesLoaded = 0;
	var shadersLoaded = 0;

	function loadShaders(shaderId) {
		loadTextResource(shaderNames[shaderId], '.glsl', function (shaderErr, definesText) { // defines
			if (shaderErr) {
				alert('Fatal error getting vertex shader ( ' + shaderNames[shaderId] + ' )');
				console.error(vsErr);
				return 1;
			} else {
				loadTextResource('shader', '.vs.glsl', function (vsErr, vsText) { // uber shader VS
					if (vsErr) {
						alert('Fatal error getting vertex shader ( shader.vs.glsl )');
						console.error(vsErr);
						return 1;
					} else {
						console.debug('test');
						loadTextResource('shader', '.fs.glsl', function (fsErr, fsText) { // uber shader FS
							if (fsErr) {
								alert('Fatal error getting fragment shader ( shader.fs.glsl )');
								console.error(fsErr);
								return 1;
							} else {
								var PrepareShader = function (renderPassDefine) {
									var vertexShader = gl.createShader(gl.VERTEX_SHADER);
									var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

									gl.shaderSource(vertexShader, definesText + renderPassDefine + vsText);
									gl.shaderSource(fragmentShader, definesText + renderPassDefine + fsText);

									gl.compileShader(vertexShader);
									if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
										console.error('ERROR compiling vertex shader!', gl.getShaderInfoLog(vertexShader));
										return 1;
									}

									gl.compileShader(fragmentShader);
									if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
										console.error('ERROR compiling fragment shader!', gl.getShaderInfoLog(fragmentShader));
										return 1;
									}
									console.log('Loaded shader ' + shaderNames[shaderId]);

									var program = gl.createProgram();
									gl.attachShader(program, vertexShader);
									gl.attachShader(program, fragmentShader);
									gl.linkProgram(program);
									if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
										console.error('ERROR linking program!', gl.getProgramInfoLog(program));
										return 1;
									}
									gl.validateProgram(program);
									if (!gl.getProgramParameter(program, gl.VALIDATE_STATUS)) {
										console.error('ERROR validating program!', gl.getProgramInfoLog(program));
										return 1;
									}
									return program;
								}

								var programColor = PrepareShader("\n#define RENDER_PASS_COLOR\n");
								var programSM = PrepareShader("\n#define RENDER_PASS_SM\n");

								sceneShaders[shaderId] = { PSO: programColor, PSO_SM: programSM, attributes: scenesJson.shaderLayouts.find(value => value.name === shaderNames[shaderId]).layout, vertStride: 0 };

								shadersLoaded += 1;
							}
						});
					}
				});
			}
		});
	}

	for (i = 0; i < shaderNames.length; ++i) {
		loadShaders(i);
	}

	function loadTexture(textureId) {
		texName = 'meshes/' + texNames[textureId] + '.webp';
		loadImage(texName, function (imgErr, img) {
			if (imgErr) {
				alert('Fatal error getting texture ( ' + texName + ' )');
				console.error(imgErr);
				return 1;
			} else {
				var texture = gl.createTexture();
				gl.bindTexture(gl.TEXTURE_2D, texture);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
				gl.texImage2D(
					gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA,
					gl.UNSIGNED_BYTE,
					img
				);
				gl.generateMipmap(gl.TEXTURE_2D);

				sceneTextures[textureId] = texture;
				console.log('Loaded texture ' + texName);

				texturesLoaded += 1;
			}
		});
	}

	for (i = 0; i < texNames.length; ++i) {
		loadTexture(i);
	}
	function loadMesh(objectId) {
		var meshName = 'meshes/' + sceneObjects[objectId].meshName;
		loadRawTriangles(meshName, function (meshErr, meshData) {
			if (meshErr) {
				alert('Fatal error getting mesh (' + meshName + ')');
				console.error(meshErr);
				return 1;
			} else {
				var vertices = gl.createBuffer();
				var meshFloat = new Float32Array(meshData);
				gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
				gl.bufferData(gl.ARRAY_BUFFER, meshFloat, gl.STATIC_DRAW);

				var attributes = scenesJson.shaderLayouts.find(value => value.name === shaderNames[sceneObjects[objectId].shaderId]).layout;
				var vertStride = 0;
				for (const attribute of attributes) {
					vertStride += attribute.count * attribute.sizeElem;
				}

				var indexCount = meshFloat.length / (vertStride / 4);
				if (indexCount != sceneObjects[objectId].indexCount) {
					alert('Fatal error getting index count (' + meshName + ')');
				}

				sceneObjects[objectId].meshData = { vertices: vertices, vertStride: vertStride, indexCount: meshFloat.length / (vertStride / 4) };
				console.log('Loaded mesh ' + meshName);

				meshesLoaded += 1;
			}
		});
	}
	for (i = 0; i < sceneObjects.length; ++i) {
		loadMesh(i);
	}


	function waitInitialization() {
		if (shadersLoaded == shaderNames.length && texturesLoaded == texNames.length && meshesLoaded == sceneObjects.length) {
			var loop = function () {
				if (isSMEnabled) {
					gl.bindFramebuffer(gl.FRAMEBUFFER, depthFramebuffer);
					gl.viewport(0, 0, depthTextureSize, depthTextureSize);
					gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
					gl.cullFace(gl.BACK);

					for (i = 0; i < sceneObjects.length; ++i) {
						if (sceneObjects[i].blend)
							break;
						var meshData = sceneObjects[i].meshData;
						var associatedShader = sceneObjects[i].shaderId;
						var associatedTexture = sceneObjects[i].textureId;
						var associatedTexture2 = sceneObjects[i].texture2Id;
						var associatedTexture3 = sceneObjects[i].texture3Id;
						var associatedTexture4 = sceneObjects[i].texture4Id;
						var textures = [sceneTextures[associatedTexture], associatedTexture2 ? sceneTextures[associatedTexture2] : {}, associatedTexture3 ? sceneTextures[associatedTexture3] : {}, associatedTexture4 ? sceneTextures[associatedTexture4] : {}];
						DrawObject(sceneShaders[associatedShader].PSO_SM, textures,
							meshData.vertices, meshData.indexCount, meshData.vertStride, sceneShaders[associatedShader].attributes, sceneObjects[i].strip, sceneObjects[i].transform, true);
					}
				}

				gl.bindFramebuffer(gl.FRAMEBUFFER, null);
				gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
				gl.clearColor(0.75, 0.85, 0.8, 1.0);
				gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
				gl.cullFace(gl.FRONT);

				for (i = 0; i < sceneObjects.length; ++i) {
					var meshData = sceneObjects[i].meshData;
					var associatedShader = sceneObjects[i].shaderId;
					var associatedTexture = sceneObjects[i].textureId;
					var associatedTexture2 = sceneObjects[i].texture2Id;
					var associatedTexture3 = sceneObjects[i].texture3Id;
					var associatedTexture4 = sceneObjects[i].texture4Id;
					var textures = [sceneTextures[associatedTexture], associatedTexture2 ? sceneTextures[associatedTexture2] : {}, associatedTexture3 ? sceneTextures[associatedTexture3] : {}, associatedTexture4 ? sceneTextures[associatedTexture4] : {}];
					DrawObject(sceneShaders[associatedShader].PSO, textures,
						meshData.vertices, meshData.indexCount, meshData.vertStride, sceneShaders[associatedShader].attributes, sceneObjects[i].strip, sceneObjects[i].transform, false,
						sceneObjects[i].blend, sceneObjects[i].tintColor, sceneObjects[i].uvScale
					);
				}
				gl.disable(gl.BLEND);
				requestAnimationFrame(loop);
			};
			requestAnimationFrame(loop);
		} else {
			window.setTimeout(waitInitialization, 100);
		}
	}
	waitInitialization();
}


var SetupMainCam = function (program) {
	var camPosElements = document.getElementsByClassName("camPosition");
	var camPos = vec3.fromValues(camPosElements[0].value, camPosElements[1].value, camPosElements[2].value);

	var camForwElements = document.getElementsByClassName("camForward");
	var quatStart = quat.create();
	quat.identity(quatStart);
	var quatX = quat.create();
	var quatY = quat.create();
	var quatZ = quat.create();
	quat.rotateX(quatX, quatStart, camForwElements[0].value);
	quat.rotateY(quatY, quatX, camForwElements[1].value);
	quat.rotateZ(quatZ, quatY, camForwElements[2].value);

	mat4.fromRotationTranslation(viewMatrix, quatZ, vec3.create());
	mat4.translate(viewMatrix, viewMatrix, camPos);
	mat4.multiply(viewMatrix2, flipMatr, viewMatrix);
	mat4.multiply(viewProjMatr, projMatrix, viewMatrix2);

	var matViewProjUniformLocation = gl.getUniformLocation(program, 'mViewProj');
	gl.uniformMatrix4fv(matViewProjUniformLocation, gl.FALSE, viewProjMatr);

	var matViewProjSMUniformLocation = gl.getUniformLocation(program, 'lightViewProj');
	gl.uniformMatrix4fv(matViewProjSMUniformLocation, gl.FALSE, lightViewProjMatrix);

	var zNearFar = gl.getUniformLocation(program, 'zNear_zFar');
	gl.uniform4f(zNearFar, zNear, zFar, zNearSM, zFarSM);

}

var SetupSMCam = function (program) {
	var matViewProjUniformLocation = gl.getUniformLocation(program, 'mViewProj');
	gl.uniformMatrix4fv(matViewProjUniformLocation, gl.FALSE, lightViewProjMatrix);
}


var DrawObject = function (program, textures, vertices, indexCount, vertStride, attributes, strip, transform, isSMPass, blend, tintColor, uvScale) {
	if (blend) {
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.DST_COLOR);
	}

	gl.bindBuffer(gl.ARRAY_BUFFER, vertices);

	var attribOffset = 0;
	for (const attribute of attributes) {
		var attribLocation = gl.getAttribLocation(program, attribute.name);
		var attribType = attribute.sizeElem == 4 ? gl.FLOAT : (attribute.sizeElem == 2 ? gl.SHORT : gl.UNSIGNED_BYTE);
		gl.vertexAttribPointer(
			attribLocation, // Attribute location
			attribute.count, // Number of elements per attribute
			attribType, // Type of elements
			gl.TRUE,
			vertStride, // Size of an individual vertex
			attribOffset // Offset from the beginning of a single vertex to this attribute
		);
		gl.enableVertexAttribArray(attribLocation);
		attribOffset += attribute.count * attribute.sizeElem;
	}

	gl.bindTexture(gl.TEXTURE_2D, null);

	// Tell OpenGL state machine which program should be active.
	gl.useProgram(program);

	isSMPass ? SetupSMCam(program) : SetupMainCam(program);

	var tintColorValue = tintColor ? tintColor : [1, 1, 1, 1];
	var tintColorLocation = gl.getUniformLocation(program, 'tintColor');
	gl.uniform4fv(tintColorLocation, tintColorValue);


	var uvScaleValue = uvScale ? uvScale : [1, 1, 1, 1];
	var uvScaleLocation = gl.getUniformLocation(program, 'uvScale');
	gl.uniform4fv(uvScaleLocation, uvScaleValue);

	//
	// Main render loop
	//

	var worldMatrix = transform ? transform : new Float32Array([
		1, 0, 0, 0,
		0, 0, 1, 0,
		0, -1, 0, 0,
		0, 0, 0, 1
	]);
	var worldMatrix2 = new Float32Array(16);
	mat4.transpose(worldMatrix2, worldMatrix);

	var matWorldUniformLocation = gl.getUniformLocation(program, 'mWorld');
	gl.uniformMatrix4fv(matWorldUniformLocation, gl.FALSE, worldMatrix2);

	for (var i = 0; i < textures.length; ++i) {
		if (textures[i]) {
			gl.activeTexture(gl.TEXTURE0 + i);
			gl.bindTexture(gl.TEXTURE_2D, textures[i]);
			var attribName = "tex" + i;
			var texLocation = gl.getUniformLocation(program, attribName);
			gl.uniform1i(texLocation, i);
		}
	}

	if (!isSMPass) {
		gl.activeTexture(gl.TEXTURE0 + textures.length);
		gl.bindTexture(gl.TEXTURE_2D, depthTexture);
		var attribNameSM = "smTexture";
		var texLocationSM = gl.getUniformLocation(program, attribNameSM);
		gl.uniform1i(texLocationSM, textures.length);
	}

	gl.drawArrays(strip ? gl.TRIANGLE_STRIP : gl.TRIANGLES, 0, indexCount);
};