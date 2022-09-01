chrome.storage.sync.get({
	enableColorVision: true
}, function(items) {
	if (!items.enableColorVision) {
		return;
	}
	
	const script = document.createElement('script');
	script.src = chrome.runtime.getURL('fetch.js');
	script.onload = function() {
		document.addEventListener("computerVisionResponse", e => {
			if (e.detail && e.detail.results) {
				computerVision = e.detail;
			}	 
		});

		document.arrive(".ac.vision", function() {
			if (!computerVision || !computerVision.results) {
				return;
			}
			
			const taxonId = this.getAttribute('data-taxon-id');
			const result = computerVision.results.find(t => t.taxon.id == taxonId);
			let score;
			if (result) {
				score = result.combined_score;
			} else if (computerVision.common_ancestor && computerVision.common_ancestor.taxon && computerVision.common_ancestor.taxon.id == taxonId) {
				score = computerVision.common_ancestor.score;
			}
			
			if (score) {
				const element = this;
				let hue = score * 1.2;
				chrome.storage.sync.get({
					colorDisplayMode: 'sidebar',
					enableColorBlindMode: false
				}, function(items) {
					if (items.enableColorBlindMode) {
						hue = hue * -1 + 240;
					}

					if (items.colorDisplayMode === 'gradient') {
						element.style.background = 'linear-gradient(to right, hsl(' + hue + ',50%,50%), white 90%)';
					} else {
						updateMenuWidth();
						element.style.borderLeft = '7px solid hsl(' + hue + ',50%,50%)';
					}
				});
			}
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

let computerVision;
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