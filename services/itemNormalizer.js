// /srv/backend/services/itemNormalizer.js
//
// SINGLE SOURCE OF TRUTH FOR ITEM NORMALIZATION
// ==============================================
// This module is the ONLY place where:
// 1. Item descriptions are normalized
// 2. Dummy SKUs (SPP-XXXXXX) are generated
// 3. internalSku values are assigned
//
// All vendor parser outputs MUST flow through normalizeItem() before
// being persisted to the database. This ensures that the same
// (vendorId, vendorOrderNumber, description) combination always
// resolves to the same internal SKU.
//
// DO NOT duplicate makeDummyCode() or SPP-XXXXXX generation elsewhere!
// ==============================================

import crypto from "crypto";

/**
 * Create a stable description fingerprint so the same line
 * always maps to the same dummy SKU.
 * 
 * Normalization rules:
 * - Convert to lowercase
 * - Collapse multiple spaces to single space
 * - Trim leading/trailing whitespace
 * 
 * @param {string} desc - Raw description text
 * @returns {string} Normalized fingerprint
 */
function fingerprintDescription(desc) {
    if (!desc) return "";
    return desc
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Turn a fingerprint into a 6-digit dummy code.
 * 
 * Uses SHA-1 hash to generate a stable numeric code from text.
 * The same input text will always produce the same 6-digit code.
 * 
 * Format: XXXXXX (6 digits, zero-padded)
 * 
 * @param {string} text - Fingerprint text
 * @returns {string} 6-digit code (e.g., "042315")
 */
function makeDummyCode(text) {
    const hash = crypto.createHash("sha1").update(text).digest("hex");
    const num = parseInt(hash.slice(0, 8), 16);
    return String(num % 1000000).padStart(6, "0");
}

/**
 * Normalize a single item from vendor parser output.
 * 
 * Priority for internalSku assignment:
 * 1. If internalSku already exists → preserve it
 * 2. If vendor_sku exists → generate SPP-XXXXXX from vendor_sku
 * 3. Otherwise → generate SPP-XXXXXX from description
 * 
 * This ensures stable SKU assignment where the same item description
 * or vendor SKU always maps to the same internal SKU.
 * 
 * @param {Object} rawItem - Raw item from vendor parser
 * @param {string} rawItem.description - Item description
 * @param {string} [rawItem.vendor_sku] - Vendor's SKU code
 * @param {string} [rawItem.internalSku] - Existing internal SKU (preserved if present)
 * @param {number} [rawItem.quantity] - Item quantity
 * @param {number} [rawItem.unitPrice] - Unit price
 * @param {number} [rawItem.lineTotal] - Line total
 * @param {string} vendorId - Vendor identifier (for context, not used in SKU generation)
 * @returns {Promise<Object>} Normalized item with internalSku assigned
 * 
 * @example
 * // With vendor SKU
 * normalizeItem({ description: "Gold Ring", vendor_sku: "GR-123" }, "cascade")
 * // → { description: "Gold Ring", vendor_sku: "GR-123", internalSku: "SPP-042315" }
 * 
 * @example
 * // Without vendor SKU (uses description)
 * normalizeItem({ description: "Silver Necklace" }, "oracle")
 * // → { description: "Silver Necklace", internalSku: "SPP-789456" }
 */
export async function normalizeItem(rawItem, vendorId) {
    const item = { ...rawItem };

    // Normalize description (trim whitespace)
    if (item.description) {
        item.description = String(item.description).trim();
    }

    // Priority 1: Preserve existing internalSku
    if (item.internalSku && String(item.internalSku).trim() !== "") {
        return item;
    }

    // Priority 2: Generate from vendor_sku if present
    if (item.vendor_sku && String(item.vendor_sku).trim() !== "") {
        const fp = fingerprintDescription(item.vendor_sku);
        item.internalSku = `SPP-${makeDummyCode(fp)}`;
        return item;
    }

    // Priority 3: Generate from description
    const base = item.description || "";
    const fp = fingerprintDescription(base);
    item.internalSku = `SPP-${makeDummyCode(fp)}`;
    return item;
}

/**
 * Export helper functions for testing purposes only.
 * DO NOT use these directly in production code - always use normalizeItem().
 */
export const __testing = {
    fingerprintDescription,
    makeDummyCode,
};
