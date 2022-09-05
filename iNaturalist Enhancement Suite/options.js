function saveOptions() {
    const enableColorVision = document.getElementById('color-vision').checked;
    const colorDisplayMode = document.querySelector('input[name="color-display-mode"]:checked').value;
    const enableColorBlindMode = document.getElementById('color-blind').checked;
    const enableLogging = document.getElementById('enable-logging').checked;
    chrome.storage.sync.set({
        enableColorVision,
        colorDisplayMode,
        enableColorBlindMode,
        enableLogging
    }, function() {
        const status = document.getElementById('status');
        status.textContent = 'Options saved.';
        setTimeout(function() {
            status.textContent = '';
        }, 750);
    });
}
  
function restoreOptions() {
    chrome.storage.sync.get({
        enableColorVision: true,
        colorDisplayMode: 'sidebar',
        enableColorBlindMode: false
    }, function(items) {
        document.getElementById('color-vision').checked = items.enableColorVision;
        document.getElementById('display-mode-' + items.colorDisplayMode).checked = true;
        document.getElementById('color-blind').checked = items.enableColorBlindMode;
        document.getElementById('enable-logging').checked = items.enableLogging;
        colorVisionFeature.dispatchEvent(new Event('change'));
    });
}

function toggleColorVisionDisplay() {
    const features = document.getElementById('color-vision-features');
    if (this.checked) {
        features.style.display = 'block';
    } else {
        features.style.display = 'none';
    }
}

const colorVisionFeature = document.getElementById('color-vision');
colorVisionFeature.addEventListener('change', toggleColorVisionDisplay);
document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);