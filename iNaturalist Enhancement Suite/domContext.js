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

// Get the iNaturalist API token from the page
function getApiToken() {
	const metaToken = document.querySelector('meta[name="inaturalist-api-token"]');
	if (metaToken && metaToken.content) {
		console.log('[iNat Enhancement Suite] Found API token in meta tag');
		return metaToken.content;
	}

	console.log('[iNat Enhancement Suite] No API token found - user may not be logged in');
	return null;
}

// Listen for score_image requests from content script
document.addEventListener('scoreImageRequest', async (event) => {
	const { imageDataUrl, metadata, requestId } = event.detail;

	try {
		const apiToken = getApiToken();
		if (!apiToken) {
			throw new Error('Not logged in - please log in to iNaturalist to use CV suggestions');
		}

		// Convert data URL to blob
		const response = await fetch(imageDataUrl);
		const blob = await response.blob();

		const formData = new FormData();
		formData.append('image', blob, 'cropped.jpg');
		formData.append('include_representative_photos', 'true');

		if (metadata.lat && metadata.lng) {
			formData.append('lat', metadata.lat);
			formData.append('lng', metadata.lng);
		}
		if (metadata.observed_on) {
			formData.append('observed_on', metadata.observed_on);
		}

		const apiResponse = await fetch('https://api.inaturalist.org/v1/computervision/score_image', {
			method: 'POST',
			headers: {
				'Accept': 'application/json',
				'Authorization': apiToken,
				'X-Via': 'iNaturalist-Enhancement-Suite'
			},
			body: formData
		});

		if (!apiResponse.ok) {
			throw new Error(`API error: ${apiResponse.status}`);
		}

		const data = await apiResponse.json();

		document.dispatchEvent(new CustomEvent('scoreImageResponse', {
			detail: { requestId, success: true, data }
		}));
	} catch (error) {
		document.dispatchEvent(new CustomEvent('scoreImageResponse', {
			detail: { requestId, success: false, error: error.message }
		}));
	}
});

// Listen for taxon selection requests from content script
document.addEventListener('selectTaxonRequest', (event) => {
	const { taxon, requestId } = event.detail;

	try {
		const container = document.querySelector('.TaxonAutocomplete');
		const input = container?.querySelector('input.ui-autocomplete-input');

		if (!container || !input) {
			throw new Error('Could not find autocomplete input');
		}

		const $input = $(input);

		// Ensure taxon has title property
		if (!taxon.title) {
			taxon.title = taxon.preferred_common_name
				? `${taxon.preferred_common_name} · ${taxon.name}`
				: taxon.name;
		}

		// Focus input and set its value to trigger autocomplete search
		input.focus();
		$input.val(taxon.name);

		// Trigger the autocomplete search
		$input.autocomplete('search', taxon.name);

		// Wait for dropdown to appear, then click the matching result
		let attempts = 0;
		const maxAttempts = 30;
		const checkInterval = setInterval(() => {
			attempts++;
			const menu = container.querySelector('.ui-autocomplete');

			if (menu && menu.children.length > 0 && menu.style.display !== 'none') {
				clearInterval(checkInterval);

				// Small delay to let the menu fully render
				setTimeout(() => {
					const results = menu.querySelectorAll('.ac-result');

					let targetResult = results[0]; // Default to first
					for (const result of results) {
						if (result.dataset.taxonId == taxon.id) {
							targetResult = result;
							break;
						}
					}

					if (!targetResult) {
						targetResult = menu.querySelector('li');
					}

					if (targetResult) {
						// Simulate proper mouse events
						targetResult.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
						targetResult.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
						targetResult.dispatchEvent(new MouseEvent('click', { bubbles: true }));
					}

					// Force close the dropdown and update thumbnail
					setTimeout(() => {
						$input.autocomplete('close');
						$(menu).hide();
						input.blur();

						// Update the thumbnail - it's a div with background-image, not an img tag
						const thumbDiv = container.querySelector('.ac-select-thumb');
						if (thumbDiv && taxon.default_photo?.square_url) {
							thumbDiv.style.backgroundImage = `url("${taxon.default_photo.square_url}")`;
						}

						// Scroll the container into view
						container.scrollIntoView({ behavior: 'smooth', block: 'center' });
					}, 100);

					document.dispatchEvent(new CustomEvent('selectTaxonResponse', {
						detail: { requestId, success: true }
					}));
				}, 100);
			}

			if (attempts >= maxAttempts) {
				clearInterval(checkInterval);
				console.warn('[iNat Enhancement] Autocomplete dropdown did not appear');
				document.dispatchEvent(new CustomEvent('selectTaxonResponse', {
					detail: { requestId, success: false, error: 'Autocomplete dropdown did not appear' }
				}));
			}
		}, 100);

	} catch (error) {
		console.error('[iNat Enhancement] selectTaxon error:', error);
		document.dispatchEvent(new CustomEvent('selectTaxonResponse', {
			detail: { requestId, success: false, error: error.message }
		}));
	}
});

const oldFetch = window.fetch;
window.fetch = async (url, options) => {
    const response = await oldFetch(url, options);
	try {
		if (url.match(/^https:\/\/api.inaturalist.org\/v\d+\/computervision/i)) {
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
			const observationMatch = url.match(/^https:\/\/api.inaturalist.org\/v\d+\/observations\/\d+/i);
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