// /srv/backend/services/quetzalliParser.js
// Vendor: Quetzalli Jewelry (Shopify)

function normalizeMoney(value) {
    if (!value) return null;
    const cleaned = String(value).replace(/[^0-9.\-]/g, "");
    if (!cleaned) return null;
    const num = Number(cleaned);
    return Number.isNaN(num) ? null : num;
}

function normalizeInt(value) {
    if (!value) return null;
    const cleaned = String(value).replace(/[^0-9]/g, "");
    if (!cleaned) return null;
    return parseInt(cleaned, 10);
}

function round2(n) {
    if (n == null) return null;
    return Number(n.toFixed(2));
}

function extractHtmlMoney(html, label) {
    if (!html) return null;
    const regex = new RegExp(
        `>${label}<[^>]*>[\\s\\S]*?<span[^>]*>\\s*([^<]+)<`,
        "i"
    );
    const match = html.match(regex);
    if (!match) return null;
    return normalizeMoney(match[1]);
}

function buildDescription(base, variant1, variant2) {
    let desc = base.trim();

    if (variant1) desc += ` - ${variant1.trim()}`;
    if (variant2) desc += ` - ${variant2.trim()}`;

    return desc.replace(/\s+/g, " ").trim();
}

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

        const description = m[1].replace(/\s+/g, " ").trim();
        const quantity = normalizeInt(m[2]) || 1;

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

function parseItemsFromHtml(html) {
    if (!html) return [];

    const items = [];
    const rowRegex = /<tr class="order-list__item"[\s\S]*?<\/tr>/gi;
    let row;

    while ((row = rowRegex.exec(html)) !== null) {
        const rowHtml = row[0];

        const titleMatch = rowHtml.match(
            /class="order-list__item-title"[^>]*>([^<]+)<\/span>/i
        );
        if (!titleMatch) continue;

        let title = titleMatch[1].replace(/\s+/g, " ").trim();

        // extract qty "× N"
        let qty = 1;
        const qtyMatch = title.match(/[x×]\s*([0-9]+)$/i);
        if (qtyMatch) {
            qty = normalizeInt(qtyMatch[1]);
            title = title.replace(/[x×]\s*[0-9]+$/i, "").trim();
        }

        // variant1: e.g. “Disc - 2.5mm”
        const variant1Match = rowHtml.match(
            /class="order-list__item-variant"[^>]*>([^<]+)<\/span>/i
        );
        const variant1 = variant1Match ? variant1Match[1].trim() : null;

        // variant2: e.g. “Gold: Yellow Gold”
        const variant2Match = rowHtml.match(
            /<p[^>]*>\s*Gold:\s*([^<]+)<\/p>/i
        );
        const variant2 = variant2Match ? variant2Match[1].trim() : null;

        const priceMatch = rowHtml.match(
            /class="order-list__item-price"[^>]*>\s*([^<]+)<\/p>/i
        );
        const lineTotalRaw = priceMatch ? normalizeMoney(priceMatch[1]) : null;

        if (lineTotalRaw == null) continue;

        const lineTotal = round2(lineTotalRaw);
        const unitPrice = round2(lineTotal / qty);

        const description = buildDescription(title, variant1, variant2);

        items.push({
            vendor_sku: null,
            description,
            quantity: qty,
            unitPrice,
            lineTotal,
        });
    }

    return items;
}

export function parseQuetzalliOrder({
    textHtml = "",
    textPlain = "",
    subject = "",
    date = "",
    orderStatus = null,
} = {}) {
    const html = textHtml || "";
    const text = textPlain || "";

    // ---- event type detection ----
    let finalStatus = orderStatus || "other";

    const subj = subject || "";
    if (!orderStatus) {
        if (/Order Confirmed/i.test(subj)) {
            finalStatus = "confirmed";
        } else if (/Order Has Been Canceled|Order Has Been Cancelled/i.test(subj)) {
            finalStatus = "canceled";
        } else if (/Has Been Shipped/i.test(subj)) {
            finalStatus = "shipped";
        } else if (/is Out for Delivery/i.test(subj)) {
            finalStatus = "out_for_delivery";
        } else if (/Has Been Delivered/i.test(subj)) {
            finalStatus = "delivered";
        }
    }

    // ---- order number ----
    let orderNumber = null;

    const subMatch = subj.match(/#\s*([0-9]+)/);
    if (subMatch) orderNumber = subMatch[1];

    if (!orderNumber) {
        const htmlMatch = html.match(/Order\s*#\s*([0-9]+)/i);
        if (htmlMatch) orderNumber = htmlMatch[1];
    }

    // ---- items + totals ----
    let items = [];
    if (html) {
        items = parseItemsFromHtml(html);
    }
    if ((!items || !items.length) && text) {
        items = parseItemsFromText(text);
    }

    const subtotal = extractHtmlMoney(html, "Subtotal");
    const shipping = extractHtmlMoney(html, "Shipping");
    const tax = extractHtmlMoney(html, "Taxes");
    const total = extractHtmlMoney(html, "Total");

    return {
        vendorId: "quetzalli",
        vendorName: "Quetzalli Jewelry",
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
    parseQuetzalliOrder,
};