"use strict";

/**
 * TBI PACKAGED LOCAL OCR ADAPTER v4.12r673
 *
 * One-source raw + cleaned OCR preview adapter backed by locally packaged Tesseract.js
 * files. This adapter does not batch OCR, does not save Manual Values, does
 * not write account truth, does not permanently store screenshots/raw text,
 * and disables Tesseract language-data browser caching with cacheMethod:none.
 */

import TesseractModule from "./vendor/tesseract/tesseract.esm.min.js";
import {
    LOCAL_OCR_QUALITY_FOUNDATION_VERSION,
    createMergedOcrQualityReport,
    createOcrQualityPreprocessPlan
} from "./src/ocr/localOcrQualityFoundation.js";

const Tesseract = TesseractModule?.default || TesseractModule;

export const TBI_PACKAGED_LOCAL_OCR_ADAPTER_VERSION = "v4.12r673";
export const TBI_PACKAGED_LOCAL_OCR_ENGINE = Object.freeze({
    name: "TBI packaged Tesseract.js OCR",
    adapter: "local-ocr-adapter.js",
    tesseractJsVersion: "7.0.0",
    language: "eng",
    mode: "one-source-raw-plus-region-hint-preview-only",
    persistentWrites: false,
    cacheMethod: "none",
    batchOcrActive: false,
    accountTruthWritesAllowed: false,
    manualValuesSaved: false,
    permanentImageStorage: false,
    rawTextStoredPersistently: false
});

let workerPromise = null;

export async function previewRawText(payload = {}) {
    const safePayload = normalisePayload(payload);
    if (!safePayload.previewUrl) {
        return Object.freeze({
            rawText: "",
            status: "blocked-no-temporary-preview-url",
            message: "No temporary screenshot preview URL was supplied to the packaged OCR adapter."
        });
    }

    const worker = await getWorker();
    const rawResult = await worker.recognize(safePayload.previewUrl);
    const originalRawText = normaliseOcrText(rawResult?.data?.text || rawResult?.text || rawResult?.rawText || "");
    const regionPreview = await recogniseGeometryRegions(worker, safePayload, originalRawText);
    const rawText = mergeRawAndRegionText(originalRawText, regionPreview.regionText, safePayload.source.screenType);
    return Object.freeze({
        rawText,
        originalRawText,
        regionText: regionPreview.regionText,
        regionResults: regionPreview.regionResults,
        regionStatus: regionPreview.status,
        regionCount: regionPreview.regionResults.length,
        bestSource: regionPreview.regionText ? "geometry-regions-plus-raw" : "raw",
        engine: TBI_PACKAGED_LOCAL_OCR_ENGINE.name,
        adapterVersion: TBI_PACKAGED_LOCAL_OCR_ADAPTER_VERSION,
        source: safePayload.source,
        geometryPlan: createGeometryPlanSummary(safePayload),
        safety: createSafetyFlags()
    });
}

