function saveOptions() {
    var enableColorVision = document.getElementById('color-vision').checked;
    var colorDisplayMode = document.querySelector('input[name="color-display-mode"]:checked').value;
    var enableColorBlindMode = document.getElementById('color-blind').checked;
    chrome.storage.sync.set({
        enableColorVision: enableColorVision,
        colorDisplayMode: colorDisplayMode,
        enableColorBlindMode: enableColorBlindMode
    }, function() {
        var status = document.getElementById('status');
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
        colorVisionFeature.dispatchEvent(new Event('change'));
    });
}

function toggleColorVisionDisplay() {
    var features = document.getElementById('color-vision-features');
    alert(this);
    alert(this.checked);
    if (this.checked) {
        features.style.display = 'block';
    } else {
        features.style.display = 'none';
    }
}

var colorVisionFeature = document.getElementById('color-vision');
colorVisionFeature.addEventListener('change', toggleColorVisionDisplay);
document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);