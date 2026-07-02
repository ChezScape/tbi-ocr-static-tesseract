# TBI Local OCR Engine Third-Party Notices

This folder contains the local OCR engine files used by the optional TBI packaged OCR adapter.

- `tesseract.js` 7.0.0 — Apache-2.0 license. See `TESSERACT_JS_LICENSE.md`.
- `tesseract.js-core` 7.0.0 — Apache-2.0 license. See `TESSERACT_JS_CORE_LICENSE.txt`.
- English `eng.traineddata.gz` from `@tesseract.js-data/eng` 1.0.0 — package license MIT.

TBI uses these files locally for one-source raw OCR preview. The adapter is not allowed to batch OCR, silently save values, overwrite existing Manual Values, or store screenshot/raw-text/image/blob/base64 payloads permanently.
