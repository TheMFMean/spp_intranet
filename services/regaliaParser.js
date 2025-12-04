// /srv/backend/services/regaliaParser.js
// Vendor: Regalia Jewelry (Shopify)

function normalizeMoney(value) {
    if (!value) return null;
    const cleaned = String(value).replace(/[^0-9.\-]/g, "");
    if (!cleaned) return null;
    const num = Number(cleaned);
    return Number.isNaN(num) ? null : num;
}

function normalizeInt(value) {
    if (!value) return null;
    const cleaned = String(value).replace(/[^0-9\-]/g, "");
    if (!cleaned) return null;
    const num = parseInt(cleaned, 10);
    return Number.isNaN(num) ? null : num;
}

// Strip trailing "Ready to Ship" noise from titles
function cleanTitle(title) {
    if (!title) return "";
    let t = title.trim();

    t = t.replace(/\s*-\s*Ready\s+to\s+Ship\s*$/i, "");
    t = t.replace(/\s*Ready\s+to\s+Ship\s*$/i, "");

    return t.trim();
}

// Remove trailing discount patterns like "(-$80.00)" from description text
function stripDiscountFromDescription(text) {
    if (!text) return text;
    return text.replace(/\s*\(-\s*\$[0-9.,]+\)\s*$/i, "").trim();
}

// Extract a money value from the HTML totals table
function extractHtmlMoney(html, label) {
    if (!html) return null;
    const regex = new RegExp(
        `>${label}<[^>]*>[\\s\\S]*?<strong[^>]*>\\s*([^<]+)<`,
        "i"
    );
    const match = html.match(regex);
    if (!match) return null;
    return normalizeMoney(match[1]);
}

// ---------------------
// HTML item parsing
// ---------------------

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

        let titleText = titleMatch[1].replace(/\s+/g, " ").trim();

        // qty from "× N"
        let quantity = 1;
        const qtyMatch = titleText.match(/[x×]\s*([0-9]+)\s*$/i);
        if (qtyMatch && qtyMatch[1]) {
            quantity = normalizeInt(qtyMatch[1]) || 1;
            titleText = titleText.replace(/[x×]\s*[0-9]+\s*$/i, "").trim();
        }

        // strip Ready to Ship
        titleText = cleanTitle(titleText);

        const variantMatch = rowHtml.match(
            /class="order-list__item-variant"[^>]*>([^<]+)<\/span>/i
        );
        const variant = variantMatch
            ? variantMatch[1].replace(/\s+/g, " ").trim()
            : null;

        let description = variant ? `${titleText} - ${variant}` : titleText;

        const discountMatch = rowHtml.match(
            /order-list__item-discount-allocation[\s\S]*?\((-[^()]+)\)/i
        );
        const discountTotal = discountMatch
            ? Math.abs(normalizeMoney(discountMatch[1]))
            : null;

        const retailMatch = rowHtml.match(
            /class="order-list__item-original-price"[^>]*>\s*([^<]+)<\/del>/i
        );
        const retailLineTotal = retailMatch
            ? normalizeMoney(retailMatch[1])
            : null;

        const netMatch = rowHtml.match(
            /class="order-list__item-price"[^>]*>\s*([^<]+)<\/p>/i
        );
        const netLineTotal = netMatch ? normalizeMoney(netMatch[1]) : null;

        let unitPrice = null;
        if (quantity && quantity > 0 && netLineTotal != null) {
            unitPrice = netLineTotal / quantity;
        }

        if (netLineTotal == null && retailLineTotal == null) {
            continue;
        }

        description = stripDiscountFromDescription(description);

        items.push({
            vendor_sku: null,
            description,
            quantity,
            unitPrice,
            lineTotal: netLineTotal,
            retailLineTotal,
            discountTotal,
        });
    }

    return items;
}

// ---------------------
// Text fallback
// ---------------------

