# CHANGELOG v4.12r674 — Static OCR Robust Region Runtime Hotfix

- Fixed `local-ocr-adapter.js` invalid-token syntax error from r673 newline literal generation.
- Added full-image preprocessed OCR baseline into normal one-shot preview path.
- Added Target Priority title/tight/wide region OCR attempts.
- Added thresholded high-contrast preprocessing for region crops.
- Kept all region OCR as temporary child hints of the original screenshot.
- No Account truth writes, Manual Value saves, screenshot persistence, raw OCR persistence or batch OCR activation.
