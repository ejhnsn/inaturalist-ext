chrome.storage.sync.get({
	enableColorVision: true,
	enableCVPercentages: true,
	enableCopyGeo: true,
	enableIdentifierStats: true,
	enableLogging: false
}, function(items) {
	// Use shared logging from logging.js
	const logDebug = window.iNatLogDebug || console.debug;
	const log = window.iNatLog || console.log;

	const DEFAULT_KEY_NAME = 'default';
	const FLAG_CLASS = 'expanded';

	logDebug('Settings loaded:', items);

	if (items.enableIdentifierStats) {
		document.arrive('.ActivityItem.identification', async div => {
			const userAnchor = div.querySelector('a.user')
			const taxonAnchor = div.querySelector('.taxon > a')
			if (userAnchor && taxonAnchor) {
				const user = userAnchor.innerHTML;
				const taxonParts = taxonAnchor.href.split('/')
				const taxonId = taxonParts[taxonParts.length - 1];
				const url = `https://api.inaturalist.org/v1/identifications/categories?user_login=${user}&taxon_id=${taxonId}`;
				const response = await fetch(url);
				const data = await response.json();
				if (data && data.results && data.results.length) {
					const leading = data.results.find(c => c.category === 'leading');
					const improving = data.results.find(c => c.category === 'improving');
					const supporting = data.results.find(c => c.category === 'supporting');
					const maverick = data.results.find(c => c.category === 'maverick');
					const leadingCount = leading ? leading.count : 0;
					const improvingCount = improving ? improving.count : 0;
					const supportingCount = supporting ? supporting.count : 0;
					const maverickCount = maverick ? maverick.count : 0;
					const span = div.querySelector('span.title_text');
					if (span) {
						const title = `Leading: ${leadingCount}&#010;Improving: ${improvingCount}&#010;Supporting: ${supportingCount}&#010;Maverick: ${maverickCount}`;
						const countMarkup = `<span title="${title}">(${leadingCount + improvingCount})</span>`;
						span.innerHTML = span.innerHTML.replace('</a>', `</a> ${countMarkup}`);
					}
				}
			}
		})
	}


	if (items.enableCopyGeo) {
		document.arrive('.MapDetails > .top_info', async div => {
			let lat, long;
			for (const child of div.children) {
				const attr = child.querySelector('.attr');
				if (attr) {
					if (attr.innerHTML.startsWith('Lat')) {
						lat = child.querySelector('.value').innerHTML;
					} else if (attr.innerHTML.startsWith('Lon')) {
						long = child.querySelector('.value').innerHTML;
					}
				}
			}

			if (lat !== undefined && long !== undefined) {
				const button = document.createElement('button');
				button.innerHTML = 'Copy';
				button.onclick = async function() {
					await navigator.clipboard.writeText(`${lat},${long}`);
				}

				div.appendChild(button);
			}
		});
	}

	let location;
	let computerVisionResults = new Map();

	document.addEventListener('observationFetch', event => {
		log('observationFetch handler', event.detail);

		if (items.enableCopyGeo) {
			const detail = event.detail;
			if (detail) {
				location = detail.location;
				if (location) {
					const ul = document.querySelector(".map-and-details .details ul:not([role])");
					if (ul) {
						const buttonClass = 'copy-geo';
						if (!ul.querySelector('.' + buttonClass)) {
							const button = document.createElement('button');
							button.innerHTML = 'Copy geocoordinates';
							button.className = buttonClass;
							button.onclick = async function() {
								await navigator.clipboard.writeText(location);
							}

							const li = document.createElement('li');
							li.appendChild(button);
							ul.appendChild(li);
						}
					}
				}
			}
		}
	});

	// cache the CV response for a photo
	document.addEventListener('computerVisionResponse', event => {
		log('computerVisionResponse handler', event.detail);

		if (items.enableColorVision || items.enableCVPercentages) {
			const detail = event.detail;
			if (detail && detail.data) {
				const key = detail.filename || DEFAULT_KEY_NAME;
				logDebug('key', key);

				computerVisionResults.set(key, detail.data);
			}
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

						// in the upload workflow, we need to work up the tree to find a parent element
						if (window.location.href.indexOf('upload') > -1) {
							do {
								if (parent.classList.contains('cellDropzone')) {
									break;
								}

								parent = parent.parentNode;
							} while (parent.parentNode);
						}

						logDebug('parent', parent);

						// img will be falsy here on the single-observation page
						const img = parent.querySelector('img.img-thumbnail');
						const key = img ? img.alt : DEFAULT_KEY_NAME;

						logDebug('key', key);

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
									enableColorVision: true,
									colorDisplayMode: 'sidebar',
									enableColorBlindMode: false,
									enableCVPercentages: true
								}, function(colorItems) {
									if (colorItems.enableColorBlindMode) {
										hue = hue * -1 + 240;
									}

									const li = div.closest('li');

									// Apply color coding if enabled
									if (colorItems.enableColorVision) {
										if (colorItems.colorDisplayMode === 'gradient') {
											div.style.background = 'linear-gradient(to right, hsl(' + hue + ',50%,50%), white 90%)';
										} else {
											// Add rounded sidebar element instead of border-left
											if (!li.querySelector('.cv-sidebar')) {
												const ul = div.parentNode.parentNode;
												if (!ul.classList.contains(FLAG_CLASS)) {
													ul.style.width = parseInt(ul.style.width) + 10 + 'px';
													ul.classList.add(FLAG_CLASS);
												}

												const sidebar = document.createElement('div');
												sidebar.className = 'cv-sidebar';
												sidebar.style.cssText = 'width: 6px; background: hsl(' + hue + ', 50%, 50%); border-radius: 3px; position: absolute; left: 8px; top: 4px; bottom: 4px;';

												if (li) {
													li.style.position = 'relative';
													li.style.paddingLeft = '18px';
													li.insertBefore(sidebar, li.firstChild);
												}
											}
										}
									}

									// Add score badge if not already present
									if (colorItems.enableCVPercentages && !div.querySelector('.cv-score-badge')) {
										// Find the .title element to insert badge after taxon name
										const titleEl = div.querySelector('.title');
										if (titleEl) {
											const badge = document.createElement('span');
											badge.className = 'cv-score-badge';
											badge.textContent = score.toFixed(1) + '%';
											badge.style.cssText = 'font-size: 10px; font-weight: 600; padding: 1px 6px; margin-left: 6px; border-radius: 8px; background: #74ac00; color: white; vertical-align: middle;';
											titleEl.appendChild(badge);
										}
									}
								});
							}
						}

						break;
					}

					case 'attributes': {
						// reset the flag so we fix the menu width again when the CV menu is reopened
						const classList = mutation.target.classList;
						if (!classList.contains('open') && mutation.oldValue.indexOf(' open') > -1 && classList.contains(FLAG_CLASS)) {
							classList.remove(FLAG_CLASS);
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