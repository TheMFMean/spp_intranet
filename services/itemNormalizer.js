// /srv/backend/services/itemNormalizer.js

import crypto from "crypto";

/**
 * Create a stable description fingerprint so the same line
 * always maps to the same dummy SKU.
 */
function fingerprintDescription(desc) {
    if (!desc) return "";
    return desc
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Turn a fingerprint into a 6 digit dummy code.
 */
function makeDummyCode(text) {
    const hash = crypto.createHash("sha1").update(text).digest("hex");
    const num = parseInt(hash.slice(0, 8), 16);
    return String(num % 1000000).padStart(6, "0");
}

/**
 * Normalize a single item:
 * - keep any existing internalSku
 * - else derive internalSku from vendor_sku if present
 * - else derive from description
 *
 * This is deliberately pure. No DB calls, no Prisma here.
 */
export async function normalizeItem(rawItem, vendorId) {
    const item = { ...rawItem };

    if (item.internalSku && String(item.internalSku).trim() !== "") {
        return item;
    }

    if (item.vendor_sku && String(item.vendor_sku).trim() !== "") {
        const fp = fingerprintDescription(item.vendor_sku);
        item.internalSku = `SPP-${makeDummyCode(fp)}`;
        return item;
    }

    const base = item.description || "";
    const fp = fingerprintDescription(base);
    item.internalSku = `SPP-${makeDummyCode(fp)}`;
    return item;
}
