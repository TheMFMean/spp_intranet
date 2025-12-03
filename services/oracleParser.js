// /srv/backend/services/oracleParser.js
// Vendor: Oracle Body Jewelry (Shopify)

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

function buildDescription(title, variant) {
    let text = title || "";

    if (variant && variant.trim()) {
        text = `${text} - ${variant.trim()}`;
    }

    text = text.replace(/&#34;|&quot;/g, '"');
    text = text.replace(/\s+/g, " ").trim();
    text = text.replace(/\s+"$/g, '"');

    return text;
}

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

        let quantity = 1;
        const qtyMatch = titleText.match(/[x×]\s*([0-9]+)\s*$/i);
        if (qtyMatch && qtyMatch[1]) {
            quantity = normalizeInt(qtyMatch[1]) || 1;
            titleText = titleText.replace(/[x×]\s*[0-9]+\s*$/i, "").trim();
        }

        let variant = null;
        const variantMatch = rowHtml.match(
            /class="order-list__item-variant"[^>]*>([^<]+)<\/span>/i
        );
        if (variantMatch && variantMatch[1]) {
            variant = variantMatch[1].replace(/\s+/g, " ").trim();
        }

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

        if (netLineTotal == null && retailLineTotal == null) {
            continue;
        }

        let unitPrice = null;
        if (quantity && quantity > 0 && netLineTotal != null) {
            unitPrice = netLineTotal / quantity;
        }

        const description = buildDescription(titleText, variant);

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

            const description = m[1].replace(/\s+/g, " ").trim();
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
                !/^(\$|Order summary|Subtotal|Shipping|Taxes|Total)/i.test(prev) &&
                !/^Thank you/i.test(prev) &&
                !/^View your order/i.test(prev)
            ) {
                baseTitle = `${prev} ${baseTitle}`.replace(/\s+/g, " ").trim();
                lines[i - 1] = "";
            }
        }

        let variant = null;
        let retailLineTotal = null;
        let netLineTotal = null;

        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
            const l = lines[j];
            if (!l) continue;

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

        if (retailLineTotal == null && netLineTotal == null) continue;

        let unitPrice = null;
        if (quantity && quantity > 0 && netLineTotal != null) {
            unitPrice = netLineTotal / quantity;
        }

        const description = buildDescription(baseTitle, variant);

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

export function parseOracleOrder({
    textPlain = "",
    textHtml = "",
    subject = "",
    date = "",
    orderStatus = null,
} = {}) {
    const html = textHtml || "";
    const text = textPlain || "";

    const result = {
        vendorId: "oracle",
        vendorName: "Oracle Body Jewelry",
        orderNumber: null,
        orderStatus: orderStatus || "other",
        orderDate: null,
        subtotal: null,
        shipping: null,
        tax: null,
        total: null,
        currency: "USD",
        items: [],
    };

    const subj = subject || "";
    if (/Thank you.*Order/i.test(subj)) {
        result.orderStatus = "confirmed";
    } else if (/Time to stalk the mail carrier/i.test(subj)) {
        result.orderStatus = "shipped";
    } else if (/is out for delivery/i.test(subj)) {
        result.orderStatus = "out_for_delivery";
    } else if (/has been delivered/i.test(subj)) {
        result.orderStatus = "delivered";
    } else if (/has been canceled|has been cancelled/i.test(subj)) {
        result.orderStatus = "canceled";
    }

    // Order number from subject ("Order! #8588") or body ("Order #8588")
    let orderNumber = null;

    if (subj) {
        const m = subj.match(/Order!\s*#\s*([0-9]+)|Order\s*#\s*([0-9]+)/i);
        if (m) {
            orderNumber = (m[1] || m[2]).trim();
        }
    }
    if (!orderNumber && (html || text)) {
        const m = (html || text).match(/Order\s*#\s*([0-9]+)/i);
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

    if (html) {
        result.subtotal = extractHtmlMoney(html, "Subtotal");
        result.shipping = extractHtmlMoney(html, "Shipping");
        result.tax = extractHtmlMoney(html, "Taxes");
        result.total = extractHtmlMoney(html, "Total");
    }

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
    parseOracleOrder,
};