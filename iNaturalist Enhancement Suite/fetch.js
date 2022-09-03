const oldFetch = window.fetch;
window.fetch = async (url, options) => {
    const response = await oldFetch(url, options);

	try {
		if (url.startsWith("https://api.inaturalist.org/v1/computervision")) {
			const data = await response.clone().json();

			if (data) {
				let latitude = null;
				let longitude = null;
				let datetime = null;
				if (options) {
					const formData = options.body;
					if (formData) {
						latitude = formData.get("lat");
						longitude = formData.get("lng");
						datetime = formData.get("observed_on");
					}
				}

				const payload = { 
					detail: {
						data,
						latitude,
						longitude,
						datetime
					}
				};

				document.dispatchEvent(
					new CustomEvent("computerVisionResponse", payload)
				);
			}
		}
	} catch (err) {
		console.error(err);
	}
    
	return response;
};
