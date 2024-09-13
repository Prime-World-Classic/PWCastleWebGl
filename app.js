var gl;

var identityMatrix;
var viewMatrix;
var flipMatr;
var viewMatrix2;
var projMatrix;
var viewProjMatr;
var cursorBasis = new Float32Array(4);
var cursorDeltaBasis = new Float32Array(4);
var cursorBasis2 = new Float32Array(4);
var viewProjInv = new Float32Array(16);

var isSMEnabled;
var lightViewProjMatrix;
var depthTexture;
var depthFramebuffer;
const depthTextureSize = 8192;
const zNear = 0.1;
const zFar = 10000.0;
var canvasWidth;
var canvasHeight;

const zNearSM = 0.1;
const zFarSM = 1200.0;

const zeroTranslation = [1072, 1360]
var gridTranslation;
var cursorPosition = [0, 0];
var gridCursorPosX;
var gridCursorPosZ;

var fov = 45;
document.onwheel = zoom;
function zoom(event) {

	fov -= event.deltaY * -0.1;

	// Restrict scale
	fov = Math.min(Math.max(15, fov), 65);
}

var doMove = false;
var cursorDeltaPos = [0.0, 0.0]
var camDeltaPos = [0.0, 0.0]

function prepareMove(event) {
	doMove = true;
}

function stopMove(event) {
	doMove = false;
}

function moveMouse(e) {
	if (doMove) {
		cursorDeltaPos[0] = e.movementX;
		cursorDeltaPos[1] = e.movementY;
	} else {
		cursorDeltaPos[0] = 0;
		cursorDeltaPos[1] = 0;
	}
	cursorPosition[0] = e.offsetX;
	cursorPosition[1] = e.offsetY;
}

var scenesJson;

