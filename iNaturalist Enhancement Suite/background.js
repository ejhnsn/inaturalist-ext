// Background script for handling cross-origin image requests
//
// This is needed because static.inaturalist.org blocks CORS, so content scripts
// can't fetch images directly. The background script has elevated permissions
// via host_permissions in manifest.json to bypass this restriction.
//
// Note: Images on inaturalist-open-data.s3.amazonaws.com have permissive CORS
// and could be fetched directly from content scripts, but we use the background
// script for all image fetches for simplicity.

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === 'fetchImage') {
		fetchImageAsDataUrl(request.url)
			.then(dataUrl => sendResponse({ success: true, dataUrl }))
			.catch(error => sendResponse({ success: false, error: error.message }));
		return true; // Keep channel open for async response
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