export async function previewQualityText(payload = {}) {
    const safePayload = normalisePayload(payload);
    if (!safePayload.previewUrl) {
        return Object.freeze({
            rawText: "",
            bestText: "",
            status: "blocked-no-temporary-preview-url",
            message: "No temporary screenshot preview URL was supplied to the packaged OCR adapter.",
            qualityPreview: createMergedOcrQualityReport({ source: safePayload.source, screenType: safePayload.source.screenType })
        });
    }

    const worker = await getWorker();
    const rawResult = await worker.recognize(safePayload.previewUrl);
    const rawText = normaliseOcrText(rawResult?.data?.text || rawResult?.text || rawResult?.rawText || "");
    let processedText = "";
    let processedUrl = "";
    let processedUrlOwned = false;
    let preprocessingStatus = "runtime-preprocess-not-run";

    try {
        const processed = await createRuntimePreprocessedImageUrl(safePayload.previewUrl, safePayload.source.screenType);
        processedUrl = processed?.url || "";
        processedUrlOwned = Boolean(processed?.objectUrlOwned);
        preprocessingStatus = processed?.status || (processedUrl ? "runtime-preprocess-ready" : "runtime-preprocess-unavailable");
        if (processedUrl) {
            const processedResult = await worker.recognize(processedUrl);
            processedText = normaliseOcrText(processedResult?.data?.text || processedResult?.text || processedResult?.rawText || "");
        }
    } catch (error) {
        preprocessingStatus = `runtime-preprocess-failed-safely:${normaliseOcrText(error?.message || String(error || "unknown"))}`;
    } finally {
        if (processedUrlOwned && processedUrl && typeof globalThis?.URL?.revokeObjectURL === "function") {
            try { globalThis.URL.revokeObjectURL(processedUrl); } catch (_) { /* temporary URL cleanup best effort */ }
        }
    }

    const qualityPreview = createMergedOcrQualityReport({
        source: safePayload.source,
        screenType: safePayload.source.screenType,
        rawText,
        processedText
    });

    return Object.freeze({
        rawText: qualityPreview.bestText || rawText || processedText,
        originalRawText: rawText,
        cleanedRawText: processedText,
        bestText: qualityPreview.bestText || rawText || processedText,
        bestSource: qualityPreview.bestSource || "raw",
        preprocessingStatus,
        engine: TBI_PACKAGED_LOCAL_OCR_ENGINE.name,
        adapterVersion: TBI_PACKAGED_LOCAL_OCR_ADAPTER_VERSION,
        qualityFoundationVersion: LOCAL_OCR_QUALITY_FOUNDATION_VERSION,
        source: safePayload.source,
        qualityPreview,
        safety: createSafetyFlags()
    });
}

export async function recognize(payload = {}) {
    return previewRawText(payload);
}

export async function recognise(payload = {}) {
    return previewRawText(payload);
}

export function getPackagedOcrAdapterStatus() {
    return Object.freeze({
        version: TBI_PACKAGED_LOCAL_OCR_ADAPTER_VERSION,
        owner: "local-ocr-adapter.js",
        mode: "packaged-local-tesseract-one-source-region-hint-preview",
        engine: TBI_PACKAGED_LOCAL_OCR_ENGINE,
        readyToLoad: true,
        workerCreated: Boolean(workerPromise),
        paths: Object.freeze({
            workerPath: makeUrl("./vendor/tesseract/worker.min.js"),
            corePath: makeUrl("./vendor/tesseract/core"),
            langPath: makeUrl("./vendor/tesseract/lang")
        }),
        safety: createSafetyFlags()
    });
}

async function getWorker() {
    if (!workerPromise) workerPromise = createPackagedWorker();
    return workerPromise;
}

async function createPackagedWorker() {
    const createWorker = Tesseract?.createWorker;
    if (typeof createWorker !== "function") {
        throw new TypeError("Packaged Tesseract createWorker export unavailable");
    }

    const worker = await createWorker("eng", 1, Object.freeze({
        workerPath: makeUrl("./vendor/tesseract/worker.min.js"),
        corePath: makeUrl("./vendor/tesseract/core"),
        langPath: makeUrl("./vendor/tesseract/lang"),
        gzip: true,
        cacheMethod: "none",
        workerBlobURL: false,
        logger: logTesseractProgress
    }));

    if (typeof worker?.setParameters === "function") {
        try {
            await worker.setParameters(Object.freeze({
                tessedit_pageseg_mode: "6",
                preserve_interword_spaces: "1"
            }));
        } catch (error) {
            console.warn("TBI packaged OCR parameter setup skipped", error);
        }
    }

    return worker;
}

