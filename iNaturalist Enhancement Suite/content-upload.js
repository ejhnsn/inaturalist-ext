// Locale-dependent values that domContext.js (running in the page's main
// world) reads from window.I18n once it has loaded, then broadcasts. We
// register the listener synchronously at script load — before the async
// chrome.storage.sync.get below — so we don't miss the event.
const inatExtI18n = { timeHours: '' };
document.addEventListener('inatExtI18n', e => {
	if (e.detail && typeof e.detail.timeHours === 'string') {
		inatExtI18n.timeHours = e.detail.timeHours;
	}
});

chrome.storage.sync.get({
	enableCopyGeo: true,
	enableFilenameDate: true,
	enableLogging: false
}, function(items) {
	const logDebug = window.iNatLogDebug || console.debug;
	const log = window.iNatLog || console.log;

	logDebug('Settings loaded:', items);

	if (items.enableCopyGeo) {
		document.arrive('div.GooglePlacesAutocomplete > input[type="text"]', input => {
			input.addEventListener('paste', e => {
				const pasted = e.clipboardData.getData('Text');
				const matches = pasted.match(/(\-?\d+\.\d+),\s*(\-?\d+\.\d+)/);
				if (matches && matches.length === 3) {
					const lat = matches[1];
					const long = matches[2];
					for (const label of document.querySelectorAll('.label-text')) {
						if (label.innerHTML === 'Latitude' || label.innerHTML === 'Longitude') {
							const labelInput = label.parentNode.querySelector('input');
							const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
							setter.call(labelInput, label.innerHTML === 'Latitude' ? lat : long);
							labelInput.dispatchEvent(new Event('input', { bubbles: true }));
						}
					}
				}
			});
		});
	}

	if (items.enableFilenameDate) {
		setupFilenameDate(log, logDebug);
	}
});

// Auto-populate the Date field on a new ObsCard from an audio filename when the
// filename embeds a recognizable timestamp (e.g. "20260509 0007 Burbank CA.m4a",
// "REC_20260509_0007.wav", "2026-05-09T00:07.m4a"). iNat's uploader does not
// extract date from audio files (DroppedFile.readExif only handles EXIF, which
// audio doesn't have), so this fills that gap for users whose recorders embed
// a timestamp in the filename.
function setupFilenameDate(log, logDebug) {
	// Match an embedded timestamp anywhere in the text. We can't rely on a
	// non-digit boundary before the year because the Sound component renders
	// the audio duration ("00:00") immediately adjacent to the filename with
	// no separator, so the character before the year is often a digit. Instead,
	// each component is constrained to its valid range — that alone is strict
	// enough to avoid coincidental matches in concatenated digit runs.
	//
	//   year:   1900-2099           [12]\d{3}
	//   month:  01-12               0[1-9]|1[0-2]
	//   day:    01-31               0[1-9]|[12]\d|3[01]
	//   hour:   00-23               [01]\d|2[0-3]
	//   minute/second: 00-59        [0-5]\d
	//
	// Date and time may be joined by space, underscore, dash, or `T`. Within
	// the date, separators may be `-` or `_`. Within the time, `:` or `_`.
	const FILENAME_REGEX = /([12]\d{3})[-_]?(0[1-9]|1[0-2])[-_]?(0[1-9]|[12]\d|3[01])[T _\-]+([01]\d|2[0-3])[:_]?([0-5]\d)(?:[:_]?([0-5]\d))?/;

	function pad(n) { return n < 10 ? '0' + n : '' + n; }

	function parseFilenameForDate(text) {
		const m = text.match(FILENAME_REGEX);
		if (!m) return null;
		const year = parseInt(m[1], 10);
		const month = parseInt(m[2], 10);
		const day = parseInt(m[3], 10);
		const hour = parseInt(m[4], 10);
		const minute = parseInt(m[5], 10);
		const second = m[6] ? parseInt(m[6], 10) : 0;
		// Sanity-check ranges to avoid populating with a coincidental digit run.
		if (year < 1900 || year > 2100) return null;
		if (month < 1 || month > 12) return null;
		if (day < 1 || day > 31) return null;
		if (hour > 23 || minute > 59 || second > 59) return null;
		return { year, month, day, hour, minute, second };
	}

	// iNat picks 12-hour vs 24-hour in models/util.js parsableDatetimeFormat()
	// by feeding the *current* moment through I18n.t('momentjs.time_hours') and
	// checking if the rendered output contains AM/PM. We can't render through
	// moment from the isolated world, so we detect from the template directly:
	// moment uses lowercase `h` as the 12-hour hour token and uppercase `H` as
	// the 24-hour token, so the presence of `h` means 12-hour. The template
	// itself is read in domContext.js (main world) and pushed to us via the
	// `inatExtI18n` event; see the listener at the top of this file.
	function isLocale12Hour() {
		return inatExtI18n.timeHours.indexOf('h') !== -1;
	}

	function formatForDateInput(parts) {
		const datePart = `${parts.year}/${pad(parts.month)}/${pad(parts.day)}`;
		if (isLocale12Hour()) {
			const ampm = parts.hour >= 12 ? 'PM' : 'AM';
			let h12 = parts.hour % 12;
			if (h12 === 0) h12 = 12;
			return `${datePart} ${h12}:${pad(parts.minute)} ${ampm}`;
		}
		return `${datePart} ${pad(parts.hour)}:${pad(parts.minute)}`;
	}

	function findDateInput(card) {
		const groups = card.querySelectorAll('.caption .input-group');
		for (const group of groups) {
			const addon = group.querySelector('.input-group-addon');
			if (addon && addon.querySelector('.glyphicon-calendar')) {
				return group.querySelector('input[type="text"]');
			}
		}
		return null;
	}

	function setInputValue(input, value) {
		const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
		setter.call(input, value);
		input.dispatchEvent(new Event('input', { bubbles: true }));
	}

	document.arrive('.soundDrag', { existing: true }, sound => {
		const card = sound.closest('.cellDropzone');
		if (!card) return;

		const text = sound.textContent || '';
		const parts = parseFilenameForDate(text);
		if (!parts) {
			logDebug('No datetime pattern in audio filename:', text.trim());
			return;
		}

		// The Date input is rendered alongside .soundDrag, but be tolerant of
		// React render ordering: poll briefly until the input shows up.
		let attempts = 0;
		const maxAttempts = 30;
		const tick = setInterval(() => {
			attempts++;
			const input = findDateInput(card);
			if (!input) {
				if (attempts >= maxAttempts) {
					clearInterval(tick);
					logDebug('Date input not found in card after', attempts, 'attempts');
				}
				return;
			}
			clearInterval(tick);

			if (input.value && input.value.trim() !== '') {
				logDebug('Date input already populated, skipping:', input.value);
				return;
			}

			const formatted = formatForDateInput(parts);
			log('Populated date from audio filename:', text.trim(), '->', formatted);
			setInputValue(input, formatted);
		}, 50);
	});
}
