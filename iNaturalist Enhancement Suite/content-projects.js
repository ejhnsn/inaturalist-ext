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

	document.arrive('.LeaderboardPanel.observers > a[href*="user_id"]', async a => {
		const href = a.href;
		const userMatch = href.match(/[?&]user_id=([^&]+)/i);
		if (!userMatch) {
			return;
		}

		const user = userMatch[1];
		const projectMatch = href.match(/[?&]project_id=(\d+)/i);
		if (!projectMatch) {
			return;
		}

		const projectId = projectMatch[1];
		if (LOGGING_ENABLED) {
			console.debug({ user, projectId });
		}

		const count = await getObservationCount(user, projectId, false);
		if (count) {
			for (const button of a.querySelectorAll('button')) {
				button.innerHTML += `: <b>${count}</b>`;		
				if (LOGGING_ENABLED) {
					console.debug(button);
				}
			}		
		}
	});

	document.arrive('.LeaderboardPanel[class*="species"] > a[href*="user_id"]', async a => {
		const href = a.href;
		const userMatch = href.match(/[?&]user_id=([^&]+)/i);
		if (!userMatch) {
			return;
		}

		const user = userMatch[1];
		const projectMatch = href.match(/[?&]project_id=(\d+)/i);
		if (!projectMatch) {
			return;
		}

		const projectId = projectMatch[1];
		if (LOGGING_ENABLED) {
			console.debug({ user, projectId });
		}

		const count = await getObservationCount(user, projectId, true);
		if (count) {
			for (const button of a.querySelectorAll('button')) {
				button.innerHTML += `: <b>${count}</b>`;		
				if (LOGGING_ENABLED) {
					console.debug(button);
				}
			}		
		}
	});

	const counts = new Map();
	async function getObservationCount(user, projectId, isSpeciesCount) {
		const key = `${projectId}#${isSpeciesCount}`
		let count = counts.get(projectId);
		if (count !== undefined) {
			if (LOGGING_ENABLED) {
				console.debug(`Using cached count ${count} for ${key}.`);
			}

			return count;
		}

		let url = `https://api.inaturalist.org/v1/observations${(isSpeciesCount ? '/species_counts' : '')}?user_id=${user}&project_id=${projectId}`;
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