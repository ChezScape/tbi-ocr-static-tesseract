# TBI Static Tesseract OCR Pack — v4.12r674

This is the optional external OCR pack for Tower Battle Intel.

Host this folder as a separate GitHub Pages site, for example:

```text
https://yourname.github.io/tbi-ocr-static-tesseract/
```

Then point main TBI's Static OCR Pack provider at:

```text
https://yourname.github.io/tbi-ocr-static-tesseract/ocr-frame.html
```

## r674 robust region runtime

r674 fixes the r673 `local-ocr-adapter.js` syntax error caused by a broken newline literal in the region OCR merge block. The adapter now passes a Node syntax check before packaging.

Robustness improvements:

- full screenshot OCR remains the baseline;
- runtime preprocessed full-image OCR is merged as a second signal;
- normalised region hints are OCRed as temporary child crops;
- Target Priority receives title, tight row-label and wide row-label child regions;
- region crops use higher contrast and thresholding for glowing UI text;
- crop results remain mapped to the original screenshot and never become independent truth;
- OCR failures stay safe and return visible status instead of breaking the frame.

Guardrails:

- Screenshots stay in the browser/plugin frame.
- No Account truth writes.
- No Runs saves.
- No persistent screenshot/blob/base64/raw-text storage by the pack.
- TBI must show OCR results for review before any confirm path.
- Geometry regions are normalised hints only; fixed-pixel-only truth is not allowed.