function parseItemsFromText(text) {
    if (!text) return [];

    const items = [];

    // Try multiple textual anchors for shipment/delivery emails
    const anchors = [
        /Items in this shipment/i,
        /Items in your shipment/i,
        /Items in this order/i,
        /Order summary/i,
    ];

    let itemsSection = null;
    for (const anchor of anchors) {
        const match = text.match(new RegExp(`${anchor.source}\\s*-*\\s*([\\s\\S]*?)(?:Subtotal|Shipping address|Customer information|View your order|If you have any questions|$)`, 'i'));
        if (match && match[1]) {
            itemsSection = match[1];
            break;
        }
    }

    if (itemsSection) {
        const lines = itemsSection
            .split(/\r?\n/)
            .map(l => l.trim())
            .filter(l => l.length > 0);

        for (const line of lines) {
            // Skip separators
            if (/^[-–=]+$/.test(line)) continue;

            // Match: "Description × Quantity" or "Description x Quantity" or "Description =D7 Quantity"
            const m = line.match(/^(.+?)\s*(?:[xX×]|=D7)\s*(\d+)\s*$/);
            if (!m) continue;

            let description = cleanTitle(m[1].replace(/\s+/g, " ").trim());
            description = stripDiscountFromDescription(description);
            const quantity = normalizeInt(m[2]) || 1;

            items.push({
                vendor_sku: null,
                description,
                quantity,
                unitPrice: null,
                lineTotal: null,
                retailLineTotal: null,
                discountTotal: null,
            });
        }

        return items;
    }

    // Fallback: original complex parsing for confirmation emails
    const rawLines = text.split(/\r?\n/);
    const lines = rawLines.map((l) => l.trim());

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        const titleMatch = line.match(/^(.+?)\s*[x×]\s*([0-9]+)\s*$/i);
        if (!titleMatch) continue;

        let baseTitle = titleMatch[1].trim();
        const quantity = normalizeInt(titleMatch[2]) || 1;

        if (i > 0) {
            const prev = lines[i - 1];
            if (
                prev &&
                !/^(\$|WS|Order summary|Subtotal|Shipping|Taxes|Total)/i.test(prev) &&
                !/^Thank you/i.test(prev) &&
                !/^Visit your order/i.test(prev) &&
                !/\(-\s*\$[0-9.,]+\)/.test(prev) &&
                !/-\s*\$[0-9.,]+/.test(prev)
            ) {
                baseTitle = `${prev} ${baseTitle}`.replace(/\s+/g, " ").trim();
                lines[i - 1] = "";
            }
        }

        baseTitle = cleanTitle(baseTitle);

        let variant = null;
        let retailLineTotal = null;
        let netLineTotal = null;

        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
            const l = lines[j];
            if (!l) continue;

            if (/^WS$/i.test(l)) continue;
            if (/\(-\s*\$[0-9.,]+\)/.test(l) || /-\s*\$[0-9.,]+/.test(l)) continue;

            if (
                !variant &&
                !/^(\$|Order summary|Subtotal|Shipping|Taxes|Total)/i.test(l) &&
                !/^Thank you/i.test(l) &&
                !/^Visit our store/i.test(l)
            ) {
                variant = l;
                continue;
            }

            if (l.startsWith("$")) {
                const money = normalizeMoney(l);
                if (money != null) {
                    if (retailLineTotal == null) {
                        retailLineTotal = money;
                    } else if (netLineTotal == null) {
                        netLineTotal = money;
                        break;
                    }
                }
            }
        }

        if (retailLineTotal == null && netLineTotal == null) {
            continue;
        }

        let unitPrice = null;
        if (quantity && quantity > 0 && netLineTotal != null) {
            unitPrice = netLineTotal / quantity;
        }

        let description = variant ? `${baseTitle} - ${variant}` : baseTitle;
        description = stripDiscountFromDescription(description);

        items.push({
            vendor_sku: null,
            description,
            quantity,
            unitPrice,
            lineTotal: netLineTotal,
            retailLineTotal,
            discountTotal: null,
        });
    }

    return items;
}

// ---------------------
// Main entry
// ---------------------

export function parseRegaliaOrder({
    textPlain = "",
    textHtml = "",
    subject = "",
    date = null,
    orderStatus = null,
} = {}) {
    const html = textHtml || "";
    const text = textPlain || "";

    // event type - use passed status or derive from subject
    let finalStatus = orderStatus || "other";
    const subj = subject || "";
    if (!orderStatus) {
        if (/Receipt for order/i.test(subj) || /Order\s*#\s*[0-9]+/i.test(subj)) {
            finalStatus = "confirmed";
        }
    }

    // order number
    let orderNumber = null;

    const subjectMatch = subj.match(/Order\s*#\s*([0-9]+)/i);
    if (subjectMatch && subjectMatch[1]) {
        orderNumber = subjectMatch[1].trim();
    }

    if (!orderNumber && (html || text)) {
        const bodyMatch = (html || text).match(/Order\s*#\s*([0-9]+)/i);
        if (bodyMatch && bodyMatch[1]) {
            orderNumber = bodyMatch[1].trim();
        }
    }

    // totals
    let subtotal = null;
    let shipping = null;
    let tax = null;
    let total = null;

    if (html) {
        subtotal = extractHtmlMoney(html, "Subtotal");
        shipping = extractHtmlMoney(html, "Shipping");
        tax = extractHtmlMoney(html, "Taxes");
        total = extractHtmlMoney(html, "Total");
    }

    // items
    let items = [];
    if (html) {
        items = parseItemsFromHtml(html);
    }
    if ((!items || !items.length) && text) {
        items = parseItemsFromText(text);
    }

    return {
        vendorId: "regalia",
        vendorName: "Regalia Jewelry",
        orderNumber,
        orderStatus: finalStatus,
        orderDate: date ? new Date(date) : null,
        subtotal,
        shipping,
        tax,
        total,
        currency: "USD",
        items,
    };
}

export default {
    parseRegaliaOrder,
};

/**
 * Regalia Parser - Item Extraction Support
 * 
 * Supports item parsing for:
 * - confirmed: Extracts items with description, quantity, unitPrice, lineTotal, retailLineTotal, discountTotal from HTML
 * - shipped: Extracts items with description, quantity (no prices) from "Items in this shipment" plain-text section
 * - out_for_delivery: Extracts items with description, quantity (no prices) from shipment section
 * - delivered: Extracts items with description, quantity (no prices) from shipment section
 * - canceled: Extracts items if present in email body
 * 
 * Note: Regalia emails do not expose vendor SKU codes.
 * Parser removes "Ready to Ship" suffixes and discount notation from descriptions.
 * Confirmation emails include retail pricing and discount allocation information.
 */