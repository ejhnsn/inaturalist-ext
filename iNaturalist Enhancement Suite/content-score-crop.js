// Score Image and Crop for CV functionality
// Adds buttons to observation photos for getting computer vision suggestions

chrome.storage.sync.get({
	enableScoreImageTools: true
}, function(items) {
	if (!items.enableScoreImageTools) {
		return;
	}

	// Use shared logging from logging.js
	const log = window.iNatLog || console.log;
	const logError = window.iNatLogError || console.error;
	const logWarn = window.iNatLogWarn || console.warn;

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
				gap: 8px;
				padding: 8px 0;
				position: relative;
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
			/* Floating results panel for Score Image */
			.inat-score-results {
				position: absolute;
				top: 100%;
				left: 50%;
				transform: translateX(-50%);
				background: #fff;
				border-radius: 8px;
				width: 500px;
				max-height: 70vh;
				overflow-y: auto;
				box-shadow: 0 4px 20px rgba(0,0,0,0.25);
				z-index: 10000;
				display: none;
			}
			.inat-score-results.visible {
				display: block;
			}
			.inat-score-results-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				padding: 12px 16px;
				background: #f5f5f5;
				border-bottom: 1px solid #e0e0e0;
				font-weight: 600;
				font-size: 14px;
				position: sticky;
				top: 0;
				z-index: 1;
			}
			.inat-score-results-close {
				background: none;
				border: none;
				font-size: 20px;
				cursor: pointer;
				color: #666;
				padding: 0;
				line-height: 1;
			}
			.inat-score-results-close:hover {
				color: #333;
			}
			.inat-score-results-loading {
				font-size: 12px;
				color: #666;
				padding: 12px 16px;
			}
			/* Shared results list styles */
			.inat-crop-results-list {
				list-style: none;
				margin: 0;
				padding: 0;
			}
			.inat-crop-results-list .section-header {
				padding: 8px 16px;
				background: #f0f0f0;
				font-size: 13px;
				color: #333;
				border-bottom: 1px solid #e0e0e0;
			}
			.inat-crop-results-list li.result-item {
				display: flex;
				align-items: center;
				padding: 8px 12px;
				border-bottom: 1px solid #eee;
				gap: 8px;
				cursor: pointer;
				min-height: 64px;
				box-sizing: border-box;
			}
			.inat-crop-results-list li.result-item:hover {
				background-color: #f5f5f5;
			}
			.inat-crop-results-list .result-border {
				width: 6px;
				align-self: stretch;
				flex-shrink: 0;
				border-radius: 3px;
			}
			.inat-crop-results-list .result-photo {
				width: 48px;
				height: 48px;
				border-radius: 4px;
				object-fit: cover;
				flex-shrink: 0;
				background: #e0e0e0;
			}
			.inat-crop-results-list .result-info {
				flex: 1;
				min-width: 0;
				overflow: hidden;
			}
			.inat-crop-results-list .result-name {
				font-weight: 600;
				font-size: 14px;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}
			.inat-crop-results-list .result-rank {
				font-size: 12px;
				color: #666;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}
			.inat-crop-results-list .result-rank em {
				font-style: italic;
			}
			.inat-crop-results-list .result-tags {
				font-size: 11px;
				color: #74ac00;
				margin-top: 2px;
			}
			/* Gradient mode: black text for readability */
			.inat-crop-results-list.gradient-mode .result-name,
			.inat-crop-results-list.gradient-mode .result-rank,
			.inat-crop-results-list.gradient-mode .result-tags {
				color: #000;
			}
			.inat-crop-results-list .result-score {
				font-size: 11px;
				font-weight: 600;
				padding: 2px 8px;
				border-radius: 10px;
				background: #74ac00;
				color: white;
				flex-shrink: 0;
				margin-right: 8px;
			}
			.inat-crop-results-list .view-link {
				color: #333;
				font-size: 13px;
				text-decoration: none;
				flex-shrink: 0;
				padding: 4px 8px;
			}
			.inat-crop-results-list .view-link:hover {
				text-decoration: underline;
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
			<div class="inat-crop-wrapper">
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
				</div>
				<div class="inat-crop-results">
					<div class="inat-crop-results-header">
						<span>CV Suggestions</span>
						<button class="inat-crop-results-close">&times;</button>
					</div>
					<div class="inat-crop-results-loading">Loading suggestions...</div>
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
			.inat-crop-wrapper {
				position: absolute;
				top: 50%;
				left: 50%;
				transform: translate(calc(-50% - 256px), -50%);
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
				position: relative;
				background: #fff;
				border-radius: 8px;
				width: min(700px, 80vw);
				max-height: 85vh;
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
				position: absolute;
				top: 0;
				left: 100%;
				margin-left: 12px;
				background: #fff;
				border-radius: 8px;
				width: 500px;
				max-height: 85vh;
				overflow-y: auto;
				box-shadow: 0 4px 20px rgba(0,0,0,0.15);
				visibility: hidden;
			}
			.inat-crop-results.visible {
				visibility: visible;
			}
			.inat-crop-results-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				padding: 12px 16px;
				background: #f5f5f5;
				border-bottom: 1px solid #e0e0e0;
				font-weight: 600;
				font-size: 14px;
				position: sticky;
				top: 0;
				z-index: 1;
			}
			.inat-crop-results-close {
				background: none;
				border: none;
				font-size: 20px;
				cursor: pointer;
				color: #666;
				padding: 0;
				line-height: 1;
			}
			.inat-crop-results-close:hover {
				color: #333;
			}
			.inat-crop-results-loading {
				font-size: 12px;
				color: #666;
				padding: 12px 16px;
			}
		`;
		document.head.appendChild(styles);
		document.body.appendChild(modal);
		return modal;
	}

	let modal = null;
	let cropper = null;
	let cvResultsCache = null; // Cache for CV results, invalidated on crop change
	let modalInitialized = false;
	const scoreResultsCache = new Map(); // Cache CV results by image URL
	let scoreResultsVisible = false;

	// Ensure modal exists and event listeners are set up
	function ensureModalExists() {
		if (!modal) {
			modal = createCropModal();
		}

		if (!modalInitialized) {
			modalInitialized = true;

			// Event listeners
			modal.querySelector('.inat-crop-close').addEventListener('click', closeCropModal);
			modal.querySelector('.inat-crop-cancel').addEventListener('click', closeCropModal);
			modal.querySelector('.inat-crop-overlay').addEventListener('click', closeCropModal);
			modal.querySelector('.inat-crop-submit').addEventListener('click', handleCrop);
			modal.querySelector('.inat-crop-results-close').addEventListener('click', () => {
				modal.querySelector('.inat-crop-results').classList.remove('visible');
			});

			// Handle Escape key
			document.addEventListener('keydown', (e) => {
				if (e.key === 'Escape') {
					// First check standalone score results panel
					if (scoreResultsVisible) {
						closeScoreResults();
						return;
					}
					// Then check modal
					if (modal.classList.contains('active')) {
						const resultsEl = modal.querySelector('.inat-crop-results');
						if (resultsEl.classList.contains('visible')) {
							resultsEl.classList.remove('visible');
						} else {
							closeCropModal();
						}
					}
				}
			});
		}

		return modal;
	}

	function openCropModal(imageUrl) {
		ensureModalExists();

		const cropImage = modal.querySelector('#inat-crop-image');
		const loadingEl = modal.querySelector('.inat-crop-loading');

		// Reset results area
		const resultsEl = modal.querySelector('.inat-crop-results');
		resultsEl.classList.remove('visible');
		resultsEl.querySelector('.inat-crop-results-list').innerHTML = '';

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
				// Invalidate CV cache when crop area changes
				cropend: function() {
					cvResultsCache = null;
					log('Crop changed, cache invalidated');
				}
			});
		}

		// Fetch image via background script (bypasses CORS)
		fetchImageViaBackground(imageUrl)
			.then(dataUrl => {
				cropImage.onload = initCropper;
				cropImage.src = dataUrl;
			})
			.catch(error => {
				logError('Failed to fetch image:', error);
				loadingEl.classList.remove('active');
				alert('Failed to load image: ' + error.message);
				closeCropModal();
			});
	}

	function closeCropModal() {
		if (modal) {
			modal.classList.remove('active');
		}
		// Clear the CV results cache
		cvResultsCache = null;
		if (cropper) {
			cropper.destroy();
			cropper = null;
		}
	}

	// Standalone results panel for Score Image (separate from modal)
	let scoreResultsPanel = null;

	function createScoreResultsPanel() {
		const panel = document.createElement('div');
		panel.id = 'inat-score-results-panel';
		panel.innerHTML = `
			<div class="inat-score-results-header">
				<span>CV Suggestions</span>
				<button class="inat-score-results-close">&times;</button>
			</div>
			<div class="inat-score-results-loading">Loading suggestions...</div>
			<ul class="inat-crop-results-list"></ul>
		`;

		// Add styles for the standalone panel
		const style = document.createElement('style');
		style.textContent = `
			#inat-score-results-panel {
				position: fixed;
				background: #fff;
				border-radius: 8px;
				width: 500px;
				max-height: 70vh;
				overflow-y: auto;
				box-shadow: 0 4px 20px rgba(0,0,0,0.25);
				z-index: 10001;
				display: none;
			}
			#inat-score-results-panel.visible {
				display: block;
			}
			#inat-score-results-panel .inat-score-results-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				padding: 12px 16px;
				background: #f5f5f5;
				border-bottom: 1px solid #e0e0e0;
				font-weight: 600;
				font-size: 14px;
				position: sticky;
				top: 0;
				z-index: 1;
			}
			#inat-score-results-panel .inat-score-results-close {
				background: none;
				border: none;
				font-size: 20px;
				cursor: pointer;
				color: #666;
				padding: 0;
				line-height: 1;
			}
			#inat-score-results-panel .inat-score-results-close:hover {
				color: #333;
			}
			#inat-score-results-panel .inat-score-results-loading {
				font-size: 12px;
				color: #666;
				padding: 12px 16px;
			}
		`;
		document.head.appendChild(style);

		panel.querySelector('.inat-score-results-close').addEventListener('click', closeScoreResults);

		document.body.appendChild(panel);
		return panel;
	}

	// Score an image without cropping
	async function scoreCurrentImage(imageUrl, buttonContainer) {
		// Create standalone panel if needed
		if (!scoreResultsPanel) {
			scoreResultsPanel = createScoreResultsPanel();
		}

		const loadingEl = scoreResultsPanel.querySelector('.inat-score-results-loading');
		const resultsList = scoreResultsPanel.querySelector('.inat-crop-results-list');

		// Position the panel just to the right of the image container
		const containerRect = buttonContainer.getBoundingClientRect();
		scoreResultsPanel.style.top = '150px';
		scoreResultsPanel.style.left = (containerRect.right + 20) + 'px';
		scoreResultsPanel.style.right = 'auto';

		// Show the panel
		scoreResultsPanel.classList.add('visible');
		scoreResultsVisible = true;

		// Check cache for this image URL
		if (scoreResultsCache.has(imageUrl)) {
			log('Using cached score results for', imageUrl);
			loadingEl.style.display = 'none';
			displayCVResults(scoreResultsCache.get(imageUrl), resultsList, closeScoreResults);
			return;
		}

		// Show loading state
		loadingEl.textContent = 'Loading suggestions...';
		loadingEl.style.display = 'block';
		resultsList.innerHTML = '';

		try {
			// Fetch image via background script
			const imageDataUrl = await fetchImageViaBackground(imageUrl);

			// Get observation metadata
			const metadata = getObservationMetadata();

			// Call score_image API
			const data = await callScoreImageAPI(imageDataUrl, metadata);
			log('Score results:', data);

			// Cache the results by image URL
			scoreResultsCache.set(imageUrl, data);

			loadingEl.style.display = 'none';
			displayCVResults(data, resultsList, closeScoreResults);
		} catch (error) {
			logError('Score image error:', error);
			loadingEl.textContent = 'Error: ' + error.message;
		}
	}

	function closeScoreResults() {
		if (scoreResultsPanel) {
			scoreResultsPanel.classList.remove('visible');
		}
		scoreResultsVisible = false;
	}

	// Apply selected taxon to the identification form via page context (has jQuery access)
	function applyTaxonToForm(taxon) {
		// Find and click the "Suggest an Identification" tab
		const tabs = document.querySelectorAll('.nav-tabs a');
		for (const tab of tabs) {
			if (tab.textContent.includes('Suggest')) {
				tab.click();
				break;
			}
		}

		setTimeout(() => {
			// Scroll to the form
			const container = document.querySelector('.TaxonAutocomplete');
			if (container) {
				container.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}

			// Send request to page context (domContext.js) which has jQuery access
			const requestId = Math.random().toString(36).substring(2);

			function handleResponse(event) {
				if (event.detail.requestId !== requestId) return;
				document.removeEventListener('selectTaxonResponse', handleResponse);

				if (event.detail.success) {
					log('Taxon selection applied:', taxon.name);
				} else {
					logError('Failed to apply taxon:', event.detail.error);
					alert('Could not apply selection: ' + event.detail.error);
				}
			}
			document.addEventListener('selectTaxonResponse', handleResponse);

			document.dispatchEvent(new CustomEvent('selectTaxonRequest', {
				detail: { taxon, requestId }
			}));
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

		// Show results area
		resultsArea.classList.add('visible');

		// Check cache first
		if (cvResultsCache) {
			log('Using cached CV results');
			resultsLoading.style.display = 'none';
			displayCVResults(cvResultsCache, resultsList);
			return;
		}

		// Show loading state
		resultsLoading.textContent = 'Loading suggestions...';
		resultsLoading.style.display = 'block';
		resultsList.innerHTML = '';

		// Get observation metadata
		const metadata = getObservationMetadata();
		log('Observation metadata:', metadata);

		// Convert canvas to data URL and call API via background script
		const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);

		(async function() {
			try {
				log('Calling score_image API');
				const data = await callScoreImageAPI(imageDataUrl, metadata);
				log('CV results:', data);

				// Cache the results
				cvResultsCache = data;

				resultsLoading.style.display = 'none';
				displayCVResults(data, resultsList);
			} catch (error) {
				logError('score_image API error:', error);
				resultsLoading.textContent = 'Error: ' + error.message;
			}
		})();
	}

	// Display CV results in the list (styled like iNaturalist's autocomplete)
	function displayCVResults(data, listEl, onClose) {
		if (!data.results || data.results.length === 0) {
			listEl.innerHTML = '<li class="section-header">No suggestions found</li>';
			return;
		}

		// Build the HTML
		let html = '';

		// Show common ancestor as selectable item if available
		if (data.common_ancestor) {
			const ancestor = data.common_ancestor.taxon;
			const ancestorScore = data.common_ancestor.score;
			const rankName = capitalizeRank(ancestor.rank);
			const photoUrl = ancestor.default_photo?.square_url || '';
			const commonName = ancestor.preferred_common_name;
			const scientificName = ancestor.name;

			html += `<li class="section-header">We're pretty sure this is in the ${rankName.toLowerCase()}:</li>`;
			html += `
				<li class="result-item" data-taxon-id="${ancestor.id}" data-is-ancestor="true">
					<div class="result-border" style="background: #74ac00;"></div>
					${photoUrl ? `<img class="result-photo" src="${photoUrl}" alt="">` : '<div class="result-photo"></div>'}
					<div class="result-info">
						<div class="result-name">${commonName || scientificName}</div>
						<div class="result-rank">${rankName} <em>${scientificName}</em></div>
					</div>
					${ancestorScore ? `<span class="result-score">${ancestorScore.toFixed(1)}%</span>` : ''}
					<a class="view-link" href="https://www.inaturalist.org/taxa/${ancestor.id}" target="_blank" onclick="event.stopPropagation();">View</a>
				</li>
			`;
		}

		// Section header for top suggestions
		html += '<li class="section-header">Here are our top suggestions:</li>';

		// Show top 10 results
		const results = data.results.slice(0, 10);

		html += results.map(result => {
			const taxon = result.taxon;
			const score = result.combined_score;
			const photoUrl = taxon.default_photo?.square_url || '';
			const commonName = taxon.preferred_common_name;
			const scientificName = taxon.name;
			const rankName = capitalizeRank(taxon.rank);

			// Build vision/geo tags
			const tags = [];
			if (result.vision_score) tags.push('Visually Similar');
			if (result.frequency_score) tags.push('Expected Nearby');
			const tagsHtml = tags.length > 0 ? `<div class="result-tags">${tags.join(' / ')}</div>` : '';

			// Calculate color based on score
			const hue = score * 1.2;

			// Display format depends on whether there's a common name:
			// - With common name: common name on top, scientific name (italic) below
			// - Without common name: scientific name on top, rank below
			let nameHtml;
			if (commonName) {
				nameHtml = `
					<div class="result-name">${commonName}</div>
					<div class="result-rank"><em>${scientificName}</em></div>
				`;
			} else {
				nameHtml = `
					<div class="result-name">${scientificName}</div>
					<div class="result-rank">${rankName}</div>
				`;
			}

			return `
				<li class="result-item" data-score="${score}" data-taxon-id="${taxon.id}">
					<div class="result-border" style="background: hsl(${hue}, 50%, 50%);"></div>
					${photoUrl ? `<img class="result-photo" src="${photoUrl}" alt="">` : '<div class="result-photo"></div>'}
					<div class="result-info">
						${nameHtml}
						${tagsHtml}
					</div>
					<span class="result-score">${score.toFixed(1)}%</span>
					<a class="view-link" href="https://www.inaturalist.org/taxa/${taxon.id}" target="_blank" onclick="event.stopPropagation();">View</a>
				</li>
			`;
		}).join('');

		listEl.innerHTML = html;

		// Store data for click handlers
		listEl._cvData = data;

		// Add click handlers to select a result
		listEl.querySelectorAll('li.result-item').forEach(li => {
			li.addEventListener('click', () => {
				const taxonId = li.dataset.taxonId;
				const isAncestor = li.dataset.isAncestor === 'true';

				let taxon;
				if (isAncestor && listEl._cvData.common_ancestor) {
					taxon = listEl._cvData.common_ancestor.taxon;
				} else {
					const result = listEl._cvData.results.find(r => r.taxon.id == taxonId);
					taxon = result?.taxon;
				}

				if (taxon) {
					if (onClose) {
						onClose();
					} else {
						closeCropModal();
					}
					setTimeout(() => applyTaxonToForm(taxon), 100);
				}
			});
		});

		// Apply color display mode, color blind mode, and percentage visibility
		chrome.storage.sync.get({
			enableColorVision: true,
			colorDisplayMode: 'sidebar',
			enableColorBlindMode: false,
			enableCVPercentages: true
		}, function(items) {
			// Hide score badges if percentages are disabled
			if (!items.enableCVPercentages) {
				listEl.querySelectorAll('.result-score').forEach(el => {
					el.style.display = 'none';
				});
			}

			// Skip color styling if color vision is disabled
			if (!items.enableColorVision) {
				// Hide color borders
				listEl.querySelectorAll('.result-border').forEach(el => {
					el.style.display = 'none';
				});
				return;
			}

			// Add class for gradient mode styling
			if (items.colorDisplayMode === 'gradient') {
				listEl.classList.add('gradient-mode');
			} else {
				listEl.classList.remove('gradient-mode');
			}

			listEl.querySelectorAll('li.result-item[data-score]').forEach(li => {
				const score = parseFloat(li.dataset.score);
				let hue = score * 1.2;

				if (items.enableColorBlindMode) {
					hue = hue * -1 + 240;
				}

				const borderEl = li.querySelector('.result-border');
				if (items.colorDisplayMode === 'gradient') {
					// Apply gradient background, hide sidebar
					if (borderEl) {
						borderEl.style.display = 'none';
					}
					li.style.background = `linear-gradient(to right, hsl(${hue}, 50%, 50%), white 90%)`;
				} else {
					// Sidebar mode - update color (for color blind mode)
					if (borderEl) {
						borderEl.style.background = `hsl(${hue}, 50%, 50%)`;
					}
				}
			});

			// Also handle the ancestor row which doesn't have data-score
			const ancestorRow = listEl.querySelector('li.result-item[data-is-ancestor="true"]');
			if (ancestorRow && items.colorDisplayMode === 'gradient') {
				const borderEl = ancestorRow.querySelector('.result-border');
				if (borderEl) {
					borderEl.style.display = 'none';
				}
				ancestorRow.style.background = 'linear-gradient(to right, #74ac00, white 90%)';
			}
		});
	}

	// Helper to capitalize rank names
	function capitalizeRank(rank) {
		if (!rank) return 'Taxon';
		return rank.charAt(0).toUpperCase() + rank.slice(1);
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
			logWarn('Invalid observed_on value, ignoring:', metadata.observed_on);
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
		log(`Prefetching ${urls.length} gallery images`);

		// Fetch sequentially to avoid overwhelming the network
		urls.reduce((chain, url) => {
			return chain.then(() => {
				if (!imageCache.has(url)) {
					return fetchImageViaBackground(url).catch(err => {
						logWarn('Failed to prefetch:', url, err);
					});
				}
			});
		}, Promise.resolve());
	}

	// Check if user is logged in by looking for API token
	function hasApiToken() {
		const metaToken = document.querySelector('meta[name="inaturalist-api-token"]');
		return metaToken && metaToken.content;
	}

	// Create and add the crop button to a stable location
	function addScoreAndCropButtons() {
		// Don't add if already exists
		if (document.querySelector('.inat-crop-trigger-container')) return;

		// Inject styles first
		injectButtonStyles();

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
			log('No suitable container found for Score/Crop buttons');
			return;
		}

		// Create button container
		const container = document.createElement('div');
		container.className = 'inat-crop-trigger-container';

		// Score Image button (left)
		const scoreButton = document.createElement('button');
		scoreButton.className = 'inat-crop-trigger';
		scoreButton.innerHTML = `
			<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
				<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
			</svg>
			Score Image
		`;

		scoreButton.addEventListener('click', function(e) {
			e.preventDefault();
			e.stopPropagation();

			const imageUrl = getCurrentPhotoUrl();
			if (!imageUrl) {
				alert('Could not find photo to score');
				return;
			}

			scoreCurrentImage(imageUrl, container);
		});

		// Crop button (right)
		const cropButton = document.createElement('button');
		cropButton.className = 'inat-crop-trigger';
		cropButton.innerHTML = `
			<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
				<path d="M17 15h2V7c0-1.1-.9-2-2-2H9v2h8v8zM7 17V1H5v4H1v2h4v10c0 1.1.9 2 2 2h10v4h2v-4h4v-2H7z"/>
			</svg>
			Crop for CV
		`;

		cropButton.addEventListener('click', function(e) {
			e.preventDefault();
			e.stopPropagation();

			const imageUrl = getCurrentPhotoUrl();
			if (!imageUrl) {
				alert('Could not find photo to crop');
				return;
			}

			// Close score results if open
			closeScoreResults();

			loadCropperCSS();
			openCropModal(imageUrl);
		});

		container.appendChild(scoreButton);
		container.appendChild(cropButton);

		// Insert after the target container
		targetContainer.parentNode.insertBefore(container, targetContainer.nextSibling);

		// Close score results panel when clicking outside
		document.addEventListener('click', (e) => {
			if (scoreResultsVisible && scoreResultsPanel) {
				if (!scoreResultsPanel.contains(e.target) && !container.contains(e.target)) {
					closeScoreResults();
				}
			}
		});

		// Close score results panel on Escape
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape' && scoreResultsVisible) {
				closeScoreResults();
			}
		});

		log('Score and Crop buttons added');
	}

	// Watch for the photo gallery to appear
	function init() {
		// Check for API token once upfront (user must be logged in)
		if (!hasApiToken()) {
			log('Score Image & Crop tools enabled but require login - buttons not shown');
			return;
		}

		// Wait for the gallery/photo elements to load, then add our button
		const selectors = ['.image-gallery', '.PhotoBrowser', '.ObservationMedia'];

		for (const selector of selectors) {
			document.arrive(selector, { existing: true }, function() {
				// Small delay to ensure the gallery is fully rendered
				setTimeout(() => {
					addScoreAndCropButtons();
					prefetchGalleryImages();
				}, 100);
			});
		}

		log('Score Image & Crop initialized');
	}

	// Start when DOM is ready
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
});