async function createRuntimePreprocessedImageUrl(previewUrl = "", screenType = "unknown") {
    const plan = createOcrQualityPreprocessPlan({ previewUrl, screenType });
    const variant = plan.variants.find(item => item.key === plan.preferredVariantKey) || plan.variants[1] || plan.variants[0];
    if (!previewUrl || typeof globalThis?.document?.createElement !== "function") {
        return Object.freeze({ url: "", status: "runtime-preprocess-unavailable-no-canvas", objectUrlOwned: false, plan });
    }

    const image = await loadImageForCanvas(previewUrl);
    const naturalWidth = Number(image.naturalWidth || image.width || 0);
    const naturalHeight = Number(image.naturalHeight || image.height || 0);
    if (!naturalWidth || !naturalHeight) {
        return Object.freeze({ url: "", status: "runtime-preprocess-unavailable-no-image-size", objectUrlOwned: false, plan });
    }

    const scale = Math.max(1, Math.min(3, Number(variant.scale || 1)));
    const maxDimension = 4096;
    const targetWidth = Math.max(1, Math.min(maxDimension, Math.round(naturalWidth * scale)));
    const targetHeight = Math.max(1, Math.min(maxDimension, Math.round(naturalHeight * scale)));
    const canvas = globalThis.document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return Object.freeze({ url: "", status: "runtime-preprocess-unavailable-no-2d-context", objectUrlOwned: false, plan });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

    try {
        const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
        const data = imageData.data;
        const contrast = Math.max(1, Math.min(1.6, Number(variant.contrast || 1)));
        const factor = (259 * (contrast * 64 + 255)) / (255 * (259 - contrast * 64));
        for (let i = 0; i < data.length; i += 4) {
            const gray = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
            const boosted = Math.max(0, Math.min(255, Math.round(factor * (gray - 128) + 128)));
            data[i] = boosted;
            data[i + 1] = boosted;
            data[i + 2] = boosted;
        }
        ctx.putImageData(imageData, 0, 0);
    } catch (_) {
        return Object.freeze({ url: "", status: "runtime-preprocess-blocked-canvas-read", objectUrlOwned: false, plan });
    }

    const blob = await canvasToBlob(canvas);
    if (!blob || typeof globalThis?.URL?.createObjectURL !== "function") {
        return Object.freeze({ url: "", status: "runtime-preprocess-unavailable-no-blob-url", objectUrlOwned: false, plan });
    }
    return Object.freeze({ url: globalThis.URL.createObjectURL(blob), status: "runtime-preprocess-ready-temporary-object-url", objectUrlOwned: true, plan });
}

function loadImageForCanvas(src = "") {
    return new Promise((resolve, reject) => {
        const ImageCtor = globalThis?.Image;
        if (typeof ImageCtor !== "function") {
            reject(new TypeError("Image constructor unavailable"));
            return;
        }
        const image = new ImageCtor();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Temporary screenshot image could not be loaded for OCR preprocessing"));
        try { image.crossOrigin = "anonymous"; } catch (_) { /* object URLs do not need this */ }
        image.src = src;
    });
}

function canvasToBlob(canvas) {
    return new Promise(resolve => {
        if (typeof canvas?.toBlob === "function") {
            canvas.toBlob(blob => resolve(blob), "image/png");
            return;
        }
        resolve(null);
    });
}

function logTesseractProgress(message = {}) {
    if (!globalThis?.console || typeof console.debug !== "function") return;
    const status = String(message?.status || "").trim();
    const progress = Number.isFinite(Number(message?.progress)) ? Math.round(Number(message.progress) * 100) : null;
    if (status) console.debug(`[TBI OCR] ${status}${progress === null ? "" : ` ${progress}%`}`);
}

function normaliseRegionHint(region = {}) {
    if (!region || typeof region !== "object") return null;
    const rect = region.rect && typeof region.rect === "object" ? region.rect : region.normalisedRect || null;
    const x = Number(rect?.x);
    const y = Number(rect?.y);
    const w = Number(rect?.w);
    const h = Number(rect?.h);
    if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return null;
    return Object.freeze({
        id: String(region.id || region.key || `region-${Math.random().toString(36).slice(2)}`),
        label: String(region.label || region.id || "OCR region"),
        role: String(region.role || "text-region"),
        rect: Object.freeze({ x: clamp01(x), y: clamp01(y), w: clamp01(w), h: clamp01(h) }),
        preprocessHints: Object.freeze((Array.isArray(region.preprocessHints) ? region.preprocessHints : []).map(value => String(value || "").trim()).filter(Boolean)),
        coordinateSpace: String(region.coordinateSpace || "normalised-parent-source-image")
    });
}

