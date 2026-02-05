// POC: Cropper.js integration for iNaturalist observation images
// This adds a "Crop for CV" button to observation photos

(function() {
	'use strict';

	// Load Cropper.js CSS from extension bundle
	let cropperCssLoaded = false;
	function loadCropperCSS() {
		if (cropperCssLoaded) return;
		cropperCssLoaded = true;

		const css = document.createElement('link');
		css.rel = 'stylesheet';
		css.href = chrome.runtime.getURL('cropper.min.css');
		document.head.appendChild(css);
	}


	// Inject button styles when head is available
	function injectButtonStyles() {
		if (document.getElementById('inat-crop-button-styles')) return;

		const styles = document.createElement('style');
		styles.id = 'inat-crop-button-styles';
		styles.textContent = `
			.inat-crop-trigger-container {
				display: flex;
				justify-content: center;
				padding: 8px 0;
			}
			.inat-crop-trigger {
				background: #74ac00;
				color: white;
				border: none;
				padding: 8px 16px;
				border-radius: 4px;
				font-size: 13px;
				font-weight: 500;
				cursor: pointer;
				display: inline-flex;
				align-items: center;
				gap: 6px;
				transition: background 0.2s;
			}
			.inat-crop-trigger:hover {
				background: #5a8a00;
			}
			.inat-crop-trigger svg {
				width: 16px;
				height: 16px;
				fill: currentColor;
			}
		`;

		const target = document.head || document.documentElement;
		target.appendChild(styles);
	}

	// Create the crop modal UI
	function createCropModal() {
		const modal = document.createElement('div');
		modal.id = 'inat-crop-modal';
		modal.innerHTML = `
			<div class="inat-crop-overlay"></div>
			<div class="inat-crop-container">
				<div class="inat-crop-header">
					<h3>Crop Image for Computer Vision</h3>
					<button class="inat-crop-close">&times;</button>
				</div>
				<div class="inat-crop-body">
					<div class="inat-crop-loading">
						<div class="inat-crop-spinner"></div>
						<span>Loading image...</span>
					</div>
					<img id="inat-crop-image" src="" alt="Crop preview">
				</div>
				<div class="inat-crop-footer">
					<div class="inat-crop-instructions">
						Drag to reposition, scroll to zoom, drag corners to resize crop area
					</div>
					<div class="inat-crop-buttons">
						<button class="inat-crop-btn inat-crop-cancel">Cancel</button>
						<button class="inat-crop-btn inat-crop-submit">Get CV Suggestions</button>
					</div>
				</div>
				<div class="inat-crop-results" style="display:none;">
					<div class="inat-crop-results-header">
						<h4>Computer Vision Suggestions</h4>
						<span class="inat-crop-results-loading">Loading...</span>
					</div>
					<ul class="inat-crop-results-list"></ul>
				</div>
			</div>
		`;

		// Add styles
		const styles = document.createElement('style');
		styles.textContent = `
			#inat-crop-modal {
				display: none;
				position: fixed;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				z-index: 10000;
				font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
			}
			#inat-crop-modal.active {
				display: block;
			}
			.inat-crop-overlay {
				position: absolute;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				background: rgba(0, 0, 0, 0.8);
			}
			.inat-crop-container {
				position: absolute;
				top: 50%;
				left: 50%;
				transform: translate(-50%, -50%);
				background: #fff;
				border-radius: 8px;
				max-width: min(800px, 90vw);
				max-height: 90vh;
				overflow: hidden;
				display: flex;
				flex-direction: column;
			}
			.inat-crop-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				padding: 12px 16px;
				border-bottom: 1px solid #e0e0e0;
				background: #f5f5f5;
			}
			.inat-crop-header h3 {
				margin: 0;
				font-size: 16px;
				font-weight: 600;
			}
			.inat-crop-close {
				background: none;
				border: none;
				font-size: 24px;
				cursor: pointer;
				color: #666;
				padding: 0;
				line-height: 1;
			}
			.inat-crop-close:hover {
				color: #333;
			}
			.inat-crop-body {
				padding: 16px;
				max-height: 60vh;
				overflow: hidden;
				background: #1a1a1a;
			}
			#inat-crop-image {
				display: block;
				max-width: 100%;
				max-height: 55vh;
			}
			/* Override Cropper's checkerboard background */
			.inat-crop-body .cropper-bg {
				background-image: none;
				background-color: #1a1a1a;
			}
			#inat-crop-image.loading {
				visibility: hidden;
				position: absolute;
			}
			.inat-crop-loading {
				display: none;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				padding: 60px 40px;
				color: #666;
				gap: 12px;
			}
			.inat-crop-loading.active {
				display: flex;
			}
			.inat-crop-spinner {
				width: 32px;
				height: 32px;
				border: 3px solid #e0e0e0;
				border-top-color: #74ac00;
				border-radius: 50%;
				animation: inat-spin 0.8s linear infinite;
			}
			@keyframes inat-spin {
				to { transform: rotate(360deg); }
			}
			.inat-crop-footer {
				padding: 12px 16px;
				border-top: 1px solid #e0e0e0;
				background: #f5f5f5;
			}
			.inat-crop-instructions {
				font-size: 12px;
				color: #666;
				margin-bottom: 12px;
			}
			.inat-crop-buttons {
				display: flex;
				justify-content: flex-end;
				gap: 8px;
			}
			.inat-crop-btn {
				padding: 8px 16px;
				border-radius: 4px;
				font-size: 14px;
				cursor: pointer;
				border: 1px solid #ccc;
				background: #fff;
			}
			.inat-crop-btn:hover {
				background: #f0f0f0;
			}
			.inat-crop-submit {
				background: #74ac00;
				color: white;
				border-color: #74ac00;
			}
			.inat-crop-submit:hover {
				background: #5a8a00;
			}
			.inat-crop-result {
				padding: 16px;
				border-top: 1px solid #e0e0e0;
				text-align: center;
			}
			.inat-crop-result h4 {
				margin: 0 0 12px 0;
				font-size: 14px;
			}
			#inat-crop-result-image {
				max-width: 200px;
				max-height: 200px;
				border: 1px solid #ccc;
			}
			.inat-crop-results {
				border-top: 1px solid #e0e0e0;
				max-height: 200px;
				overflow-y: auto;
			}
			.inat-crop-results-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				padding: 8px 16px;
				background: #f5f5f5;
				position: sticky;
				top: 0;
			}
			.inat-crop-results-header h4 {
				margin: 0;
				font-size: 14px;
				font-weight: 600;
			}
			.inat-crop-results-loading {
				font-size: 12px;
				color: #666;
			}
			.inat-crop-results-list {
				list-style: none;
				margin: 0;
				padding: 0;
			}
			.inat-crop-results-list li {
				display: flex;
				align-items: center;
				padding: 8px 16px;
				border-bottom: 1px solid #eee;
				gap: 12px;
			}
			.inat-crop-results-list li:last-child {
				border-bottom: none;
			}
			.inat-crop-results-list li.selectable {
				cursor: pointer;
			}
			.inat-crop-results-list li.selectable:hover {
				background-color: #f0f7e6;
			}
			.inat-crop-results-list .result-photo {
				width: 40px;
				height: 40px;
				border-radius: 4px;
				object-fit: cover;
				flex-shrink: 0;
			}
			.inat-crop-results-list .result-info {
				flex: 1;
				min-width: 0;
			}
			.inat-crop-results-list .result-name {
				font-weight: 500;
				font-size: 14px;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}
			.inat-crop-results-list .result-name em {
				font-style: italic;
			}
			.inat-crop-results-list .result-common {
				font-size: 12px;
				color: #666;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}
			.inat-crop-results-list .result-score {
				font-size: 12px;
				font-weight: 600;
				padding: 2px 8px;
				border-radius: 10px;
				background: #e8f5e9;
				color: #2e7d32;
				flex-shrink: 0;
			}
			.inat-crop-results-list a {
				color: inherit;
				text-decoration: none;
			}
			.inat-crop-results-list a:hover .result-name {
				text-decoration: underline;
			}
		`;
		document.head.appendChild(styles);
		document.body.appendChild(modal);
		return modal;
	}

	let modal = null;
	let cropper = null;

	function openCropModal(imageUrl) {
		if (!modal) {
			modal = createCropModal();

			// Event listeners
			modal.querySelector('.inat-crop-close').addEventListener('click', closeCropModal);
			modal.querySelector('.inat-crop-cancel').addEventListener('click', closeCropModal);
			modal.querySelector('.inat-crop-overlay').addEventListener('click', closeCropModal);
			modal.querySelector('.inat-crop-submit').addEventListener('click', handleCrop);
		}

		const cropImage = modal.querySelector('#inat-crop-image');
		const loadingEl = modal.querySelector('.inat-crop-loading');

		// Reset results area
		modal.querySelector('.inat-crop-results').style.display = 'none';

		// Show loading state
		loadingEl.classList.add('active');
		cropImage.classList.add('loading');

		// Destroy existing cropper
		if (cropper) {
			cropper.destroy();
			cropper = null;
		}

		// Show modal immediately
		modal.classList.add('active');

		// Initialize cropper when image is ready
		function initCropper() {
			loadingEl.classList.remove('active');
			cropImage.classList.remove('loading');

			cropper = new Cropper(cropImage, {
				viewMode: 1,
				dragMode: 'move',
				aspectRatio: NaN, // Free aspect ratio
				autoCropArea: 0.8,
				restore: false,
				guides: true,
				center: true,
				highlight: false,
				cropBoxMovable: true,
				cropBoxResizable: true,
				toggleDragModeOnDblclick: false,
				// Prevent Cropper from re-fetching (we're using a data URL)
				checkCrossOrigin: false,
				checkOrientation: false,
			});
		}

		// Fetch image via background script (bypasses CORS)
		fetchImageViaBackground(imageUrl)
			.then(dataUrl => {
				cropImage.onload = initCropper;
				cropImage.src = dataUrl;
			})
			.catch(error => {
				console.error('Failed to fetch image:', error);
				loadingEl.classList.remove('active');
				alert('Failed to load image: ' + error.message);
				closeCropModal();
			});
	}

	function closeCropModal() {
		if (modal) {
			modal.classList.remove('active');
		}
		if (cropper) {
			cropper.destroy();
			cropper = null;
		}
	}

	// Apply the selected identification to the suggestion input
	function applyIdentification(scientificName) {
		console.log('[iNat Enhancement] Attempting to apply identification:', scientificName);

		// Find and click the "Suggest an Identification" tab
		const tabSelectors = [
			'a[href="#activity_suggest_tab"]',
			'[role="tab"][aria-controls*="suggest"]',
			'.ActivityCreatePanel .nav-tabs li:nth-child(2) a',
			'.nav-tabs a'
		];

		let idTab = null;
		for (const selector of tabSelectors) {
			try {
				const tabs = document.querySelectorAll(selector);
				for (const tab of tabs) {
					if (tab.textContent.includes('Suggest')) {
						idTab = tab;
						break;
					}
				}
				if (idTab) break;
			} catch (e) {
				console.warn('[iNat Enhancement] Invalid selector:', selector);
			}
		}

		console.log('[iNat Enhancement] Found tab:', idTab);

		if (idTab) {
			idTab.click();
			console.log('[iNat Enhancement] Clicked tab');
		}

		// Wait a bit for tab content to render, then find input
		setTimeout(() => {
			// Find the identification input
			const inputSelectors = [
				'.IdentificationForm input[type="text"]',
				'.TaxonAutocomplete input[type="text"]',
				'input[placeholder*="Species"]',
				'input[placeholder*="species"]',
				'.ActiveTab input[type="text"]',
				'#activity_suggest_tab input[type="text"]',
				'.tab-pane.active input[type="text"]'
			];

			let input = null;
			for (const selector of inputSelectors) {
				input = document.querySelector(selector);
				console.log('[iNat Enhancement] Trying selector:', selector, '-> found:', input);
				if (input) break;
			}

			if (!input) {
				console.warn('[iNat Enhancement] Could not find identification input');
				alert('Could not find identification input. Please manually enter: ' + scientificName);
				return;
			}

			// Scroll to and focus the input
			input.scrollIntoView({ behavior: 'smooth', block: 'center' });

			// Set the value and trigger input events
			input.focus();
			input.value = scientificName;

			// Trigger events to notify React/jQuery of the change
			input.dispatchEvent(new Event('input', { bubbles: true }));
			input.dispatchEvent(new Event('change', { bubbles: true }));
			input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
			input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

			console.log('[iNat Enhancement] Applied identification:', scientificName);
		}, 200);
	}

	function handleCrop() {
		if (!cropper) return;

		// Get cropped canvas
		const canvas = cropper.getCroppedCanvas({
			maxWidth: 1024,
			maxHeight: 1024,
			imageSmoothingEnabled: true,
			imageSmoothingQuality: 'high',
		});

		if (!canvas) {
			alert('Failed to crop image');
			return;
		}

		const resultsArea = modal.querySelector('.inat-crop-results');
		const resultsLoading = modal.querySelector('.inat-crop-results-loading');
		const resultsList = modal.querySelector('.inat-crop-results-list');

		// Show results area with loading state
		resultsArea.style.display = 'block';
		resultsLoading.textContent = 'Loading...';
		resultsList.innerHTML = '';

		// Get observation metadata
		const metadata = getObservationMetadata();
		console.log('Observation metadata:', metadata);

		// Convert canvas to data URL and call API via background script
		const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);

		(async function() {
			try {
				console.log('Calling score_image API...');
				const data = await callScoreImageAPI(imageDataUrl, metadata);
				console.log('CV results:', data);

				resultsLoading.textContent = '';
				displayCVResults(data, resultsList);
			} catch (error) {
				console.error('score_image API error:', error);
				resultsLoading.textContent = 'Error: ' + error.message;
			}
		})();
	}

	// Display CV results in the list
	function displayCVResults(data, listEl) {
		if (!data.results || data.results.length === 0) {
			listEl.innerHTML = '<li>No suggestions found</li>';
			return;
		}

		// Show top 10 results
		const results = data.results.slice(0, 10);

		listEl.innerHTML = results.map(result => {
			const taxon = result.taxon;
			const score = result.combined_score;
			const photoUrl = taxon.default_photo?.square_url || '';
			const scientificName = taxon.name || 'Unknown';
			const commonName = taxon.preferred_common_name || '';

			return `
				<li data-score="${score}" data-scientific-name="${scientificName}" class="selectable">
					${photoUrl ? `<img class="result-photo" src="${photoUrl}" alt="">` : ''}
					<div class="result-info">
						<div class="result-name"><em>${scientificName}</em></div>
						${commonName ? `<div class="result-common">${commonName}</div>` : ''}
					</div>
					<span class="result-score">${score.toFixed(1)}%</span>
				</li>
			`;
		}).join('');

		// Add click handlers to select a result
		listEl.querySelectorAll('li.selectable').forEach(li => {
			li.addEventListener('click', () => {
				const scientificName = li.dataset.scientificName;
				closeCropModal();
				// Wait for modal to close before interacting with page elements
				setTimeout(() => applyIdentification(scientificName), 100);
			});
		});

		// Apply color vision coloring based on user settings
		chrome.storage.sync.get({
			enableColorVision: true,
			colorDisplayMode: 'sidebar',
			enableColorBlindMode: false
		}, function(items) {
			if (!items.enableColorVision) return;

			listEl.querySelectorAll('li[data-score]').forEach(li => {
				const score = parseFloat(li.dataset.score);
				let hue = score * 1.2;

				if (items.enableColorBlindMode) {
					hue = hue * -1 + 240;
				}

				if (items.colorDisplayMode === 'gradient') {
					li.style.background = `linear-gradient(to right, hsl(${hue},50%,50%), white 90%)`;
				} else {
					li.style.borderLeft = `7px solid hsl(${hue},50%,50%)`;
				}
			});
		});

		// Also show common ancestor if available
		if (data.common_ancestor) {
			const ancestor = data.common_ancestor.taxon;
			const ancestorUrl = `https://www.inaturalist.org/taxa/${ancestor.id}`;
			const ancestorName = ancestor.preferred_common_name || ancestor.name;

			const headerEl = modal.querySelector('.inat-crop-results-header h4');
			headerEl.innerHTML = `CV Suggestions <small style="font-weight:normal;color:#666;">(common ancestor: <a href="${ancestorUrl}" target="_blank">${ancestorName}</a>)</small>`;
		}
	}

	// Get observation metadata from the page
	function getObservationMetadata() {
		const metadata = {
			lat: null,
			lng: null,
			observed_on: null
		};

		// Try to get coordinates from the map details
		const latEl = document.querySelector('.MapDetails .lat_lng .lat');
		const lngEl = document.querySelector('.MapDetails .lat_lng .lng');
		if (latEl && lngEl) {
			metadata.lat = latEl.textContent.trim();
			metadata.lng = lngEl.textContent.trim();
		}

		// Fallback: try to parse from the location string in the details
		if (!metadata.lat) {
			const locationValue = document.querySelector('.MapDetails .value');
			if (locationValue) {
				const match = locationValue.textContent.match(/([-\d.]+),\s*([-\d.]+)/);
				if (match) {
					metadata.lat = match[1];
					metadata.lng = match[2];
				}
			}
		}

		// Try to get the observation date from time element's datetime attribute
		const timeEl = document.querySelector('time[datetime]');
		if (timeEl) {
			const datetime = timeEl.getAttribute('datetime');
			if (datetime) {
				metadata.observed_on = datetime;
			}
		}

		// Fallback: try to get from the observed_on span in observation details
		if (!metadata.observed_on) {
			const observedSpan = document.querySelector('.observed_on .date');
			if (observedSpan) {
				metadata.observed_on = observedSpan.textContent.trim();
			}
		}

		// Validate observed_on - should look like a date, not garbage
		if (metadata.observed_on && !/^\d{4}|^\w{3}\s|^\d{1,2}[\/-]/.test(metadata.observed_on)) {
			console.warn('Invalid observed_on value, ignoring:', metadata.observed_on);
			metadata.observed_on = null;
		}

		return metadata;
	}

	// Call the score_image API via page context (has correct Origin)
	function callScoreImageAPI(imageDataUrl, metadata) {
		return new Promise((resolve, reject) => {
			const requestId = Math.random().toString(36).substring(2);

			// Listen for response
			function handleResponse(event) {
				if (event.detail.requestId !== requestId) return;
				document.removeEventListener('scoreImageResponse', handleResponse);

				if (event.detail.success) {
					resolve(event.detail.data);
				} else {
					reject(new Error(event.detail.error));
				}
			}
			document.addEventListener('scoreImageResponse', handleResponse);

			// Send request to page context (domContext.js)
			document.dispatchEvent(new CustomEvent('scoreImageRequest', {
				detail: { imageDataUrl, metadata, requestId }
			}));
		});
	}

	// Get the current photo URL from the visible image in the gallery
	// Returns the original (highest resolution) version
	function getCurrentPhotoUrl() {
		// Try multiple selectors for different page layouts
		const selectors = [
			'.image-gallery-slide.center img',           // Main gallery current slide
			'.image-gallery-slide img',                   // Fallback gallery
			'.PhotoBrowser img',                          // Photo browser
			'.ObservationPhoto img',                      // Observation photo
			'.photo-container img'                        // Photo container
		];

		for (const selector of selectors) {
			const img = document.querySelector(selector);
			if (img && img.src) {
				// Convert to original.jpg for highest resolution
				return img.src.replace(/\/(square|small|medium|large)\./, '/original.');
			}
		}
		return null;
	}

	// Cache for prefetched images (URL -> data URL)
	const imageCache = new Map();
	const pendingFetches = new Map();

	// Fetch image via background script (bypasses CORS)
	function fetchImageViaBackground(url) {
		// Return cached image if available
		if (imageCache.has(url)) {
			return Promise.resolve(imageCache.get(url));
		}

		// Return pending fetch if already in progress
		if (pendingFetches.has(url)) {
			return pendingFetches.get(url);
		}

		const promise = new Promise((resolve, reject) => {
			chrome.runtime.sendMessage({ action: 'fetchImage', url }, response => {
				pendingFetches.delete(url);
				if (chrome.runtime.lastError) {
					reject(new Error(chrome.runtime.lastError.message));
				} else if (response.success) {
					imageCache.set(url, response.dataUrl);
					resolve(response.dataUrl);
				} else {
					reject(new Error(response.error));
				}
			});
		});

		pendingFetches.set(url, promise);
		return promise;
	}

	// Get all gallery image URLs (as original.jpg)
	function getGalleryImageUrls() {
		const urls = [];
		const images = document.querySelectorAll('.image-gallery-thumbnail img, .image-gallery-slide img');
		const seen = new Set();

		images.forEach(img => {
			if (img.src) {
				const originalUrl = img.src.replace(/\/(square|small|medium|large)\./, '/original.');
				if (!seen.has(originalUrl)) {
					seen.add(originalUrl);
					urls.push(originalUrl);
				}
			}
		});

		return urls;
	}

	// Prefetch all gallery images in order
	let prefetchStarted = false;
	function prefetchGalleryImages() {
		if (prefetchStarted) return;
		prefetchStarted = true;

		const urls = getGalleryImageUrls();
		console.log(`Prefetching ${urls.length} gallery images...`);

		// Fetch sequentially to avoid overwhelming the network
		urls.reduce((chain, url) => {
			return chain.then(() => {
				if (!imageCache.has(url)) {
					return fetchImageViaBackground(url).catch(err => {
						console.warn('Failed to prefetch:', url, err);
					});
				}
			});
		}, Promise.resolve());
	}

	// Create and add the crop button to a stable location
	function addCropButton() {
		// Inject styles first
		injectButtonStyles();

		// Don't add if already exists
		if (document.querySelector('.inat-crop-trigger-container')) return;

		// Find a stable container - the photo browser or gallery wrapper
		const targetSelectors = [
			'.image-gallery',                    // Image gallery wrapper
			'.PhotoBrowser',                     // Photo browser
			'.ObservationMedia'                  // Observation media section
		];

		let targetContainer = null;
		for (const selector of targetSelectors) {
			targetContainer = document.querySelector(selector);
			if (targetContainer) break;
		}

		if (!targetContainer) {
			console.log('Crop POC: No suitable container found');
			return;
		}

		// Create button container
		const container = document.createElement('div');
		container.className = 'inat-crop-trigger-container';

		const button = document.createElement('button');
		button.className = 'inat-crop-trigger';
		button.innerHTML = `
			<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
				<path d="M17 15h2V7c0-1.1-.9-2-2-2H9v2h8v8zM7 17V1H5v4H1v2h4v10c0 1.1.9 2 2 2h10v4h2v-4h4v-2H7z"/>
			</svg>
			Crop for CV
		`;

		button.addEventListener('click', function(e) {
			e.preventDefault();
			e.stopPropagation();

			const imageUrl = getCurrentPhotoUrl();
			if (!imageUrl) {
				alert('Could not find photo to crop');
				return;
			}

			loadCropperCSS();
			openCropModal(imageUrl);
		});

		container.appendChild(button);

		// Insert after the target container
		targetContainer.parentNode.insertBefore(container, targetContainer.nextSibling);

		console.log('Crop button added');
	}

	// Watch for the photo gallery to appear
	function init() {
		// Wait for the gallery/photo elements to load, then add our button
		const selectors = ['.image-gallery', '.PhotoBrowser', '.ObservationMedia'];

		for (const selector of selectors) {
			document.arrive(selector, { existing: true }, function() {
				// Small delay to ensure the gallery is fully rendered
				setTimeout(() => {
					addCropButton();
					prefetchGalleryImages();
				}, 100);
			});
		}

		console.log('iNaturalist Crop POC initialized');
	}

	// Start when DOM is ready
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
