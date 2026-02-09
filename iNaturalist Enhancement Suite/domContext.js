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
const srcDescriptor = Object.getOwnPropertyDescriptor(Image.prototype, 'src');
Image.prototype.originalSrcSetter = srcDescriptor.set;

const newSetter = function(value) {
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
	const image = arguments[0];
	if (image) {
		this.canvas._filename = image._filename;
	}

	CanvasRenderingContext2D.prototype.drawImageOriginal.apply(this, arguments); 
};


// override HTMLCanvasElement.toBlob to create file with filename
HTMLCanvasElement.prototype.toBlobOriginal = HTMLCanvasElement.prototype.toBlob;
HTMLCanvasElement.prototype.toBlob = function() {
	const filename = this._filename;
	const originalCallback = arguments[0];
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
	const { taxon, requestId, isIdentifyPage } = event.detail;

	try {
		// On identify page, specifically target the IdentificationForm (not the SearchBar)
		const containerSelectors = isIdentifyPage
			? ['.IdentificationForm .TaxonAutocomplete']
			: ['.TaxonAutocomplete'];

		const inputSelectors = [
			'input.ui-autocomplete-input',
			'input[type="search"]',
			'input'
		];

		let container = null;
		let input = null;

		// Try each container selector
		for (const containerSel of containerSelectors) {
			container = document.querySelector(containerSel);
			console.log('[iNat Enhancement] Trying selector:', containerSel, 'found:', container);
			if (container) {
				// Try each input selector within this container
				for (const inputSel of inputSelectors) {
					input = container.querySelector(inputSel);
					if (input) break;
				}
				if (input) break;
			}
		}

		// Fallback if not found
		if (!input && isIdentifyPage) {
			const identifySelectors = [
				'.IdentificationForm input[type="search"]',
				'.IdentificationForm input'
			];

			for (const sel of identifySelectors) {
				input = document.querySelector(sel);
				if (input) {
					container = input.closest('.TaxonAutocomplete') || input.parentElement;
					break;
				}
			}
		}

		if (!container || !input) {
			// If not found immediately on identify page, poll for it to appear
			if (isIdentifyPage) {
				console.log('[iNat Enhancement] Input not found immediately, polling...');
				let pollAttempts = 0;
				const maxPollAttempts = 20;
				const pollInterval = setInterval(() => {
					pollAttempts++;

					// Re-try all the selectors
					for (const containerSel of containerSelectors) {
						container = document.querySelector(containerSel);
						if (container) {
							for (const inputSel of inputSelectors) {
								input = container.querySelector(inputSel);
								if (input) break;
							}
							if (input) break;
						}
					}

					if (!input) {
						const identifySelectors = [
							'.ObservationModal .TaxonAutocomplete input',
							'.SplitTaxonSelector input',
							'.identification input[type="text"]',
							'[class*="identification"] input[type="text"]'
						];
						for (const sel of identifySelectors) {
							input = document.querySelector(sel);
							if (input) {
								container = input.closest('.TaxonAutocomplete') || input.parentElement;
								break;
							}
						}
					}

					if (input) {
						clearInterval(pollInterval);
						console.log('[iNat Enhancement] Found input after polling:', input);
						performAutocomplete(input, container, taxon, requestId);
					} else if (pollAttempts >= maxPollAttempts) {
						clearInterval(pollInterval);
						console.error('[iNat Enhancement] Input not found after polling');
						console.error('[iNat Enhancement] Available elements:', document.querySelectorAll('[class*="TaxonAutocomplete"], [class*="identification"]'));
						document.dispatchEvent(new CustomEvent('selectTaxonResponse', {
							detail: { requestId, success: false, error: 'Could not find autocomplete input after waiting' }
						}));
					}
				}, 100);
				return;
			}

			console.error('[iNat Enhancement] Container:', container, 'Input:', input);
			console.error('[iNat Enhancement] Available TaxonAutocomplete elements:', document.querySelectorAll('[class*="TaxonAutocomplete"]'));
			throw new Error('Could not find autocomplete input');
		}

		performAutocomplete(input, container, taxon, requestId);

	} catch (error) {
		console.error('[iNat Enhancement] selectTaxon error:', error);
		document.dispatchEvent(new CustomEvent('selectTaxonResponse', {
			detail: { requestId, success: false, error: error.message }
		}));
	}
});

// Extracted autocomplete logic for reuse
function performAutocomplete(input, container, taxon, requestId) {
	try {
		const $input = $(input);

		console.log('[iNat Enhancement] performAutocomplete called');
		console.log('[iNat Enhancement] Input loading class:', input.classList.contains('ui-autocomplete-loading'));

		// Ensure taxon has title property
		if (!taxon.title) {
			taxon.title = taxon.preferred_common_name
				? `${taxon.preferred_common_name} · ${taxon.name}`
				: taxon.name;
		}

		// Wait for any existing autocomplete loading to finish
		function waitForReady() {
			return new Promise(resolve => {
				let checks = 0;
				const checkReady = setInterval(() => {
					checks++;
					const isLoading = input.classList.contains('ui-autocomplete-loading');
					if (!isLoading || checks > 20) {
						clearInterval(checkReady);
						console.log('[iNat Enhancement] Input ready after', checks, 'checks, loading:', isLoading);
						resolve();
					}
				}, 50);
			});
		}

		waitForReady().then(() => {
			// Focus input
			input.focus();
			input.click();
			console.log('[iNat Enhancement] After focus, activeElement:', document.activeElement === input);

			// Use native setter to bypass React
			const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
			nativeSetter.call(input, taxon.name);
			input.dispatchEvent(new Event('input', { bubbles: true }));
			console.log('[iNat Enhancement] Set value via native setter:', input.value);

			// Small delay then trigger search
			setTimeout(() => {
				console.log('[iNat Enhancement] Value before search:', input.value);
				$input.autocomplete('search', taxon.name);
				console.log('[iNat Enhancement] Triggered search for:', taxon.name);
				startMenuPolling();
			}, 100);
		});

		function startMenuPolling() {

		// Wait for dropdown to appear, then click the matching result
		let attempts = 0;
		const maxAttempts = 30;
		const checkInterval = setInterval(() => {
			attempts++;
			// Get the menu widget associated with this input (jQuery UI appends it to body)
			let menu;
			try {
				menu = $input.autocomplete('widget')[0];
			} catch (e) {
				console.log('[iNat Enhancement] Error getting widget:', e.message);
			}

			if (attempts === 1 || attempts === 10 || attempts === 20) {
				console.log('[iNat Enhancement] Attempt', attempts,
					'- menu:', menu?.id,
					'- children:', menu?.children.length,
					'- display:', menu?.style.display,
					'- input.value:', input.value);
			}

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
		} // end startMenuPolling

	} catch (error) {
		console.error('[iNat Enhancement] selectTaxon error:', error);
		document.dispatchEvent(new CustomEvent('selectTaxonResponse', {
			detail: { requestId, success: false, error: error.message }
		}));
	}
}

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