chrome.storage.sync.get({
	enableColorVision: true
}, function(items) {
	if (!items.enableColorVision) {
		return;
	}

	let currentObservation;
	let computerVisionResults = new Map();
	
	const script = document.createElement('script');
	script.src = chrome.runtime.getURL('fetch.js');
	script.onload = function() {
		document.addEventListener("computerVisionResponse", event => {
			const detail = event.detail;
			if (detail && detail.data) {
				const key = `${detail.latitude}-${detail.longitude}-${detail.datetime}`;
				computerVisionResults.set(key, detail.data);
			}	 
		});

		document.arrive('input.input-sm[placeholder="Location"]', input => {
			input.addEventListener('click', event => { 
				currentObservation = event.path[1];
				for (const type of ['latitude', 'longitude']) {
					const span = document.createElement('span');
					span.setAttribute('class', `${type}-container`);
					span.style.display = 'none';
					currentObservation.appendChild(span);
				}
			 });
		});

		document.arrive('div.modal-footer', footer => {
			const button = footer.querySelector('button.btn-primary');
			if (button) {
				button.addEventListener('click', event => {
					const lat = currentObservation.querySelector('span.latitude-container');
					const long = currentObservation.querySelector('span.longitude-container');
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
				});
			}
		});

		document.arrive('div.TaxonAutocomplete > ul', ul => {
			function observeCallback(mutations) {
				for (const mutation of mutations) {
					const element = mutation.target;
					const caption = element.parentNode.parentNode;

					switch (mutation.type) {
						case 'childList': {
							const divs = element.querySelectorAll('div.ac.vision');
							if (!divs.length || caption.classList.contains('colorized')) {
								return;
							}
	
							let lat = null;
							let long = null;
							let datetime = null;
							let container = caption.querySelector('span.latitude-container');
							if (container) {
								lat = container.innerHTML;
							}
						
							container = caption.querySelector('span.longitude-container');
							if (container) {
								long = container.innerHTML;
							}
						
							container = caption.querySelector('input[placeholder="Date"]');
							if (container) {
								datetime = container.value || null;
							}
						
							const key = `${lat}-${long}-${datetime}`;
							const computerVision = computerVisionResults.get(key);
							if (!computerVision) {
								return;
							}
						
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
	
							caption.classList.add('colorized');

							break;
						}

						case 'attributes': {
							if (!mutation.target.classList.contains('open') && mutation.oldValue.indexOf(' open')) {
								caption.classList.remove('colorized');
							}

							break;
						}
					}
				}
			}
			
			const observer = new MutationObserver(observeCallback);
			const options = { 
				childList: true, 
				subtree: true, 
				attributeFilter: ['class'], 
				attributeOldValue: true 
			};

			observer.observe(ul, options);
		});
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
	var menu = document.getElementsByClassName("ac-menu")[0];
	menu.style.width = parseInt(menu.style.width) + 7 + "px";
}

function initializeUpdateMenuWidth() {
	updateMenuWidth = function() {
		updateMenuWidth = function() {};
		updateMenuWidthInner();
	}
}

initializeUpdateMenuWidth();