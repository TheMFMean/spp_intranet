// /srv/backend/services/emberParser.js
// Vendor: Ember Body Jewelry (Shopify)

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
 * Build cleaned description:
 *   Title (minus × qty)
 *   + variant (if present)
 * Examples:
 *  "High Key - Threadless End × 1", variant "14K Rose Gold / White CZ"
 *     -> "High Key - Threadless End - 14K Rose Gold / White CZ"
 */
function buildDescription(title, variant) {
    let text = title || "";

    // Decode HTML quote entities
    text = text.replace(/&#34;|&quot;/g, '"');

    // Normalize whitespace
    text = text.replace(/\s+/g, " ").trim();

    if (variant && variant.trim()) {
        text = `${text} - ${variant.trim()}`;
    }

    // Clean up stray whitespace before trailing quote
    text = text.replace(/\s+"$/g, '"');

    return text;
}

/**
 * Parse item rows from Ember's Shopify order HTML
 */
function parseItemsFromHtml(html) {
    if (!html) return [];

    const items = [];
    const rowRegex = /<tr class="order-list__item"[\s\S]*?<\/tr>/gi;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(html)) !== null) {
        const rowHtml = rowMatch[0];

        // Title
        const titleMatch = rowHtml.match(
            /class="order-list__item-title"[^>]*>([^<]+)<\/span>/i
        );
        if (!titleMatch) continue;

        let titleText = titleMatch[1].replace(/\s+/g, " ").trim();

        // Extract quantity from "× N"
        let quantity = 1;
        const qtyMatch = titleText.match(/[x×]\s*([0-9]+)\s*$/i);
        if (qtyMatch && qtyMatch[1]) {
            quantity = parseInt(qtyMatch[1], 10) || 1;
            titleText = titleText.replace(/[x×]\s*[0-9]+\s*$/i, "").trim();
        }

        // Optional variant line
        let variant = null;
        const variantMatch = rowHtml.match(
            /class="order-list__item-variant"[^>]*>([^<]+)<\/span>/i
        );
        if (variantMatch && variantMatch[1]) {
            variant = variantMatch[1].replace(/\s+/g, " ").trim();
        }

        // Price (line total)
        const priceMatch = rowHtml.match(
            /class="order-list__item-price"[^>]*>\s*([^<]+)<\/p>/i
        );
        if (!priceMatch) continue;

        const lineTotal = parseMoney(priceMatch[1]);
        const unitPrice =
            quantity && quantity > 0 ? lineTotal / quantity : lineTotal;

        const description = buildDescription(titleText, variant);

        items.push({
            vendor_sku: null,
            description,
            quantity,
            unitPrice,
            lineTotal,
        });
    }

    return items;
}

/**
 * Parse item lines from plain-text "Items in this shipment" sections
 * for shipped/out_for_delivery/delivered emails
 */
function parseItemsFromText(text) {
    if (!text) return [];

    const items = [];

    // Try multiple textual anchors
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

    if (!itemsSection) return items;

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

        const description = buildDescription(m[1].replace(/\s+/g, " ").trim(), null);
        const quantity = parseInt(m[2], 10) || 1;

        items.push({
            vendor_sku: null,
            description,
            quantity,
            unitPrice: null,
            lineTotal: null,
        });
    }

    return items;
}

/**
 * Main parse function
 */
export function parseEmberOrder({
    textHtml = "",
    textPlain = "",
    subject = "",
    date = "",
    orderStatus = null,
} = {}) {
    const html = normalizeText(textHtml || "");
    const text = normalizeText(textPlain || "");

    const result = {
        vendorId: "ember",
        vendorName: "Ember Body Jewelry",
        orderStatus: orderStatus || "other",
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
    if (/Order\s*#\s*[0-9]+\s+confirmed/i.test(subj)) {
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

    // Order number from subject "Order #5426 confirmed"
    let orderNumber = null;
    if (subject) {
        const m = subject.match(/Order\s*#?\s*([A-Za-z0-9]+)/i);
        if (m && m[1]) orderNumber = m[1].trim();
    }
    if (!orderNumber && (html || text)) {
        const m = (html || text).match(/Order\s*#?\s*([A-Za-z0-9]+)/i);
        if (m && m[1]) orderNumber = m[1].trim();
    }
    result.orderNumber = orderNumber;

    if (date) {
        const d = new Date(date);
        if (!Number.isNaN(d.getTime())) {
            result.orderDate = d;
        }
    }

    // Totals
    if (html) {
        result.subtotal = extractHtmlMoney(html, "Subtotal");
        result.shipping = extractHtmlMoney(html, "Shipping");
        result.tax = extractHtmlMoney(html, "Taxes");
        result.total = extractHtmlMoney(html, "Total");
    }

    // Items: try HTML first, then plain-text
    let items = [];
    if (html) {
        items = parseItemsFromHtml(html);
    }
    if ((!items || !items.length) && text) {
        items = parseItemsFromText(text);
    }
    result.items = items;

    return result;
}

export default {
    parseEmberOrder,
};

/**
 * Ember Parser - Item Extraction Support
 * 
 * Supports item parsing for:
 * - confirmed: Extracts items with description, quantity, unitPrice, lineTotal from HTML order-list__item rows
 * - shipped: Extracts items with description, quantity (no prices) from "Items in this shipment" plain-text section
 * - out_for_delivery: Extracts items with description, quantity (no prices) from shipment section
 * - delivered: Extracts items with description, quantity (no prices) from shipment section
 * - canceled: Extracts items if present in email body
 * 
 * Note: Ember emails do not expose vendor SKU codes.
 * Description includes title and variant (e.g., metal type, stone color) when available.
 */
