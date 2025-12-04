// /srv/backend/services/jtwParser.js
// Vendor: Jewelry This Way (JTW, LLC)

function normalizeText(text) {
    if (!text) return "";
    return text
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/\t/g, " ")
        .trim();
}

function parseMoney(value) {
    if (!value) return null;
    const cleaned = String(value).replace(/[^0-9.\-]/g, "");
    if (!cleaned) return null;
    const num = Number(cleaned);
    return Number.isNaN(num) ? null : num;
}

/**
 * Extract a numeric money value from the HTML totals block
 * by label: "Subtotal", "Shipping", "Taxes", "Total"
 */
function extractHtmlMoney(html, label) {
    if (!html) return null;
    const regex = new RegExp(
        `>${label}<[^>]*>[\\s\\S]*?<strong[^>]*>\\s*([^<]+)<`,
        "i"
    );
    const match = html.match(regex);
    if (!match) return null;
    return parseMoney(match[1]);
}

/**
 * Clean and normalize a Shopify item title for JTW.
 *
 * Goal example:
 *   "Gold Seam Rings - Cup and Divot - 14K Yellow Gold - 18g / 5/16\""
 *
 * Incoming example:
 *   "Gold Seam Rings - Cup and Divot - 14K Yellow Gold - Cup and Divot / 18g / 5/16&#34;"
 */
function cleanDescription(desc) {
    if (!desc) return "";

    let text = desc.trim();

    // Decode HTML entity quotes to real quotes
    text = text.replace(/&#34;|&quot;/g, '"');

    // Normalize whitespace
    text = text.replace(/\s+/g, " ").trim();

    // Split into dash segments:
    // [ product, style, metal, tail... ]
    const parts = text.split(" - ");

    if (parts.length >= 4) {
        const product = parts[0];
        const style = parts[1];
        const metal = parts[2];
        let tail = parts.slice(3).join(" - ");

        // If tail starts with the same style, drop that duplicate
        // "Cup and Divot / 18g / 5/16\"" -> "18g / 5/16\""
        const duplicatePrefix = style + " /";
        if (tail.startsWith(duplicatePrefix)) {
            tail = tail.slice(duplicatePrefix.length).trim();
        }

        text = `${product} - ${style} - ${metal} - ${tail}`;
    }

    // Clean up any stray spaces before a final quote
    text = text.replace(/\s+"$/g, '"');

    return text;
}

/**
 * Parse Shopify order list items from HTML.
 *
 * Each row looks like:
 * <tr class="order-list__item">
 *   ...
 *   <span class="order-list__item-title">16g ... 28mm × 1</span>
 *   ...
 *   <p class="order-list__item-price">$102.99</p>
 * </tr>
 */
function parseItemsFromHtml(html) {
    if (!html) return [];

    const items = [];
    const rowRegex = /<tr class="order-list__item"[\s\S]*?<\/tr>/gi;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(html)) !== null) {
        const rowHtml = rowMatch[0];

        const titleMatch = rowHtml.match(
            /class="order-list__item-title"[^>]*>([^<]+)<\/span>/i
        );
        if (!titleMatch) continue;

        let titleText = titleMatch[1]
            .replace(/\s+/g, " ")
            .trim();

        // Quantity from trailing "× 1" or "x 1"
        let quantity = 1;
        const qtyMatch = titleText.match(/[x×]\s*([0-9]+)\s*$/i);
        if (qtyMatch && qtyMatch[1]) {
            quantity = parseInt(qtyMatch[1], 10) || 1;
            titleText = titleText.replace(/[x×]\s*[0-9]+\s*$/i, "").trim();
        }

        // Price in the right cell
        const priceMatch = rowHtml.match(
            /class="order-list__item-price"[^>]*>\s*([^<]+)<\/p>/i
        );
        if (!priceMatch) continue;

        const lineTotal = parseMoney(priceMatch[1]);
        if (lineTotal == null) continue;

        const unitPrice =
            quantity && quantity > 0 ? lineTotal / quantity : lineTotal;

        const cleanedDescription = cleanDescription(titleText);

        items.push({
            vendor_sku: null,
            description: cleanedDescription,
            quantity,
            unitPrice,
            lineTotal,
        });
    }

    return items;
}

/**
 * Parse item lines from the "Items in this shipment" or similar sections
 * in JTW / Shopify shipping or delivery emails in the plain-text body.
 *
 * Example:
 *
 * Items in this shipment
 * ----------------------
 *
 * 16g 14KY 1.6mm Curb Chain - 28mm × 1
 *
 * 16g 14KY 1.6mm Curb Chain - 30mm × 1
 */
