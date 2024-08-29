// Load a text resource from a file over the network
var loadTextResource = function (url, ext, callback) {
	var request = new XMLHttpRequest();
	request.open('GET', url + ext + '?please-dont-cache=' + Math.random(), true);
	request.onload = function () {
		if (request.status < 200 || request.status > 299) {
			callback('Error: HTTP Status ' + request.status + ' on resource ' + url);
		} else {
			callback(null, request.responseText);
		}
	};
	request.send();
};

var loadJSONResource = function (url, callback) {
	loadTextResource(url, '.json', function (err, result) {
		if (err) {
			callback(err);
		} else {
			try {
				callback(null, JSON.parse(result));
			} catch (e) {
				callback(e);
			}
		}
	});
};

var loadImage = function (url, callback) {
	var image = new Image();
	image.onload = function () {
		callback(null, image);
	};
	image.src = url;
};

var loadRawResource = function (url, callback) {
	var request = new XMLHttpRequest();
	request.open('GET', url + '?please-dont-cache=' + Math.random(), true);
    request.responseType = 'arraybuffer';
	request.onload = function () {
		if (request.status < 200 || request.status > 299) {
			callback('Error: HTTP Status ' + request.status + ' on resource ' + url);
		} else {
			callback(null, request.response);
		}
	};
	request.send();
};

var loadRawTriangles = function (url, callback) {
	loadRawResource(url, function (err, result) {
		if (err) {
			callback(err);
		} else {
			try {
				callback(null, result);
			} catch (e) {
				callback(e);
			}
		}
	});
}