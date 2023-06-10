chrome.storage.sync.get({
	enableCount: true,
	enableLogging: false
}, async function(items) {
	const LOGGING_ENABLED = items.enableLogging;

	if (LOGGING_ENABLED) {
		console.debug(items);
	}

	if (!items.enableCount) {
		return;
	}

	document.arrive('.NumObservations > div > div > a.btn[href*="user_id"]', async a => {
		const href = a.href;
		const userMatch = href.match(/[?&]user_id=([^&]+)/i);
		if (!userMatch) {
			return;
		}

		const user = userMatch[1];
		const taxonMatch = href.match(/[?&]taxon_id=(\d+)/i);
		if (!taxonMatch) {
			return;
		}

		const taxonId = taxonMatch[1];
		let placeId = null;
		const placeMatch = href.match(/[?&]place_id=(\d+)/i);
		if (placeMatch) {
			placeId = placeMatch[1];
		}

		if (LOGGING_ENABLED) {
			console.debug({ user, taxonId, placeId });
		}

		const count = await getObservationCount(user, taxonId, placeId);
		if (count) {
			for (const span of a.querySelectorAll('span')) {
				span.innerHTML += `: <b>${count}</b>`;		
				if (LOGGING_ENABLED) {
					console.debug(span);
				}
			}		
		}
	});

	const counts = new Map();
	async function getObservationCount(user, taxonId, placeId) {
		const key = `${taxonId}#${placeId || 'null'}`
		let count = counts.get(key);
		if (count !== undefined) {
			if (LOGGING_ENABLED) {
				console.debug(`Using cached count ${count} for ${key}.`);
			}

			return count;
		}

		let url = `https://api.inaturalist.org/v1/observations?user_id=${user}&taxon_id=${taxonId}`;
		if (placeId) {
			url += `&place_id=${placeId}`;
		}

		if (LOGGING_ENABLED) {
			console.debug(`Requesting ${url}`);
		}

		const response = await fetch(url);
		const observations = await response.json();
		count = observations.total_results;
		if (LOGGING_ENABLED) {
			console.debug(`Retrieved count ${count} for ${key}.`);
		}

		counts.set(key, count);
		return count;
	}
});