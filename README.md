# TBI Static Tesseract OCR Pack — v4.12r673

This is the optional external OCR pack for Tower Battle Intel.

Host this folder as a separate GitHub Pages site, for example:

```text
https://yourname.github.io/tbi-ocr-static-tesseract/
```

Then point main TBI's Static OCR Pack provider at:

```text
https://yourname.github.io/tbi-ocr-static-tesseract/ocr-frame.html
```

## r673 region-hint OCR

This pack now honours main TBI's normalised OCR geometry hints. It can crop temporary child regions from the original screenshot at runtime, preprocess those regions, OCR them, and return a combined raw + region preview.

Target Priority now gets a focused text-column child region so Tesseract is not distracted by arrows, icons, borders and glow. Crops remain temporary children of the original screenshot and do not become independent truth sources.

Guardrails:

- Screenshots stay in the browser/plugin frame.
- No Account truth writes.
- No Runs saves.
- No persistent screenshot/blob/base64/raw-text storage by the pack.
- TBI must show OCR results for review before any confirm path.
- Geometry regions are normalised hints only; fixed-pixel-only truth is not allowed.
