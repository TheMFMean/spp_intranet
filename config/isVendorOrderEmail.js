// /srv/backend/config/isVendorOrderEmail.js
//
// Classifier that uses SaferVendorEmailConfig to decide whether a Gmail
// message is a vendor order lifecycle email and what status it represents.

import { saferVendorEmailConfig } from "./SaferVendorEmailConfig.js";

function normalize(str) {
    return (str || "").toLowerCase();
}

function anyIncludes(haystack, needles) {
    if (!haystack) return false;
    const h = normalize(haystack);
    return needles.some((n) => h.includes(n.toLowerCase()));
}

/**
 * Determine which vendor this message belongs to based on headers.
 *
 * @param {Object} meta
 * @param {string} meta.from
 * @param {string} meta.to
 * @returns {Object|null}
 */
function findVendorConfig(meta) {
    const from = normalize(meta.from || "");
    const to = normalize(meta.to || "");

    return (
        saferVendorEmailConfig.find((v) => {
            const fromMatch =
                Array.isArray(v.fromIncludes) &&
                v.fromIncludes.some((token) => from.includes(token.toLowerCase()));

            const toMatch =
                Array.isArray(v.toIncludes) &&
                v.toIncludes.some((token) => to.includes(token.toLowerCase()));

            return fromMatch && toMatch;
        }) || null
    );
}

/**
 * Detect lifecycle status from subject/body using vendor markers.
 *
 * @param {Object} vendor
 * @param {string} textBlob
 * @returns {string|null} status or null if none matched
 */
function detectStatus(vendor, textBlob) {
    const markers = vendor.lifecycleMarkers || {};

    // Priority order so "delivered" wins over "shipped" etc.
    const statusPriority = [
        "delivered",
        "out_for_delivery",
        "shipped",
        "canceled",
        "refunded",
        "confirmed",
    ];

    for (const status of statusPriority) {
        const phrases = markers[status] || [];
        if (phrases.length === 0) continue;
        const hit = phrases.some((p) => textBlob.includes(p.toLowerCase()));
        if (hit) {
            return status;
        }
    }

    return null;
}

/**
 * Classify a message as a vendor order email or noise.
 *
 * @param {Object} meta
 * @param {string} meta.from
 * @param {string} meta.to
 * @param {string} meta.subject
 * @param {string} bodyText - plain text body of the email
 * @returns {{
 *   isOrderEmail: boolean,
 *   vendorId: string|null,
 *   orderStatus: string|null
 * }}
 */
function classifyVendorOrderEmail(meta, bodyText) {
    const subject = meta.subject || "";
    const body = bodyText || "";

    const vendor = findVendorConfig(meta);

    if (!vendor) {
        return {
            isOrderEmail: false,
            vendorId: null,
            orderStatus: null,
        };
    }

    // Hard-ignore obvious marketing based on subject
    if (
        Array.isArray(vendor.ignoreIfSubjectIncludes) &&
        anyIncludes(subject, vendor.ignoreIfSubjectIncludes)
    ) {
        return {
            isOrderEmail: false,
            vendorId: vendor.vendorId,
            orderStatus: null,
        };
    }

    // Build a combined text blob for status detection
    const textBlob = `${subject}\n${body}`.toLowerCase();

    const detectedStatus = detectStatus(vendor, textBlob);

    if (!detectedStatus) {
        // If we see "order #" or "invoice #" in subject/body, treat as a generic
        // confirmed/transactional email even if no explicit phrase matched.
        const looksTransactional =
            textBlob.includes("order #") ||
            textBlob.includes("order no.") ||
            textBlob.includes("invoice #");

        if (!looksTransactional) {
            return {
                isOrderEmail: false,
                vendorId: vendor.vendorId,
                orderStatus: null,
            };
        }

        return {
            isOrderEmail: true,
            vendorId: vendor.vendorId,
            orderStatus: "confirmed",
        };
    }

    return {
        isOrderEmail: true,
        vendorId: vendor.vendorId,
        orderStatus: detectedStatus,
    };
}

export {
    classifyVendorOrderEmail,
};