var InitDemo = function (sceneName) {
	// Prepare WebGL
	{
		var canvas = document.getElementById('game-surface');

		canvas.onmousedown = prepareMove
		canvas.onmouseup = stopMove
		canvas.addEventListener("mousemove", moveMouse);

		gl = canvas.getContext('webgl');

		if (!gl) {
			console.log('WebGL not supported, falling back on experimental-webgl');
			gl = canvas.getContext('experimental-webgl');
		}

		if (!gl) {
			console.error('Your browser does not support WebGL');
			return 1;
		}

		gl.enable(gl.DEPTH_TEST);
		gl.enable(gl.CULL_FACE);
		gl.frontFace(gl.CCW);
		gl.cullFace(gl.FRONT);
	}

	// Main camera
	{
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
		canvasWidth = canvas.width;
		canvasHeight = canvas.height;
		cursorPosition = [canvasWidth, canvasHeight]
	}

	// Light camera
	{
		isSMEnabled = true;
		const ext = gl.getExtension('WEBGL_depth_texture');
		if (!ext) {
			isSMEnabled = false;
		}
		if (isSMEnabled) {
			// Setup matrix. Only one viewProj is needed
			var lightViewMatrix = new Float32Array(16);
			var lightViewMatrix2 = new Float32Array(16);
			var lightProjMatrix = new Float32Array(16);
			lightViewProjMatrix = new Float32Array(16);
			mat4.ortho(lightProjMatrix, -400, 400, -400, 400, zNearSM, zFarSM);

			var smCamParams = [
				{
					name: "ad",
					camPos: [-1239.6, -151, -1433],
					camRot: [-2.29, 2.813, 3.14]
				},
				{
					name: "doct",
					camPos: [-1395.8, -291.7, -1338.5],
					camRot: [-2.4, -1.423, 3.14]
				}
			]

			var quatStart = quat.create();
			quat.identity(quatStart);
			var quatX = quat.create();
			var quatY = quat.create();
			var quatZ = quat.create();

			var smCam = smCamParams.find(value => value.name === sceneName);
			quat.rotateX(quatX, quatStart, smCam.camRot[0]);
			quat.rotateY(quatY, quatX, smCam.camRot[1]);
			quat.rotateZ(quatZ, quatY, smCam.camRot[2]);

			mat4.fromRotationTranslation(lightViewMatrix, quatZ, vec3.create());
			mat4.translate(lightViewMatrix, lightViewMatrix, smCam.camPos);
			mat4.multiply(lightViewMatrix2, flipMatr, lightViewMatrix);
			mat4.multiply(lightViewProjMatrix, lightProjMatrix, lightViewMatrix2);

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
	}

	// Load scene objects (meshes + binded shader + binded texture) from json
	{
		var shaderNames = [];
		var texNames = [];
		var sceneObjects = [];
		var sceneBuildings = new Map;
		var uniqShaderNames = [];
		var uniqTexNames = [];

		var sceneMeshesToLoadCount = -1; // Initial value. Scene must have objects

		loadJSONResource('scenes', function (err, result) {
			if (err) {
				console.error('Fatal error getting scene (see console)');
				console.error(err);
				return 1;
			} else {
				scenesJson = result;
				currentScene = result.scenes.find(value => value.sceneName === sceneName);

				sceneMeshesToLoadCount = currentScene.objects.length + currentScene.buildings.length; // Set scene objects count to some valid value

				var loadedBuildings = [];
				loadedBuildings.push(currentScene.buildings);

				function loadObjectResources(obj) {
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
				}

				for (const obj of currentScene.objects) {
					sceneObjects.push({
						meshName: obj.mesh, meshData: {}, shader: obj.shader, shaderId: {}, blend: obj.blend,
						tintColor: obj.tintColor, uvScale: obj.uvScale,
						texture: obj.texture, texture_2: obj.texture_2, texture_3: obj.texture_3, texture_4: obj.texture_4,
						textureId: {}, texture2Id: {}, texture3Id: {}, texture4Id: {}, strip: obj.strip, transform: obj.transform, indexCount: obj.indexCount
					});
					loadObjectResources(obj);

					sceneMeshesToLoadCount--; // Decrement after each loaded object
				}
				
				identityMatrix = new Float32Array(16);
				mat4.identity(identityMatrix);
				for (const building of currentScene.buildings) {
					var buildingTranslation = building.translation ? building.translation : [0, 0];
					for (const obj of building.objects) {
						obj.transform[3] -= buildingTranslation[0];
						obj.transform[11] -= buildingTranslation[1];

						if (!sceneBuildings.has(building.name)) {
							sceneBuildings.set(building.name, {size: building.size, objects: [], transparentObjects: []});
						}
						var selectedContainer = obj.blend ? sceneBuildings.get(building.name).transparentObjects : sceneBuildings.get(building.name).objects;
						selectedContainer.push({
							meshName: obj.mesh, meshData: {}, shader: obj.shader, shaderId: {}, blend: obj.blend,
							tintColor: obj.tintColor, uvScale: obj.uvScale,
							texture: obj.texture, texture_2: obj.texture_2, texture_3: obj.texture_3, texture_4: obj.texture_4,
							textureId: {}, texture2Id: {}, texture3Id: {}, texture4Id: {}, strip: obj.strip, transform: obj.transform, indexCount: obj.indexCount
						});
						loadObjectResources(obj);
					}

					sceneMeshesToLoadCount--;
				}
			}
		});
	}

	// Remove duplicates from shaders/textures. Associate object with its shader and texture by id
	function waitLoadScene() {
		if (sceneMeshesToLoadCount == 0) {
			uniqShaderNames = [...new Set(shaderNames)];
			uniqTexNames = [...new Set(texNames)];

			function remapIndices(sceneObjectsContainer, objId) {
				sceneObjectsContainer[objId].shaderId = uniqShaderNames.findIndex(value => value === sceneObjectsContainer[objId].shader);
				sceneObjectsContainer[objId].textureId = uniqTexNames.findIndex(value => value === sceneObjectsContainer[objId].texture);
				sceneObjectsContainer[objId].texture2Id = uniqTexNames.findIndex(value => value === sceneObjectsContainer[objId].texture_2);
				sceneObjectsContainer[objId].texture3Id = uniqTexNames.findIndex(value => value === sceneObjectsContainer[objId].texture_3);
				sceneObjectsContainer[objId].texture4Id = uniqTexNames.findIndex(value => value === sceneObjectsContainer[objId].texture_4);
			}

			for (var objId = 0; objId < sceneObjects.length; objId++) {
				remapIndices(sceneObjects, objId);
			}
			sceneBuildings.forEach(function (value, key, map){
				var building = value.objects;
				for (objId = 0; objId < building.length; ++objId) {
					remapIndices(building, objId);
				}
				
				building = value.transparentObjects;
				for (objId = 0; objId < building.length; ++objId) {
					remapIndices(building, objId);
				}
			});

			LoadResources(sceneObjects, sceneBuildings, uniqShaderNames, uniqTexNames);
		} else {
			window.setTimeout(waitLoadScene, 100);
		}
	}
	waitLoadScene();
};

var LoadResources = function (sceneObjects, sceneBuildings, shaderNames, texNames) {
	// Load shaders, textures and meshes to WebGL
	var sceneTextures = new Array(texNames.length); // Textures array
	var sceneShaders = new Array(shaderNames.length); // Compiled PSOs

	var meshesLoaded = 0;
	var texturesLoaded = 0;
	var shadersLoaded = 0;

	function loadShaders(shaderId) {
		loadTextResource(shaderNames[shaderId], '.glsl', function (shaderErr, definesText) { // defines
			if (shaderErr) {
				console.error('Fatal error getting vertex shader ( ' + shaderNames[shaderId] + ' )');
				console.error(vsErr);
				return 1;
			} else {
				loadTextResource('shader', '.vs.glsl', function (vsErr, vsText) { // uber shader VS
					if (vsErr) {
						console.error('Fatal error getting vertex shader ( shader.vs.glsl )');
						console.error(vsErr);
						return 1;
					} else {
						console.debug('test');
						loadTextResource('shader', '.fs.glsl', function (fsErr, fsText) { // uber shader FS
							if (fsErr) {
								console.error('Fatal error getting fragment shader ( shader.fs.glsl )');
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
									//console.log('Loaded shader ' + shaderNames[shaderId]);

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
		texName = 'textures/' + texNames[textureId] + '.webp';
		loadImage(texName, function (imgErr, img) {
			if (imgErr) {
				console.error('Fatal error getting texture ( ' + texName + ' )');
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
				//console.log('Loaded texture ' + texName);

				texturesLoaded += 1;
			}
		});
	}

	for (i = 0; i < texNames.length; ++i) {
		loadTexture(i);
	}
	function loadMesh(sceneObjectsContainer, objectId) {
		var meshName = 'meshes/' + sceneObjectsContainer[objectId].meshName;
		loadRawTriangles(meshName, function (meshErr, meshData) {
			if (meshErr) {
				console.error('Fatal error getting mesh (' + meshName + ')');
				console.error(meshErr);
				return 1;
			} else {
				var vertices = gl.createBuffer();
				var meshFloat = new Float32Array(meshData);
				gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
				gl.bufferData(gl.ARRAY_BUFFER, meshFloat, gl.STATIC_DRAW);

				var attributes = scenesJson.shaderLayouts.find(value => value.name === shaderNames[sceneObjectsContainer[objectId].shaderId]).layout;
				var vertStride = 0;
				for (const attribute of attributes) {
					vertStride += attribute.count * attribute.sizeElem;
				}

				var indexCount = meshFloat.length / (vertStride / 4);
				if (indexCount != sceneObjectsContainer[objectId].indexCount) {
					console.error('Fatal error getting index count (' + meshName + ')');
				}

				sceneObjectsContainer[objectId].meshData = { vertices: vertices, vertStride: vertStride, indexCount: meshFloat.length / (vertStride / 4) };
				//console.log('Loaded mesh ' + meshName);

				meshesLoaded += 1;
			}
		});
	}
	for (i = 0; i < sceneObjects.length; ++i) {
		loadMesh(sceneObjects, i);
	}
	var totalMeshes = sceneObjects.length;
	sceneBuildings.forEach(function (value, key, map){
		var building = value.objects;
		for (objId = 0; objId < building.length; ++objId) {
			loadMesh(building, objId);
		}
		totalMeshes += building.length;

		building = value.transparentObjects;
		for (objId = 0; objId < building.length; ++objId) {
			loadMesh(building, objId);
		}
		totalMeshes += building.length;
	});

	function waitInitialization() {
		if (shadersLoaded == shaderNames.length && texturesLoaded == texNames.length && meshesLoaded == totalMeshes) {
			MainLoop(sceneObjects, sceneBuildings, sceneShaders, sceneTextures);
		} else {
			window.setTimeout(waitInitialization, 100);
		}
	}
	waitInitialization();
}

var MainLoop = function(sceneObjects, sceneBuildings, sceneShaders, sceneTextures) {
	function PrepareAndDrawObject(obj, isSMPass, rotation, translation) {
		var meshData = obj.meshData;
		var associatedTexture = obj.textureId;
		var associatedTexture2 = obj.texture2Id;
		var associatedTexture3 = obj.texture3Id;
		var associatedTexture4 = obj.texture4Id;
		var associatedShader = sceneShaders[obj.shaderId];
		var textures = [sceneTextures[associatedTexture], associatedTexture2 ? sceneTextures[associatedTexture2] : {}, 
			associatedTexture3 ? sceneTextures[associatedTexture3] : {}, associatedTexture4 ? sceneTextures[associatedTexture4] : {}];
		DrawObject(isSMPass ? associatedShader.PSO_SM : associatedShader.PSO, textures,
			meshData.vertices, meshData.indexCount, meshData.vertStride, sceneShaders[obj.shaderId].attributes, 
			obj.strip, obj.transform, isSMPass, obj.blend, obj.tintColor, obj.uvScale, rotation, translation);
	}

	var gridBuilding = sceneBuildings.get('grid');
	var gridTransform = gridBuilding.transparentObjects[0].transform;
	gridTranslation = [gridTransform[3], gridTransform[11]];
	var loop = function () {
		const buildings = [
			"grid",

			"storage",
			
			"crystal_farm",
			"food_farm",
			"heavy_farm",
			"light_farm",
			"silver_farm",
			"talent_farm",

			"clan_house",
			"fair",
			"house",
			"library",
			"storage",

			"agility",
			"cunning",
			"health",
			"intelligence",
			"strength",
			"tavern",

			"cat",
			"dog",
			"unicorn",
		];
		var buildingsToDraw = [];
		var buildingSelector = document.getElementsByClassName("buildings");
		var buildingRotation = document.getElementsByClassName("rotation");
		var buildingPositionX = document.getElementsByClassName("positionX");
		var buildingPositionZ = document.getElementsByClassName("positionZ");
		
		for (i = 0; i < buildingSelector.length; ++i) {
			if (buildingSelector[i].checked) {
				var mesh = sceneBuildings.get(buildings[i]);
				buildingsToDraw.push({mesh: mesh, rotation: buildingRotation[i].value, 
					translation: [zeroTranslation[0] + (buildingPositionX[i].value * 7.0 + mesh.size[0] / 2.0 * 7.0), 1, zeroTranslation[1] + (buildingPositionZ[i].value * 7.0 + mesh.size[1] / 2.0 * 7.0)]});
			}
		}

		UpdateMainCam();
		
		if (isSMEnabled) {
			gl.bindFramebuffer(gl.FRAMEBUFFER, depthFramebuffer);
			gl.viewport(0, 0, depthTextureSize, depthTextureSize);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

			for (i = 0; i < sceneObjects.length; ++i) {
				obj = sceneObjects[i];
				if (obj.blend)
					break;
				PrepareAndDrawObject(obj, true);
			}
			for (buildingToDraw of buildingsToDraw) {
				for (i = 0; i < buildingToDraw.mesh.objects.length; ++i) {
					PrepareAndDrawObject(buildingToDraw.mesh.objects[i], true, buildingToDraw.rotation, buildingToDraw.translation);
				}
			}

		}

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
		gl.clearColor(0.75, 0.85, 0.8, 1.0);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		for (buildingToDraw of buildingsToDraw) {
			for (i = 0; i < buildingToDraw.mesh.objects.length; ++i) {
				PrepareAndDrawObject(buildingToDraw.mesh.objects[i], false, buildingToDraw.rotation, buildingToDraw.translation);
			}
		}
		for (i = 0; i < sceneObjects.length; ++i) {
			PrepareAndDrawObject(sceneObjects[i], false);
		}
		for (buildingToDraw of buildingsToDraw) {
			for (i = 0; i < buildingToDraw.mesh.transparentObjects.length; ++i) {
				PrepareAndDrawObject(buildingToDraw.mesh.transparentObjects[i], false, buildingToDraw.rotation, buildingToDraw.translation);
			}
		}
		gl.disable(gl.BLEND);
		gl.enable(gl.CULL_FACE);
		gl.colorMask(true, true, true, true);
		gl.depthMask(true);

		cursorDeltaPos[0] = 0;
		cursorDeltaPos[1] = 0;

		requestAnimationFrame(loop);
	};
	requestAnimationFrame(loop);
}

var UpdateMainCam = function () {
	mat4.perspective(projMatrix, glMatrix.toRadian(fov), canvasWidth / canvasHeight, zNear, zFar);

	var camPosElements = document.getElementsByClassName("camPosition");
	var camPosX = Number(camPosElements[0].value) + camDeltaPos[0];
	var camPosY = Number(camPosElements[2].value) - camDeltaPos[1];
	var camPos = vec3.fromValues(camPosX, camPosElements[1].value, camPosY);

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

	var camForw = [viewMatrix2[2], viewMatrix2[6], viewMatrix2[10], 0];
	var camForwXY = [camForw[0], camForw[2]];
	vec2.normalize(camForwXY, camForwXY);

	var camRight = [viewMatrix2[0], viewMatrix2[4], viewMatrix2[8], 0];
	var camRightXY = [camRight[0], camRight[2]];
	vec2.normalize(camRightXY, camRightXY);

	camDeltaPos[0] -= (camForwXY[1] * cursorDeltaPos[0] - camRightXY[1] * cursorDeltaPos[1]) * 0.1;
	camDeltaPos[1] -= (camForwXY[0] * cursorDeltaPos[0] - camRightXY[0] * cursorDeltaPos[1]) * 0.1;
	
	mat4.invert(viewProjInv, viewProjMatr); // viewProj -> world

	cursorBasis = [((cursorPosition[0] - canvasWidth / 2) / canvasWidth * 2), -((cursorPosition[1] - canvasHeight / 2) / canvasHeight * 2), 1, 1];
	vec4.transformMat4(cursorBasis2, cursorBasis, viewProjInv);
	cursorBasis2[0] /= -cursorBasis2[3];
	cursorBasis2[1] /= -cursorBasis2[3];
	cursorBasis2[2] /= -cursorBasis2[3];
	
	var camForwNew = [cursorBasis2[0] - camPos[0], cursorBasis2[1] - camPos[1], cursorBasis2[2] - camPos[2]];
	vec3.normalize(camForwNew, camForwNew);
	var t = -(camPos[1] + 27) / camForwNew[1];
	gridCursorPosX = camPos[0] + t * camForwNew[0] + (zeroTranslation[0] + gridTranslation[0]);
	gridCursorPosZ = camPos[2] + t * camForwNew[2] + (zeroTranslation[1] + gridTranslation[1]);
}

var SetupMainCam = function (program) {
	var matViewProjUniformLocation = gl.getUniformLocation(program, 'mViewProj');
	gl.uniformMatrix4fv(matViewProjUniformLocation, gl.FALSE, viewProjMatr);

	var matViewProjSMUniformLocation = gl.getUniformLocation(program, 'lightViewProj');
	gl.uniformMatrix4fv(matViewProjSMUniformLocation, gl.FALSE, lightViewProjMatrix);

	var zNearFar = gl.getUniformLocation(program, 'zNear_zFar');
	gl.uniform4f(zNearFar, zNear, zFar, zNearSM, zFarSM);

	var cursorGridPosition = gl.getUniformLocation(program, 'cursorGridPosition');
	gl.uniform2f(cursorGridPosition, -gridCursorPosX, -gridCursorPosZ);
}

var SetupSMCam = function (program) {
	var matViewProjUniformLocation = gl.getUniformLocation(program, 'mViewProj');
	gl.uniformMatrix4fv(matViewProjUniformLocation, gl.FALSE, lightViewProjMatrix);
}

var GetBlendFunc = function (blendString) {
	switch (blendString) {
		case "ZERO":
			return gl.ZERO;
		case "ONE":
			return gl.ONE;
		case "SRC_COLOR":
			return gl.SRC_COLOR;
		case "ONE_MINUS_SRC_COLOR":
			return gl.ONE_MINUS_SRC_COLOR;
		case "DST_COLOR":
			return gl.DST_COLOR;
		case "ONE_MINUS_DST_COLOR":
			return gl.ONE_MINUS_DST_COLOR;
		case "SRC_ALPHA":
			return gl.SRC_ALPHA;
		case "ONE_MINUS_SRC_ALPHA":
			return gl.ONE_MINUS_SRC_ALPHA;
		case "DST_ALPHA":
			return gl.DST_ALPHA;
		case "ONE_MINUS_DST_ALPHA":
			return gl.ONE_MINUS_DST_ALPHA;
		case "CONSTANT_COLOR":
			return gl.CONSTANT_COLOR;
		case "ONE_MINUS_CONSTANT_COLOR":
			return gl.ONE_MINUS_CONSTANT_COLOR;
		case "CONSTANT_ALPHA":
			return gl.CONSTANT_ALPHA;
		case "ONE_MINUS_CONSTANT_ALPHA":
			return gl.ONE_MINUS_CONSTANT_ALPHA;
		case "SRC_ALPHA_SATURATE":
			return gl.SRC_ALPHA_SATURATE;
		case "ONE":
		default:
			return gl.ONE;
	}
}

var DrawObject = function (program, textures, vertices, indexCount, vertStride, attributes, 
	strip, transform, isSMPass, blend, tintColor, uvScale, rotation, translation) {
	if (blend) {
		gl.enable(gl.BLEND);
		gl.disable(gl.CULL_FACE);
		gl.blendEquation(gl.FUNC_ADD);
		gl.colorMask(true, true, true, false);
		gl.depthMask(false);
		gl.blendFunc(GetBlendFunc(blend[0]), GetBlendFunc(blend[1]));
	}

	gl.bindBuffer(gl.ARRAY_BUFFER, vertices);

	var attribOffset = 0;
	for (const attribute of attributes) {
		var attribLocation = gl.getAttribLocation(program, attribute.name);
		var attribType = attribute.sizeElem == 4 ? gl.FLOAT : (attribute.sizeElem == 2 ? gl.UNSIGNED_SHORT : gl.UNSIGNED_BYTE);
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
	var worldMatrix3 = new Float32Array(16);
	mat4.transpose(worldMatrix2, worldMatrix);
	mat4.fromRotation(worldMatrix3, rotation, [0, 1, 0]);
	if (rotation) {
		mat4.mul(worldMatrix2, worldMatrix3, worldMatrix2);
	}
	if (translation) {
		worldMatrix2[12] += translation[0];
		worldMatrix2[13] += translation[1];
		worldMatrix2[14] += translation[2];
	}

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