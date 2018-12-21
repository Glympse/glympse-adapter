///////////////////////////////////////////////////////////////////////////////
// Image processing utilities
///////////////////////////////////////////////////////////////////////////////

define(function(require, exports, module)
{
	function getImageType(arrayBuffer)
	{
		var type = '';
		var dv = new DataView(arrayBuffer, 0, 5);
		var nume1 = dv.getUint8(0, true);
		var nume2 = dv.getUint8(1, true);
		var hex = nume1.toString(16) + nume2.toString(16);

		switch (hex)
		{
			case '8950':
			{
				type = 'image/png';
				break;
			}
			case '4749':
			{
				type = 'image/gif';
				break;
			}
			case '424d':
			{
				type = 'image/bmp';
				break;
			}
			case 'ffd8':
			{
				type = 'image/jpeg';
				break;
			}
			default:
			{
				type = null;
				break;
			}
		}
		return type;
	}

	var imageProcessing = {
		imageScale: function(imgData, config, callback)
		{
			//create a canvas
			this.imageInfo(imgData, gettingImageInfoCallback);

			function gettingImageInfoCallback(image)
			{
				var width = image.width;
				var height = image.height;

				var startX = 0, startY = 0,
					scaleX, scaleY,
					resultImageWidth, resultImageHeight;
				var persistRatio = config.maintainAspectRatio;

				var scaleSize = [width, height];

				if (scaleSize[0] >= scaleSize[1])
				{
					if (scaleSize[0] > config.maxSize[0])
					{
						scaleSize[0] = config.maxSize[0];
						scaleSize[1] = height * config.maxSize[0] / width;
					}

					if (scaleSize[0] < config.minSize[0])
					{
						scaleSize[0] = config.minSize[0];
						scaleSize[1] = height * config.minSize[0] / width;
					}
				}
				else {
					if (scaleSize[1] > config.maxSize[1])
					{
						scaleSize[0] = width * config.maxSize[1] / height;
						scaleSize[1] = config.maxSize[1];
					}
					if (scaleSize[1] < config.minSize[1])
					{
						scaleSize[0] = width * config.minSize[1] / height;
						scaleSize[1] = config.minSize[1];
					}
				}

				//we need to get square image
				if (scaleSize[0] !== scaleSize[1])
				{
					scaleSize[0] = Math.max(scaleSize[0], scaleSize[1]);
					scaleSize[1] = Math.max(scaleSize[0], scaleSize[1]);
				}

				var canvas = document.createElement('canvas');

				canvas.id = 'glympse-adapter-image-processing';

				canvas.width = scaleSize[0];
				canvas.height = scaleSize[1];

				//uncomment it for debugging
				//canvas.style = 'position:fixed; top:0; left:0';

				document.body.appendChild(canvas);

				var context = canvas.getContext('2d');
				//fill alpha with convertAlpha color
				context.fillStyle = config.convertAlpha || '#FFFFFF';
				context.fillRect(0, 0, canvas.width, canvas.height);

				scaleX = width / scaleSize[0];
				scaleY = height / scaleSize[1];

				if (persistRatio)
				{
					scaleX = Math.max(scaleX, scaleY);
					scaleY = Math.max(scaleX, scaleY);
				}

				resultImageWidth = width / scaleX;
				resultImageHeight = height / scaleY;
				startX = (canvas.width - resultImageWidth) / 2;
				startY = (canvas.height - resultImageHeight) / 2;

				//fill spaces during scale
				context.fillStyle = config.sidebandFill || '#FFFFFF';
				context.fillRect(0, 0, startX, canvas.height);
				context.fillRect(startX + resultImageWidth, 0, canvas.width, canvas.height);
				context.fillRect(0, 0, canvas.width, startY);
				context.fillRect(0, startY + resultImageHeight, canvas.width, canvas.height);

				context.drawImage(image.img, startX, startY, resultImageWidth, resultImageHeight);

				var dataURI = canvas.toDataURL('image/jpeg');

				var byteString = atob(dataURI.split(',')[1]);

				// write the bytes of the string to an ArrayBuffer
				var ab = new ArrayBuffer(byteString.length);
				var ia = new Uint8Array(ab);
				for (var i = 0; i < byteString.length; i++)
				{
					ia[i] = byteString.charCodeAt(i);
				}

				callback(ab);
				canvas.remove();
			}
		},
		imageInfo: function(imgData, callback)
		{
			var blob = new Blob([imgData], { type: 'image/jpeg' });

			var urlCreator = window.URL || window.webkitURL;
			var imageUrl = urlCreator.createObjectURL(blob);

			var img = new Image();
			img.src = imageUrl;

			img.onload = function()
			{
				callback({
					width: $(img).width(),
					height: $(img).height(),
					type: getImageType(imgData),
					img: img
				});
				img.remove();
			};

			img.onerror = function()
			{
				//cannot load image from array buffer
				img.remove();
			};

			document.body.appendChild(img);
		},

		loadDataArrayByUrl: function(url, callback)
		{
			var that = this;
			var xhr = new XMLHttpRequest();

			xhr.open('GET', url + "?x=y", true);
			xhr.responseType = 'arraybuffer';

			xhr.onload = function()
			{
				var arrayBuffer = xhr.response;
				if (arrayBuffer) {
					callback(arrayBuffer);
				}
			};

			xhr.onerror = function(error)
			{
				var result = {
					status: false,
					errorDetail: 'Could not load image by url',
					response: error
				};
				callback(null, result);
			};

			xhr.send(null);
		}
	};

	module.exports = imageProcessing;
});
