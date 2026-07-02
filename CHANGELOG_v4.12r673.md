# v4.12r673 — Static OCR Region-Hint Runtime

Updates the external Static Tesseract OCR Pack so it can honour main TBI's normalised OCR geometry hints.

## Changed

- `ocr-frame.html` now forwards `geometryPlan`, `regions`, `expectedLabels`, `preprocessHints`, `sourceGeometry`, and `geometryPolicy` to the adapter.
- `local-ocr-adapter.js` now OCRs the full screenshot plus safe temporary child regions.
- Target Priority gets a focused text-column child region derived from the original screenshot so arrows/icons/glow do not dominate OCR.
- Region OCR remains runtime-only and returns review text only.

## Guardrails

- No Account truth writes.
- No Manual Value saves.
- No persistent screenshot/blob/base64/raw-text storage.
- Crops remain temporary children of the original screenshot.
- Main TBI still owns parser/catalogue clarification and final confirmation.
