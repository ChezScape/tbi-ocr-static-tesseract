# Test Results — v4.12r673 Static OCR Region-Hint Runtime

## Static checks

- `local-ocr-adapter.js` syntax check: passed.
- `ocr-frame.html` message-forwarding inspection: passed.
- Manifest version updated to v4.12r673: passed.
- README guardrails updated: passed.

## Behaviour contract

- Full-image OCR is still run as baseline.
- Region OCR only runs when main TBI sends normalised geometry hints.
- Target Priority uses a derived text-column child region from the original screenshot.
- Region crops are temporary object URLs and are revoked after OCR.
- No storage writes are introduced.

## Manual browser validation needed

Upload this pack to the GitHub Pages OCR repository, then run one Target Priority screenshot from main TBI r672+. The raw preview should include region-derived Target Priority row text instead of only the weak full-image OCR lines.