function parseShipmentItemsFromPlain(textPlain) {
    const items = [];
    if (!textPlain) return items;

    // Try multiple textual anchors
    const anchors = [
        /Items in this shipment/i,
        /Items in your shipment/i,
        /Items in this order/i,
        /Order summary/i,
    ];

    let markerIndex = -1;
    for (const anchor of anchors) {
        markerIndex = textPlain.search(anchor);
        if (markerIndex !== -1) break;
    }

    if (markerIndex === -1) return items;

    const section = textPlain.slice(markerIndex).split(/\r?\n/);

    let started = false;
    for (let rawLine of section) {
        let line = rawLine.replace(/\r/g, "").trim();
        if (!started) {
            // Start after finding any anchor
            if (/Items in (this|your) (shipment|order)|Order summary/i.test(line)) {
                started = true;
            }
            continue;
        }

        // Skip separators and blank lines
        if (!line || /^[-_]+$/.test(line)) continue;

        // Stop at footer or next section
        if (/^If you have any questions|^View your order|^Shipping address|^Customer information/i.test(line)) {
            break;
        }

        // Match 'description × 1', 'description x 1', or quoted-printable '=D7 1'
        const m = line.match(/^(.+?)\s*(?:x|×|=D7)\s*(\d+)\s*$/i);
        if (!m) continue;

        const description = cleanDescription(m[1].replace(/\s+/g, " ").trim());
        const qty = parseInt(m[2], 10) || 1;

        items.push({
            vendor_sku: null,
            description,
            quantity: qty,
            unitPrice: null,
            lineTotal: null,
        });

    }

    return items;
}

/**
 * Main entry point for Jewelry This Way orders.
 *
 * Returns the same shape as ISC / Glasswear so saveParsedOrder
 * can drop it into "Order" and "OrderItem" without special cases.
 */
export function parseJtwOrder({
    textHtml = "",
    textPlain = "",
    subject = "",
    date = "",
    orderStatus = null,
} = {}) {
    const html = normalizeText(textHtml || "");
    const text = normalizeText(textPlain || "");

    const result = {
        vendorId: "jtw",
        vendorName: "JTW, LLC",
        orderStatus: orderStatus || "other", // use passed status or default
        orderNumber: null,
        orderDate: null,
        subtotal: null,
        shipping: null,
        tax: null,
        total: null,
        currency: "USD",
        items: [],
    };

    const subj = subject || "";
    if (/Order\s*#\s*[A-Za-z0-9]+\s+confirmed/i.test(subj)) {
        result.orderStatus = "confirmed";
    } else if (/has been shipped/i.test(subj)) {
        result.orderStatus = "shipped";
    } else if (/out for delivery/i.test(subj)) {
        result.orderStatus = "out_for_delivery";
    } else if (/has been delivered/i.test(subj)) {
        result.orderStatus = "delivered";
    } else if (/has been canceled|has been cancelled/i.test(subj)) {
        result.orderStatus = "canceled";
    }

    // Order number from subject "Order #10750 confirmed"
    let orderNumber = null;
    if (subject) {
        const m = subject.match(/Order\s*#\s*([A-Za-z0-9]+)/i);
        if (m && m[1]) {
            orderNumber = m[1].trim();
        }
    }
    if (!orderNumber && (html || text)) {
        const m = (html || text).match(/Order\s*#\s*([A-Za-z0-9]+)/i);
        if (m && m[1]) {
            orderNumber = m[1].trim();
        }
    }
    result.orderNumber = orderNumber;

    if (date) {
        const d = new Date(date);
        if (!Number.isNaN(d.getTime())) {
            result.orderDate = d;
        }
    }

    // Totals from HTML (confirmation emails)
    if (html) {
        result.subtotal = extractHtmlMoney(html, "Subtotal");
        result.shipping = extractHtmlMoney(html, "Shipping");
        result.tax = extractHtmlMoney(html, "Taxes");
        result.total = extractHtmlMoney(html, "Total");
    }

    // Items: try HTML first (confirmation emails), then plain-text (shipment/delivery emails)
    let items = [];
    if (html) {
        items = parseItemsFromHtml(html);
    }
    // Always try plain-text if HTML didn't yield items
    if ((!items || !items.length) && text) {
        items = parseShipmentItemsFromPlain(text);
    }
    result.items = items;

    return result;
}

export default {
    parseJtwOrder,
};

/**
 * JTW Parser - Item Extraction Support
 * 
 * Supports item parsing for:
 * - confirmed: Extracts items with description, quantity, unitPrice, lineTotal from HTML order-list__item rows
 * - shipped: Extracts items with description, quantity (no prices) from "Items in this shipment" plain-text section
 * - out_for_delivery: Extracts items with description, quantity (no prices) from shipment section
 * - delivered: Extracts items with description, quantity (no prices) from shipment section
 * - canceled: Extracts items if present in email body
 * - refunded: Extracts items if present in email body
 * 
 * Note: JTW emails do not expose vendor SKU codes.
 * Description cleaning removes duplicate style prefixes and normalizes HTML entities.
 */
