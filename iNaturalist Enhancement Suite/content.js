chrome.storage.sync.get({
	enableColorVision: true,
	enableLogging: false
}, function(items) {
	if (!items.enableColorVision) {
		return;
	}

	const LOGGING_ENABLED = items.enableLogging;
	const DEFAULT_KEY_NAME = 'default';
	let computerVisionResults = new Map();
	
	const script = document.createElement('script');
	script.src = chrome.runtime.getURL('domContext.js');
	script.onload = function() {
		// cache the CV response for a photo
		document.addEventListener('computerVisionResponse', event => {
			if (LOGGING_ENABLED) {
				console.trace('computerVisionResponse handler', event.detail);
			}

			const detail = event.detail;
			if (detail && detail.data) {
				const key = detail.filename || DEFAULT_KEY_NAME;
				if (LOGGING_ENABLED) {
 					console.debug('key', key);
				}

				computerVisionResults.set(key, detail.data);
			}	 
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
							let caption = parent;

							// in the upload workflow, we need to work up the tree to find a parent element
							if (location.href.indexOf('upload') > -1) {
								do {
									if (parent.classList.contains('cellDropzone')) {
										break;
									}

									parent = parent.parentNode;
								} while (parent.parentNode);

								// we need to find a element with stable classes to use for our "colorized" flag class
								caption = parent.querySelector('div.caption');
							}

							if (LOGGING_ENABLED) {
								console.debug('parent', parent);
								console.debug('caption', caption, caption.classList.contains('colorized'));
							}
							
							// short-circuit if we've already colorized the CV rows
							if (caption && caption.classList.contains('colorized')) {
								return;
							}

							// img will be falsy here on the single-observation page
							const img = parent.querySelector('img.img-thumbnail');
							const key = img ? img.alt : DEFAULT_KEY_NAME;

							if (LOGGING_ENABLED) {
								console.debug('key', key);
							}

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
							if (caption) {
								caption.classList.add('colorized');
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