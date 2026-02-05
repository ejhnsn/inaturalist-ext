// Background script for handling cross-origin requests

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === 'fetchImage') {
		fetchImageAsDataUrl(request.url)
			.then(dataUrl => sendResponse({ success: true, dataUrl }))
			.catch(error => sendResponse({ success: false, error: error.message }));
		return true; // Keep channel open for async response
	}

	if (request.action === 'scoreImage') {
		scoreImage(request.imageDataUrl, request.metadata)
			.then(data => sendResponse({ success: true, data }))
			.catch(error => sendResponse({ success: false, error: error.message }));
		return true;
	}
});

async function fetchImageAsDataUrl(url) {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}`);
	}
	const blob = await response.blob();
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result);
		reader.onerror = () => reject(new Error('Failed to read blob'));
		reader.readAsDataURL(blob);
	});
}

async function scoreImage(imageDataUrl, metadata) {
	// Convert data URL to blob
	const response = await fetch(imageDataUrl);
	const blob = await response.blob();

	const formData = new FormData();
	formData.append('image', blob, 'cropped.jpg');
	formData.append('include_representative_photos', 'true');

	if (metadata.lat && metadata.lng) {
		formData.append('lat', metadata.lat);
		formData.append('lng', metadata.lng);
	}
	if (metadata.observed_on) {
		formData.append('observed_on', metadata.observed_on);
	}

	const headers = {
		'X-Via': 'iNaturalist-Enhancement-Suite'
	};

	const apiResponse = await fetch('https://api.inaturalist.org/v1/computervision/score_image', {
		method: 'POST',
		headers,
		body: formData
	});

	if (!apiResponse.ok) {
		const text = await apiResponse.text();
		console.error('API response:', apiResponse.status, text);
		throw new Error(`API error: ${apiResponse.status}`);
	}

	return apiResponse.json();
}
