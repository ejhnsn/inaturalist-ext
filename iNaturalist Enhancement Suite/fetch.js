const oldFetch = window.fetch;
window.fetch = function() {
	return new Promise((resolve, reject) => {
		oldFetch
			.apply(this, arguments)
			.then(response => {
				try {
					if (response && response.url && response.url.startsWith("https://api.inaturalist.org/v1/computervision/")) {
						response
							.clone()
							.json()
							.then(data => {
								document.dispatchEvent(new CustomEvent("computerVisionResponse", {detail: data}));
								resolve(response);
							})
							.catch(error => {
								// if the response wasn't JSON it's not our error
								reject(error);
							});				
					} else {
						resolve(response);
					}
				} catch (error) {
					resolve(response);
				}
			})
			.catch(error => {
				reject(error);
			});
	});
};