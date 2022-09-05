const oldFetch = window.fetch;
window.fetch = async (url, options) => {
    const response = await oldFetch(url, options);
	try {
		if (url.endsWith('/photos')) {
			const data = await response.clone().json();

			if (data) {
				const id = data.id;
				let filename = null;
				if (options) {
					const formData = options.body;
					if (formData) {
						const file = formData.get('file');
						if (file) {
							filename = file.name;
						}
					}
				}

				let latitude = null;
				let longitude = null;
				const observation = data.to_observation;
				if (observation) {
					latitude = observation.latitude;
					longitude = observation.longitude;
				}

				const payload = { 
					detail: {
						id,
						filename,
						latitude,
						longitude,
					}
				};

				document.dispatchEvent(
					new CustomEvent('imageUpload', payload)
				);
			}
		}
		else if (url.startsWith('https://api.inaturalist.org/v1/computervision')) {
			const data = await response.clone().json();

			if (data) {
				let latitude = null;
				let longitude = null;
				let datetime = null;
				if (options) {
					const formData = options.body;
					if (formData) {
						// image data as a File object is also available here as "image"
						latitude = formData.get('lat');
						longitude = formData.get('lng');
						datetime = formData.get('observed_on');
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
					new CustomEvent('computerVisionResponse', payload)
				);
			}
		}
	} catch (err) {
		console.error(err);
	}
    
	return response;
};
