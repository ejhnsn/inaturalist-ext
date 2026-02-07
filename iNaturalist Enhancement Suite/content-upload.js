chrome.storage.sync.get({
	enableCopyGeo: true,
	enableLogging: false
}, function(items) {
	// Use shared logging from logging.js
	const logDebug = window.iNatLogDebug || console.debug;

	logDebug('Settings loaded:', items);

	if (items.enableCopyGeo) {
		document.arrive('div.GooglePlacesAutocomplete > input[type="text"]', input => {
			input.addEventListener('paste', e => {
				const pasted = e.clipboardData.getData('Text');
				const matches = pasted.match(/(\-?\d+\.\d+),\s*(\-?\d+\.\d+)/);
				if (matches && matches.length === 3) {
					const lat = matches[1];
					const long = matches[2];
					for (const label of document.querySelectorAll('.label-text')) {
						if (label.innerHTML === 'Latitude' || label.innerHTML === 'Longitude') {
							const labelInput = label.parentNode.querySelector('input');
							const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
							setter.call(labelInput, label.innerHTML === 'Latitude' ? lat : long);
							labelInput.dispatchEvent(new Event('input', { bubbles: true }));
						}
					}
				}
			});
		});
	}
});
