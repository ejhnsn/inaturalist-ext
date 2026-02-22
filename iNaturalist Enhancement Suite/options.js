function saveOptions() {
    const enableColorVision = document.getElementById('color-vision').checked;
    const colorDisplayMode = document.querySelector('input[name="color-display-mode"]:checked').value;
    const enableColorBlindMode = document.getElementById('color-blind').checked;
    const enableCVPercentages = document.getElementById('cv-percentages').checked;
    const enableScoreImageTools = document.getElementById('score-image-tools').checked;
    const scoreImagePosition = document.querySelector('input[name="score-image-position"]:checked').value;
    const scoreImageColor = document.querySelector('input[name="score-image-color"]:checked').value;
    const enableCount = document.getElementById('your-observations-count').checked;
    const enableCopyGeo = document.getElementById('copy-geocoordinates').checked;
    const enableIdentifierStats = document.getElementById('identifier-stats').checked;
    const enableLogging = document.getElementById('enable-logging').checked;
    chrome.storage.sync.set({
        enableColorVision,
        colorDisplayMode,
        enableColorBlindMode,
        enableCVPercentages,
        enableScoreImageTools,
        scoreImagePosition,
        scoreImageColor,
        enableCount,
        enableCopyGeo,
        enableIdentifierStats,
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
        enableColorBlindMode: false,
        enableCVPercentages: true,
        enableScoreImageTools: true,
        scoreImagePosition: 'below',
        scoreImageColor: 'outlined',
        enableCount: true,
        enableCopyGeo: true,
        enableIdentifierStats: true,
        enableLogging: false
    }, function(items) {
        document.getElementById('color-vision').checked = items.enableColorVision;
        document.getElementById('display-mode-' + items.colorDisplayMode).checked = true;
        document.getElementById('color-blind').checked = items.enableColorBlindMode;
        document.getElementById('cv-percentages').checked = items.enableCVPercentages;
        document.getElementById('score-image-tools').checked = items.enableScoreImageTools;
        document.getElementById('position-' + items.scoreImagePosition).checked = true;
        document.getElementById('color-' + items.scoreImageColor).checked = true;
        document.getElementById('enable-logging').checked = items.enableLogging;
        document.getElementById('your-observations-count').checked = items.enableCount;
        document.getElementById('copy-geocoordinates').checked = items.enableCopyGeo;
        document.getElementById('identifier-stats').checked = items.enableIdentifierStats;
        colorVisionFeature.dispatchEvent(new Event('change'));
        scoreImageFeature.dispatchEvent(new Event('change'));
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

function toggleScoreImageDisplay() {
    const features = document.getElementById('score-image-features');
    features.style.display = this.checked ? 'block' : 'none';
}
const scoreImageFeature = document.getElementById('score-image-tools');
scoreImageFeature.addEventListener('change', toggleScoreImageDisplay);

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);