chrome.storage.sync.get({
	enableColorVision: true
}, function(items) {
	if (!items.enableColorVision) {
		return;
	}

	const computerVisionResults = new Map();
	
	const script = document.createElement('script');
	script.src = chrome.runtime.getURL('fetch.js');
	script.onload = function() {
		function round(value, decimals) {
			return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
		}

		// cache the CV response for a photo
		document.addEventListener('computerVisionResponse', event => {
			const detail = event.detail;
			if (detail && detail.data) {
				const latitude = round(detail.latitude, 10) || null;
				const longitude = round(detail.longitude, 10) || null;
				const key = `${latitude}-${longitude}-${detail.datetime}`;
				computerVisionResults.set(key, detail.data);
			}	 
		});

		// initialize lat/long containers
		document.arrive('input.input-sm[placeholder="Location"]', input => {
			for (const type of ['latitude', 'longitude']) {
				const span = document.createElement('span');
				span.setAttribute('class', `${type}-container`);
				span.style.display = 'none';
				input.parentNode.appendChild(span);
			}
		});

		// store lat/long values in containers when auto-populated from image metadata
		document.addEventListener('imageUpload', event => {
			const detail = event.detail;
			if (detail) {
				const filename = detail.filename;
				if (filename) {
					const img = document.querySelector(`img[alt="${filename}"]`);

					if (img) {
						// find the proper parent div, from which we can get to the containers
						const observations = document.querySelectorAll('div.cellDropzone');
						let observation;
						for (const o of observations) {
							if (o.querySelector(`img[alt="${filename}"]`)) {
								observation = o;
								break;
							}
						}

						if (observation) {
							const latContainer = observation.querySelector('span.latitude-container');
							const longContainer = observation.querySelector('span.longitude-container');
							latContainer.innerHTML = detail.latitude;
							longContainer.innerHTML = detail.longitude;
						}
					}
				}
			}	 
		});

		// store lat/long values in containers on "save" from modal
		document.arrive('div.modal-footer > button.btn-primary', button => {
			button.addEventListener('click', event => {
				const selected = document.querySelectorAll('div.selected');
				for (const observation of selected) {
					const latContainer = observation.querySelector('span.latitude-container');
					const longContainer = observation.querySelector('span.longitude-container');
					const modalBody = event.path[1].previousElementSibling;
					const spans = modalBody.querySelectorAll('span[class="label-text"]');
					for (const span of spans) {
						const input = span.nextElementSibling;
						const type = span.innerHTML;
						switch (type) {
							case 'Latitude':
								latContainer.innerHTML = input.value;
								break;
							
							case 'Longitude':
								longContainer.innerHTML = input.value;
								break;
						}
					}
				}
			});
		});

		// colorization
		document.arrive('div.TaxonAutocomplete > ul', ul => {
			// triggered when the subtree changes, i.e. the CV rows are created, or classes are added/removed
			function observeCallback(mutations) {
				for (const mutation of mutations) {
					const element = mutation.target;
					switch (mutation.type) {
						case 'childList': {
							const divs = element.querySelectorAll('div.ac.vision');

							// short-circuit if the CV rows haven't been populated yet
							if (!divs.length) {
								return;
							}

							let parent = element.parentElement;

							// in the upload workflow, we need to find a stable parent element which won't overwrite our class
							if (location.href.indexOf('upload') > -1) {
								do {
									if (parent.tagName.toLowerCase() === 'div' && parent.classList.contains('caption')) {
										break;
									}

									parent = parent.parentElement;
								} while (parent.parentElement);
							}
							
							// short-circuit if we've already colorized the CV rows
							if (parent && parent.classList.contains('colorized')) {
								return;
							}
	
							let latitude = null;
							let longitude = null;
							let datetime = null;

							// caption will only be truthy in the upload workflow
							if (parent) {
								let container = parent.querySelector('span.latitude-container');
								if (container) {
									latitude = round(container.innerHTML, 10) || null;
								}
							
								container = parent.querySelector('span.longitude-container');
								if (container) {
									longitude = round(container.innerHTML, 10) || null;
								}
							
								container = parent.querySelector('input[placeholder="Date"]');
								if (container) {
									datetime = container.value || null;
								}
							}
						

							const key = `${latitude}-${longitude}-${datetime}`;
							const computerVision = computerVisionResults.get(key);
							if (!computerVision) {
								return;
							}
						
							// color each suggestion based on the cached CV results
							for (const div of divs) {
								const taxonId = div.getAttribute('data-taxon-id');
								const result = computerVision.results.find(t => t.taxon.id == taxonId);
								let score;
								if (result) {
									score = result.combined_score;
								} else if (computerVision.common_ancestor && computerVision.common_ancestor.taxon && computerVision.common_ancestor.taxon.id == taxonId) {
									score = computerVision.common_ancestor.score;
								}
								
								if (score) {
									let hue = score * 1.2;
									chrome.storage.sync.get({
										colorDisplayMode: 'sidebar',
										enableColorBlindMode: false
									}, function(items) {
										if (items.enableColorBlindMode) {
											hue = hue * -1 + 240;
										}
						
										if (items.colorDisplayMode === 'gradient') {
											div.style.background = 'linear-gradient(to right, hsl(' + hue + ',50%,50%), white 90%)';
										} else {
											updateMenuWidth();
											div.style.borderLeft = '7px solid hsl(' + hue + ',50%,50%)';
										}
									});
								}
							}
	
							// flag that we've the colorization so we don't do it repeatedly based on meaningless (to us) churn in the CV list
							if (parent) {
								parent.classList.add('colorized');
							}

							break;
						}

						case 'attributes': {
							// reset the flag so we do the colorization again when the CV menu is reopened
							if (!mutation.target.classList.contains('open') && mutation.oldValue.indexOf(' open') > -1) {
								const colorized = document.querySelector('div.colorized');
								if (colorized) {
									colorized.classList.remove('colorized');
								}
							}

							break;
						}
					}
				}
			}

			// listen for individual CV rows to be created
			const observer = new MutationObserver(observeCallback);
			const options = { 
				childList: true, 
				subtree: true, 
				attributeFilter: ['class'], 
				attributeOldValue: true 
			};

			observer.observe(ul, options);
		});

		document.leave('.ac.vision', initializeUpdateMenuWidth);
	}

	document.documentElement.appendChild(script);

	chrome.storage.sync.get({
		colorDisplayMode: 'sidebar'
	}, function(items) {
		const link = document.createElement('link');
		link.type = 'text/css';
		link.rel = 'stylesheet';
		link.href = chrome.runtime.getURL(items.colorDisplayMode + '.css');
		document.documentElement.appendChild(link);
	});
});

let updateMenuWidth;

function updateMenuWidthInner() {
	var menu = document.getElementsByClassName('ac-menu')[0];
	menu.style.width = parseInt(menu.style.width) + 7 + 'px';
}

function initializeUpdateMenuWidth() {
	updateMenuWidth = function() {
		updateMenuWidth = function() {};
		updateMenuWidthInner();
	}
}

initializeUpdateMenuWidth();