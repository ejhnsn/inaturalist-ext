chrome.storage.sync.get({
	enableColorVision: true
}, function(items) {
	if (!items.enableColorVision) {
		return;
	}

	let computerVisionResults = new Map();
	
	const script = document.createElement('script');
	script.src = chrome.runtime.getURL('fetch.js');
	script.onload = function() {
		// cache the CV response for a photo
		document.addEventListener('computerVisionResponse', event => {
			const detail = event.detail;
			if (detail && detail.data) {
				const key = `${detail.latitude}-${detail.longitude}-${detail.datetime}`;
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

		// store lat/long values in containers on "save" from modal
		document.arrive('div.modal-footer > button.btn-primary', button => {
			button.addEventListener('click', event => {
				const selected = document.querySelectorAll('div.selected');
				for (const observation of selected) {
					const lat = observation.querySelector('span.latitude-container');
					const long = observation.querySelector('span.longitude-container');
					const modalBody = event.path[1].previousElementSibling;
					const spans = modalBody.querySelectorAll('span[class="label-text"]');
					for (const span of spans) {
						const input = span.nextElementSibling;
						const type = span.innerHTML;
						switch (type) {
							case 'Latitude':
								lat.innerHTML = input.value;
								break;
							
							case 'Longitude':
								long.innerHTML = input.value;
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

							let parent = element.parentNode;

							// in the upload workflow, we need to find a stable parent element which won't overwrite our class
							if (location.href.indexOf('upload') > -1) {
								do {
									if (parent.tagName.toLowerCase() === 'div' && parent.classList.contains('caption')) {
										break;
									}

									parent = parent.parentNode;
								} while (parent.parentNode);
							}
							
							// short-circuit if we've already colorized the CV rows
							if (parent && parent.classList.contains('colorized')) {
								return;
							}
	
							let lat = null;
							let long = null;
							let datetime = null;

							// caption will only be truthy in the upload workflow
							if (parent) {
								let container = parent.querySelector('span.latitude-container');
								if (container) {
									lat = container.innerHTML || null;
								}
							
								container = parent.querySelector('span.longitude-container');
								if (container) {
									long = container.innerHTML || null;
								}
							
								container = parent.querySelector('input[placeholder="Date"]');
								if (container) {
									datetime = container.value || null;
								}
							}
						
							const key = `${lat}-${long}-${datetime}`;
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