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
				var pasted = e.clipboardData.getData('Text');
				var matches = pasted.match(/(\-?\d+\.\d+),\s*(\-?\d+\.\d+)/);
				if (matches && matches.length === 3) {
					var lat = matches[1];
					var long = matches[2];
					for (var label of document.querySelectorAll('.label-text')) {
						if (label.innerHTML === 'Latitude' || label.innerHTML === 'Longitude') {
							var input = label.parentNode.querySelector('input');
							var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
							setter.call(input, label.innerHTML === 'Latitude' ? lat : long);
							input.dispatchEvent(new Event('input', { bubbles: true }));
						}
					}
				}
			});
		});
	}
});