async function recogniseGeometryRegions(worker, safePayload = {}, originalRawText = "") {
    if (!Array.isArray(safePayload.regions) || !safePayload.regions.length) {
        return Object.freeze({ status: "no-region-hints", regionText: "", regionResults: Object.freeze([]) });
    }
    if (typeof globalThis?.document?.createElement !== "function") {
        return Object.freeze({ status: "region-ocr-unavailable-no-canvas", regionText: "", regionResults: Object.freeze([]) });
    }
    const plannedRegions = createRuntimeRegionPlan(safePayload, originalRawText);
    if (!plannedRegions.length) {
        return Object.freeze({ status: "no-safe-text-regions", regionText: "", regionResults: Object.freeze([]) });
    }
    let image;
    try {
        image = await loadImageForCanvas(safePayload.previewUrl);
    } catch (error) {
        return Object.freeze({ status: `region-ocr-unavailable-image-load:${normaliseOcrText(error?.message || String(error || "unknown"))}`, regionText: "", regionResults: Object.freeze([]) });
    }
    const regionResults = [];
    for (const region of plannedRegions) {
        let objectUrl = "";
        try {
            const processed = await createRegionPreprocessedImageUrl(image, region, safePayload.source.screenType);
            objectUrl = processed?.url || "";
            if (!objectUrl) {
                regionResults.push(Object.freeze({ id: region.id, label: region.label, status: processed?.status || "region-preprocess-unavailable", rawText: "", text: "" }));
                continue;
            }
            const result = await worker.recognize(objectUrl);
            const text = normaliseOcrText(result?.data?.text || result?.text || result?.rawText || "");
            regionResults.push(Object.freeze({
                id: region.id,
                label: region.label,
                role: region.role,
                status: text ? "region-ocr-text-ready" : "region-ocr-empty",
                rawText: text,
                text,
                rect: region.rect,
                preprocessHints: region.preprocessHints,
                expectedLabelMatches: Object.freeze(matchExpectedLabels(text, safePayload.expectedLabels)),
                sourceStaysParent: true,
                persistentWrites: false
            }));
        } catch (error) {
            regionResults.push(Object.freeze({ id: region.id, label: region.label, status: "region-ocr-failed-safely", error: normaliseOcrText(error?.message || String(error || "unknown")), rawText: "", text: "" }));
        } finally {
            if (objectUrl && typeof globalThis?.URL?.revokeObjectURL === "function") {
                try { globalThis.URL.revokeObjectURL(objectUrl); } catch (_) { /* temporary URL cleanup best effort */ }
            }
        }
    }
    const regionText = normaliseOcrText(regionResults
        .filter(result => result.text)
        .map(result => `${result.label || result.id}
${result.text}`)
        .join("
"));
    return Object.freeze({
        status: regionText ? "region-ocr-text-ready" : "region-ocr-empty",
        regionText,
        regionResults: Object.freeze(regionResults)
    });
}

function createRuntimeRegionPlan(safePayload = {}, originalRawText = "") {
    const screenType = String(safePayload.source?.screenType || "").toLowerCase();
    const provided = (Array.isArray(safePayload.regions) ? safePayload.regions : []).filter(isUsefulOcrRegion);
    const regions = [];
    if (screenType === "target-priority" || /target\s+priority/i.test(originalRawText)) {
        // The full Target Priority modal is noisy: arrows/icons/glow confuse OCR.
        // Use a child crop of the original screenshot that focuses the text column only.
        regions.push(Object.freeze({
            id: "target-priority-text-column-derived",
            label: "Target Priority row text column",
            role: "text-region",
            rect: Object.freeze({ x: 0.32, y: 0.16, w: 0.48, h: 0.78 }),
            preprocessHints: Object.freeze(["row-labels", "high-contrast-ui-text", "ignore-arrows-icons", "catalogue-match"]),
            coordinateSpace: "normalised-parent-source-image",
            derivedFrom: "target-priority-row-labels"
        }));
    }
    for (const region of provided) {
        if (!regions.some(item => item.id === region.id)) regions.push(region);
    }
    return regions.slice(0, screenType === "target-priority" ? 4 : 5);
}

function isUsefulOcrRegion(region = {}) {
    const id = String(region.id || "").toLowerCase();
    const role = String(region.role || "").toLowerCase();
    const hints = (Array.isArray(region.preprocessHints) ? region.preprocessHints : []).join(" ").toLowerCase();
    if (/shape|manual|reference|context|full-modal/.test(id) || /shape|manual/.test(role)) return false;
    if (/shape-check|manual-review|no-account-truth/.test(hints)) return false;
    return /title|label|value|row|table|text|numeric|catalogue|slot|count|bonus|level|timer/.test(`${id} ${role} ${hints}`);
}

async function createRegionPreprocessedImageUrl(image, region = {}, screenType = "unknown") {
    const naturalWidth = Number(image.naturalWidth || image.width || 0);
    const naturalHeight = Number(image.naturalHeight || image.height || 0);
    if (!naturalWidth || !naturalHeight) return Object.freeze({ url: "", status: "region-preprocess-unavailable-no-image-size" });
    const rect = region.rect || {};
    const sx = Math.max(0, Math.min(naturalWidth - 1, Math.round(Number(rect.x || 0) * naturalWidth)));
    const sy = Math.max(0, Math.min(naturalHeight - 1, Math.round(Number(rect.y || 0) * naturalHeight)));
    const sw = Math.max(1, Math.min(naturalWidth - sx, Math.round(Number(rect.w || 0) * naturalWidth)));
    const sh = Math.max(1, Math.min(naturalHeight - sy, Math.round(Number(rect.h || 0) * naturalHeight)));
    const hints = (Array.isArray(region.preprocessHints) ? region.preprocessHints : []).join(" ").toLowerCase();
    const isTargetPriority = String(screenType || "").toLowerCase() === "target-priority" || String(region.id || "").includes("target-priority");
    const scale = isTargetPriority || /row|label|catalogue|small|numeric/.test(hints) ? 3 : 2;
    const contrast = isTargetPriority ? 2.1 : /numeric|small/.test(hints) ? 1.65 : 1.45;
    const maxDimension = 4096;
    const targetWidth = Math.max(1, Math.min(maxDimension, Math.round(sw * scale)));
    const targetHeight = Math.max(1, Math.min(maxDimension, Math.round(sh * scale)));
    const canvas = globalThis.document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return Object.freeze({ url: "", status: "region-preprocess-unavailable-no-2d-context" });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
    try {
        const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
        const data = imageData.data;
        const factor = (259 * (contrast * 64 + 255)) / (255 * (259 - contrast * 64));
        for (let i = 0; i < data.length; i += 4) {
            const gray = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
            const boosted = Math.max(0, Math.min(255, Math.round(factor * (gray - 128) + 128)));
            data[i] = boosted;
            data[i + 1] = boosted;
            data[i + 2] = boosted;
        }
        ctx.putImageData(imageData, 0, 0);
    } catch (_) {
        return Object.freeze({ url: "", status: "region-preprocess-blocked-canvas-read" });
    }
    const blob = await canvasToBlob(canvas);
    if (!blob || typeof globalThis?.URL?.createObjectURL !== "function") return Object.freeze({ url: "", status: "region-preprocess-unavailable-no-blob-url" });
    return Object.freeze({ url: globalThis.URL.createObjectURL(blob), status: "region-preprocess-ready-temporary-object-url" });
}

function mergeRawAndRegionText(originalRawText = "", regionText = "", screenType = "unknown") {
    const raw = normaliseOcrText(originalRawText);
    const regions = normaliseOcrText(regionText);
    if (!regions) return raw;
    if (!raw) return regions;
    const screen = String(screenType || "").toLowerCase();
    if (screen === "target-priority") return normaliseOcrText(`${raw}
${regions}`);
    return normaliseOcrText(`${raw}
${regions}`);
}

function matchExpectedLabels(text = "", expectedLabels = []) {
    const clean = normaliseComparable(text);
    return (Array.isArray(expectedLabels) ? expectedLabels : [])
        .filter(label => {
            const key = normaliseComparable(label);
            return key && (clean.includes(key) || clean.includes(key.replace(/s$/, "")));
        })
        .slice(0, 24);
}

function createGeometryPlanSummary(safePayload = {}) {
    const plan = safePayload.geometryPlan || null;
    return Object.freeze({
        version: plan?.version || "v4.12r673-static-pack-region-runtime",
        familyKey: plan?.familyKey || safePayload.source?.screenType || "unknown",
        familyLabel: plan?.familyLabel || safePayload.source?.screenLabel || "Screenshot",
        coordinateSpace: plan?.coordinateSpace || "normalised-parent-source-image",
        regionCount: Array.isArray(safePayload.regions) ? safePayload.regions.length : 0,
        expectedLabelCount: Array.isArray(safePayload.expectedLabels) ? safePayload.expectedLabels.length : 0,
        sourceStaysParent: true,
        persistentWrites: false
    });
}

function normaliseComparable(value = "") {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function clamp01(value) {
    const number = Number(value || 0);
    return Math.max(0, Math.min(1, Number(number.toFixed(4))));
}

function normalisePayload(payload = {}) {
    const geometryPlan = payload?.geometryPlan && typeof payload.geometryPlan === "object" ? payload.geometryPlan : null;
    const sourceGeometry = payload?.sourceGeometry && typeof payload.sourceGeometry === "object" ? payload.sourceGeometry : geometryPlan?.sourceGeometry || null;
    const regions = Array.isArray(payload?.regions) ? payload.regions : Array.isArray(geometryPlan?.regions) ? geometryPlan.regions : [];
    const expectedLabels = Array.isArray(payload?.expectedLabels) ? payload.expectedLabels : Array.isArray(geometryPlan?.expectedLabels) ? geometryPlan.expectedLabels : [];
    const screenType = String(payload?.source?.screenType || payload?.screenFamily || geometryPlan?.familyKey || "");
    return Object.freeze({
        source: Object.freeze({
            id: String(payload?.source?.id || ""),
            filename: String(payload?.source?.filename || ""),
            screenType,
            screenLabel: String(payload?.source?.screenLabel || payload?.screenLabel || geometryPlan?.familyLabel || "")
        }),
        previewUrl: String(payload?.previewUrl || ""),
        mode: "raw-text-preview-only",
        saveTruth: false,
        storageWritesAllowed: false,
        accountTruthWritesAllowed: false,
        persistentWrites: false,
        batchOcrActive: false,
        qualityPreprocessRequested: payload?.qualityPreprocessRequested !== false,
        geometryPlan,
        regions: Object.freeze(regions.map(normaliseRegionHint).filter(Boolean)),
        expectedLabels: Object.freeze(expectedLabels.map(value => String(value || "").trim()).filter(Boolean)),
        preprocessHints: Object.freeze((Array.isArray(payload?.preprocessHints) ? payload.preprocessHints : []).map(value => String(value || "").trim()).filter(Boolean)),
        sourceGeometry: sourceGeometry ? Object.freeze({
            width: Number(sourceGeometry.width || 0),
            height: Number(sourceGeometry.height || 0),
            aspectRatio: Number(sourceGeometry.aspectRatio || 0),
            hasRuntimeDimensions: Boolean(sourceGeometry.hasRuntimeDimensions)
        }) : null,
        geometryPolicy: payload?.geometryPolicy && typeof payload.geometryPolicy === "object" ? payload.geometryPolicy : null
    });
}

function normaliseOcrText(value = "") {
    return String(value || "")
        .replace(/\r\n/g, "\n")
        .replace(/[\t ]+\n/g, "\n")
        .trim();
}

function makeUrl(path = "") {
    return new URL(path, import.meta.url).href;
}

function createSafetyFlags() {
    return Object.freeze({
        oneSourcePreviewOnly: true,
        runtimeOnly: true,
        persistentWrites: false,
        cacheMethod: "none",
        permanentImageStorage: false,
        rawTextStoredPersistently: false,
        accountTruthWritesAllowed: false,
        manualValuesSaved: false,
        draftValuesAutoSaved: false,
        batchOcrActive: false,
        silentOverwriteAllowed: false,
        userConfirmationRequiredBeforeTruth: true
    });
}

export const adapter = Object.freeze({
    version: TBI_PACKAGED_LOCAL_OCR_ADAPTER_VERSION,
    engine: TBI_PACKAGED_LOCAL_OCR_ENGINE,
    previewRawText,
    previewQualityText,
    recognize,
    recognise,
    getStatus: getPackagedOcrAdapterStatus
});

if (globalThis) {
    globalThis.TBI_PACKAGED_LOCAL_OCR_ADAPTER = adapter;
    if (!globalThis.TBI_LOCAL_OCR_ADAPTER) globalThis.TBI_LOCAL_OCR_ADAPTER = adapter;
}

export default adapter;
