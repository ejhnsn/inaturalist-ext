// Shared logging utilities for iNaturalist Enhancement Suite
// This file should be loaded before other content scripts

(function() {
	'use strict';

	const LOG_PREFIX = '[iNat Enhancement Suite]';
	let LOGGING_ENABLED = false;

	// Get logging preference from storage
	chrome.storage.sync.get({ enableLogging: false }, function(items) {
		LOGGING_ENABLED = items.enableLogging;
		window.__iNatEnhancement_LOGGING_ENABLED = LOGGING_ENABLED;
	});

	// Logging helpers - exposed globally for other scripts
	window.iNatLog = function(...args) {
		if (window.__iNatEnhancement_LOGGING_ENABLED) {
			console.log(LOG_PREFIX, ...args);
		}
	};

	window.iNatLogError = function(...args) {
		if (window.__iNatEnhancement_LOGGING_ENABLED) {
			console.error(LOG_PREFIX, ...args);
		}
	};

	window.iNatLogWarn = function(...args) {
		if (window.__iNatEnhancement_LOGGING_ENABLED) {
			console.warn(LOG_PREFIX, ...args);
		}
	};

	window.iNatLogDebug = function(...args) {
		if (window.__iNatEnhancement_LOGGING_ENABLED) {
			console.debug(LOG_PREFIX, ...args);
		}
	};

	window.iNatLogTrace = function(...args) {
		if (window.__iNatEnhancement_LOGGING_ENABLED) {
			console.trace(LOG_PREFIX, ...args);
		}
	};
})();
