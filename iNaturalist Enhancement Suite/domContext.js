// override FileReader.readAsDataURL to include the original filename in the data URL 
FileReader.prototype.readAsDataURLOriginal = FileReader.prototype.readAsDataURL;
FileReader.prototype.readAsDataURL = function(file) { 
	const originalReader = this;
	if (!originalReader.onload) {
		FileReader.prototype.readAsDataURLOriginal.apply(this, arguments);
		return;
	}

	const filename = file.name;
	const reader = new FileReader();
	reader.onload = function() {
		const dataUrl = reader.result.replace(';base64,', `;name=${filename};base64,`);
		
		// TODO properly clone event
		originalReader.onload({ target: { result: dataUrl }});
	}

	FileReader.prototype.readAsDataURLOriginal.apply(reader, arguments);
}

// override Image.src setter to parse and store the filename from the data URL
var srcDescriptor = Object.getOwnPropertyDescriptor(Image.prototype, 'src');
Image.prototype.originalSrcSetter = srcDescriptor.set;

var newSetter = function(value) {
	const match = value.match(/;name=([^;]+);/);
	if (match) {
		this._filename = match[1];
	}

	Image.prototype.originalSrcSetter.apply(this, arguments);
}

srcDescriptor.set = newSetter;
Object.defineProperty(Image.prototype, 'src', srcDescriptor);

// override CanvasRenderingContext2D.drawImage to propagate image filename to canvas
CanvasRenderingContext2D.prototype.drawImageOriginal = CanvasRenderingContext2D.prototype.drawImage;
CanvasRenderingContext2D.prototype.drawImage = function() { 
	var image = arguments[0];
	if (image) {
		this.canvas._filename = image._filename;
	}

	CanvasRenderingContext2D.prototype.drawImageOriginal.apply(this, arguments); 
};


// override HTMLCanvasElement.toBlob to create file with filename
HTMLCanvasElement.prototype.toBlobOriginal = HTMLCanvasElement.prototype.toBlob;
HTMLCanvasElement.prototype.toBlob = function() {   
	const filename = this._filename;  
	var originalCallback = arguments[0];
	arguments[0] = function(blob) {
		originalCallback(new File([blob], filename));
	}
	
	HTMLCanvasElement.prototype.toBlobOriginal.apply(this, arguments); 
};

const oldFetch = window.fetch;
window.fetch = async (url, options) => {
    const response = await oldFetch(url, options);
	try {
		if (url.startsWith('https://api.inaturalist.org/v1/computervision')) {
			const data = await response.clone().json();
			if (data) {
				let filename = null;
				if (options) {
					const formData = options.body;
					if (formData) {
						const file = formData.get('image');
						if (file) {
							filename = file.name;
						}
					}
				}

				const payload = { 
					detail: {
						data,
						filename
					}
				};

				document.dispatchEvent(
					new CustomEvent('computerVisionResponse', payload)
				);
			}
		} else {
			const observationMatch = url.match(/^https:\/\/api.inaturalist.org\/v1\/observations\/\d+/i);
			if (observationMatch) {
				const data = await response.clone().json();
				if (data && data.results && data.results.length && data.results[0]) {
					const payload = { 
						detail: {
							location: data.results[0].location
						}
					};

					document.dispatchEvent(
						new CustomEvent('observationFetch', payload)
					);
				}
			}
		}
	} catch (err) {
		console.error(err);
	}
    
	return response;
};
