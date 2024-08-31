var gl;
var projMatrix = new Float32Array(16);
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

	gl.clearColor(0.75, 0.85, 0.8, 1.0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.enable(gl.DEPTH_TEST);
	gl.enable(gl.CULL_FACE);
	gl.frontFace(gl.CCW);
	gl.cullFace(gl.FRONT);

	// TODO: Implement camera
	mat4.perspective(projMatrix, glMatrix.toRadian(45), canvas.width / canvas.height, 0.1, 10000.0); // TODO: Configure camera params

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

				sceneObjects.push({ meshName: obj.mesh, meshData: {}, shader: obj.shader, shaderId: {}, 
					texture: obj.texture, texture_2: obj.texture_2, texture_3: obj.texture_3, texture_4: obj.texture_4, 
					textureId: {}, texture2Id: {}, texture3Id: {}, texture4Id: {}, strip: obj.strip, transform: obj.transform, indexCount: obj.indexCount});
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
								var vertexShader = gl.createShader(gl.VERTEX_SHADER);
								var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

								gl.shaderSource(vertexShader, definesText + vsText);
								gl.shaderSource(fragmentShader, definesText + fsText);

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

								sceneShaders[shaderId] = {PSO: program, attributes: scenesJson.shaderLayouts.find(value => value.name === shaderNames[shaderId]).layout, vertStride: 0};

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
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT );
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT );
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

				sceneObjects[objectId].meshData = { vertices: vertices, vertStride: vertStride, indexCount: meshFloat.length / (vertStride / 4)};
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
				gl.clearColor(0.75, 0.85, 0.8, 1.0);
				gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);

				for (i = 0; i < sceneObjects.length; ++i) {
					var meshData = sceneObjects[i].meshData;
					var associatedShader = sceneObjects[i].shaderId;
					var associatedTexture = sceneObjects[i].textureId;
					var associatedTexture2 = sceneObjects[i].texture2Id;
					var associatedTexture3 = sceneObjects[i].texture3Id;
					var associatedTexture4 = sceneObjects[i].texture4Id;
					var textures = [sceneTextures[associatedTexture], associatedTexture2 ? sceneTextures[associatedTexture2] : {}, associatedTexture3 ? sceneTextures[associatedTexture3] : {}, associatedTexture4 ? sceneTextures[associatedTexture4] : {}];
					DrawObject(sceneShaders[associatedShader].PSO, textures, 
						meshData.vertices, meshData.indexCount, meshData.vertStride, sceneShaders[associatedShader].attributes, sceneObjects[i].strip, sceneObjects[i].transform);
				}
				requestAnimationFrame(loop);
			};
			requestAnimationFrame(loop);
		} else {
			window.setTimeout(waitInitialization, 100);
		}
	}
	waitInitialization();
}

var DrawObject = function (program, textures, vertices, indexCount, vertStride, attributes, strip, transform) {
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

	var matWorldUniformLocation = gl.getUniformLocation(program, 'mWorld');
	var matViewProjUniformLocation = gl.getUniformLocation(program, 'mViewProj');

	//mat4.identity(worldMatrix); // TODO: Make per-mesh matrices
	var worldMatrix = transform ? transform : new Float32Array([
		1, 0, 0, 0,
		0, 0, 1, 0,
		0, -1, 0, 0,
		0, 0, 0, 1
	]); 
	var worldMatrix2 = new Float32Array(16);
	mat4.transpose(worldMatrix2, worldMatrix);
	
	//var camPosition = vec3.fromValues(-44, 1430, -1598);
	var camPosElements = document.getElementsByClassName("camPosition");
	var camPos = vec3.fromValues(camPosElements[0].value, camPosElements[1].value, camPosElements[2].value);

	var camForwElements = document.getElementsByClassName("camForward");
	var camForw = vec3.fromValues(camForwElements[0].value, camForwElements[1].value, camForwElements[2].value);

	/*
	//var camForw = vec3.fromValues(-0.707, -0.58, 0.4);
	var camLookAt = vec3.create();
	vec3.add(camLookAt, camPos, camForw);

	mat4.lookAt(viewMatrix, camPos, camLookAt, [0, 1, 0]); // TODO: Configure camera matrix
	
	//mat4.identity(flipMatr);
	*/
	var flipMatr =  new Float32Array([
		-1, 0, 0, 0,
		0, 1, 0, 0,
		0, 0, 1, 0,
		0, 0, 0, 1
	]); 
	var viewMatrix = new Float32Array(16);
	var viewMatrix2 = new Float32Array(16);
	var viewProjMatr = new Float32Array(16);
	//mat4.multiply(viewMatrix2, flipMatr, viewMatrix);
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

	gl.uniformMatrix4fv(matViewProjUniformLocation, gl.FALSE, viewProjMatr);

	var xRotationMatrix = new Float32Array(16);
	var yRotationMatrix = new Float32Array(16);

	//
	// Main render loop
	//
	
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

	gl.drawArrays(strip ? gl.TRIANGLE_STRIP : gl.TRIANGLES, 0, indexCount);
};