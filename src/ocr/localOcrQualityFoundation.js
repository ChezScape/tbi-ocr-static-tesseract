"use strict";

/**
 * TBI STATIC OCR PACK QUALITY SHIM v4.12r659
 *
 * Standalone browser-pack shim for the external Tesseract OCR pack.
 * Main TBI owns the full OCR quality foundation; the external pack only needs
 * temporary in-browser preprocessing hints and a minimal merged result object.
 * This file does not write storage, save screenshots, mutate Account truth, or
 * apply OCR corrections.
 */

export const LOCAL_OCR_QUALITY_FOUNDATION_VERSION = "v4.12r659-static-pack-shim";

export function createOcrQualityPreprocessPlan(source = {}, options = {}) {
  const screenType = normaliseText(options.screenType || source.screenType || source.sourceScreenType || "unknown") || "unknown";
  const variants = Object.freeze([
    Object.freeze({ key: "raw", label: "Raw screenshot", scale: 1, grayscale: false, contrast: 1, sharpen: false, threshold: "none", role: "baseline" }),
    Object.freeze({ key: "upscale-2x-contrast", label: "2x upscaled + contrast", scale: 2, grayscale: true, contrast: 1.25, sharpen: true, threshold: "soft", role: "general text cleanup" }),
    Object.freeze({ key: "upscale-3x-numeric", label: "3x numeric guard pass", scale: 3, grayscale: true, contrast: 1.35, sharpen: true, threshold: "soft-numeric", role: "small digits and suffix guard" })
  ]);
  return Object.freeze({
    version: LOCAL_OCR_QUALITY_FOUNDATION_VERSION,
    owner: "external-static-tesseract-pack/src/ocr/localOcrQualityFoundation.js",
    mode: "static-pack-ocr-quality-preprocess-plan",
    screenType,
    screenLabel: screenType,
    sourceId: normaliseText(source.id || source.sourceId || "runtime-source"),
    filename: normaliseText(source.filename || ""),
    preferredVariantKey: options.preferredVariantKey || "upscale-2x-contrast",
    variants,
    templateAwareScan: Object.freeze({
      enabled: false,
      screenType,
      zone: "external OCR pack temporary review image",
      cropHint: "Main TBI owns screen-specific review parsing. External pack returns OCR text only.",
      expectedCharacters: "mixed",
      cropCoordinatesStored: false,
      templateSource: "static-pack-shim"
    }),
    safeguards: createQualitySafetyFlags()
  });
}

export function createMergedOcrQualityReport(input = {}) {
  const rawText = normaliseOcrText(input.rawText || "");
  const processedText = normaliseOcrText(input.processedText || input.cleanedText || "");
  const bestSource = processedText && processedText.length > rawText.length * 0.75 ? "processed" : "raw";
  const bestText = bestSource === "processed" ? processedText : rawText;
  return Object.freeze({
    version: LOCAL_OCR_QUALITY_FOUNDATION_VERSION,
    owner: "external-static-tesseract-pack/src/ocr/localOcrQualityFoundation.js",
    mode: "static-pack-merged-ocr-quality-report",
    status: bestText ? "ocr-text-ready-for-review" : "no-ocr-text",
    label: bestText ? "OCR text is ready for TBI review" : "No OCR text returned",
    bestSource,
    bestText,
    rawText,
    processedText,
    needsHumanCheck: true,
    hasConflict: Boolean(rawText && processedText && rawText !== processedText),
    silentCorrectionAllowed: false,
    accountTruthWritten: false,
    storageWritesAllowed: false,
    safeguards: createQualitySafetyFlags()
  });
}

function createQualitySafetyFlags() {
  return Object.freeze({
    accountTruthWritesAllowed: false,
    manualValuesSaved: false,
    persistentMediaWritesAllowed: false,
    rawTextStoredPersistently: false,
    reviewRequiredBeforeTruth: true,
    screenshotsStayInBrowser: true
  });
}

function normaliseText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normaliseOcrText(value = "") {
  return String(value || "").replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
}
