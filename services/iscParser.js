// /srv/backend/services/iscParser.js

function normalizeText(text) {
    if (!text) return "";
    return text
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/\t/g, " ")
        .trim();
}

function stripTags(html) {
    if (!html) return "";
    return html
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function parseMoneyToString(value) {
    if (!value) return null;
    const match = value.toString().match(/([0-9][0-9,]*(?:\.[0-9]+)?)/);
    if (!match) return null;
    const numeric = parseFloat(match[1].replace(/,/g, ""));
    if (Number.isNaN(numeric)) return null;
    return numeric.toFixed(2);
}

// Make "Gauge 12g (2mm), Length 3/4 (19mm), High Polish"
function normalizeMetadata(raw) {
    if (!raw) return "";
    let text = raw.trim();

    if (text.startsWith("(") && text.endsWith(")")) {
        text = text.slice(1, -1);
    }

    const parts = text.split(",");
    const cleanedParts = parts
        .map((part) => {
            let p = part.trim();

            p = p.replace(/^Gauge:\s*/i, "Gauge ");
            p = p.replace(/^Length:\s*/i, "Length ");
            p = p.replace(/^Titanium Color Chart:\s*/i, "");

            p = p.replace(/\s+in\b/i, "");

            p = p.replace(/\(HP\)/gi, "").trim();

            return p;
        })
        .filter(Boolean);

    return cleanedParts.join(", ");
}

function buildDescription(title, metadata) {
    const meta = normalizeMetadata(metadata);
    if (!meta) return title || "";
    if (!title) return meta;
    return `${title} - ${meta}`;
}

/**
 * Parse an ISC Body Jewelry order confirmation email.
 */
export function parseIscOrder({
    textHtml = "",
    textPlain = "",
    date = "",
    subject = "",
} = {}) {
    const html = normalizeText(textHtml || textPlain || "");

    const result = {
        vendorId: "isc",
        vendorName: "ISC Body Jewelry",
        orderStatus: "other", // added
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
    if (/Order Confirmation|\bYour order ID\b/i.test(subj)) {
        result.orderStatus = "confirmed";
    }

    // Order number
    const orderMatch =
        html.match(/Your order ID is[^#]*#\s*([0-9]+)/i) ||
        html.match(/Order\s*ID\s*#\s*([0-9]+)/i);

    if (orderMatch) {
        result.orderNumber = orderMatch[1].trim();
    }

    // Order date from email Date header
    if (date) {
        const d = new Date(date);
        if (!Number.isNaN(d.getTime())) {
            result.orderDate = d;
        }
    }

    const items = [];

    // Each ISC item is its own table with border and a <small>(Gauge: ...)</small> line
    const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
    let tableMatch;

    while ((tableMatch = tableRegex.exec(html)) !== null) {
        const tableInner = tableMatch[1];

        // Skip non item tables
        if (!/<small>\(Gauge:/i.test(tableInner)) continue;

        // Grab td cells inside this table
        const tds = [];
        const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        let tdMatch;
        while ((tdMatch = tdRegex.exec(tableInner)) !== null) {
            tds.push(tdMatch[1]);
        }
        if (tds.length < 5) continue;

        const cell1 = tds[0];
        const cell2 = tds[1];
        const cell3 = tds[2];
        const cell4 = tds[3];
        const cell5 = tds[4];

        const titleMatch = cell1.match(/<strong>([^<]+)<\/strong>/i);
        const metaMatch = cell1.match(/<small>\(([^<]+)\)<\/small>/i);
        if (!titleMatch || !metaMatch) continue;

        const title = titleMatch[1].trim();
        const rawMeta = metaMatch[1].trim();

        const sku = stripTags(cell2);
        const qtyText = stripTags(cell3);
        const unitPriceText = stripTags(cell4);
        const lineTotalText = stripTags(cell5);

        const quantity = parseInt(qtyText, 10) || 0;
        const unitPrice = parseMoneyToString(unitPriceText);
        const lineTotal = parseMoneyToString(lineTotalText);
        const description = buildDescription(title, rawMeta);

        if (!description || !quantity) continue;

        items.push({
            vendor_sku: sku || null,
            description,
            quantity,
            unitPrice,
            lineTotal,
        });
    }

    result.items = items;

    // Totals: Subtotal, Shipping, Tax, Grand total
    function extractTotal(label) {
        const regex = new RegExp(
            `<strong>${label}:<\/strong>[\\s\\S]*?<strong>\\s*([^<]+)<\\/strong>`,
            "i"
        );
        const m = html.match(regex);
        if (!m) return null;
        return parseMoneyToString(m[1]);
    }

    result.subtotal = extractTotal("Subtotal");
    result.shipping = extractTotal("Shipping");
    result.tax = extractTotal("Tax");
    result.total = extractTotal("Grand total");

    return result;
}
