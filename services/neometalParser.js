// /srv/backend/services/neometalParser.js

/**
 * Normalize text for easier parsing:
 *  - Convert Windows line endings to \n
 *  - Collapse repeated spaces
 *  - Trim trailing spaces
 */
function normalizeText(rawText) {
    if (!rawText) return "";
    let text = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    text = text.replace(/&nbsp;/gi, " ");

    text = text
        .split("\n")
        .map((line) => line.replace(/\s+/g, " ").trim())
        .join("\n");

    return text;
}

/**
 * Helper: parse money values like "$16.47" or "1,524.96"
 */
function parseMoney(value) {
    if (!value) return null;
    const match = value.toString().match(/([0-9][0-9,]*(?:\.[0-9]+)?)/);
    if (!match) return null;
    const numeric = parseFloat(match[1].replace(/,/g, ""));
    return Number.isNaN(numeric) ? null : numeric;
}

/**
 * Parse a Neometal Shopify order confirmation into structured data.
 */
export function parseNeometalOrder(rawText, emailDateStr = null) {
    const text = normalizeText(rawText);

    const result = {
        vendorId: "neometal",
        orderStatus: "confirmed", // added: these emails are confirmations in current flow
        vendorOrderNumber: null,
        orderDate: null,
        subtotal: null,
        shipping: null,
        tax: null,
        total: null,
        currency: "USD",
        items: [],
    };

    // ---------------------------
    // 1. Extract vendorOrderNumber
    // ---------------------------
    let orderNumberMatch =
        text.match(/Order\s+#?\s*(NEO[0-9]+)/i) ||
        text.match(/Order\s+#?\s*(\d{6,})/i);

    if (orderNumberMatch) {
        const raw = orderNumberMatch[1];
        result.vendorOrderNumber = raw.toUpperCase().startsWith("NEO")
            ? raw.toUpperCase()
            : `NEO${raw}`;
    }

    // ---------------------------
    // 2. Order Date (email timestamp)
    // ---------------------------
    if (emailDateStr) {
        const d = new Date(emailDateStr);
        if (!Number.isNaN(d.getTime())) {
            result.orderDate = d;
        }
    }

    // ---------------------------
    // 3. Narrow to "Order summary"
    // ---------------------------
    const orderSummaryIdx = text.indexOf("Order summary");
    if (orderSummaryIdx === -1) {
        console.warn("[parseNeometalOrder] No 'Order summary' section found.");
        return result;
    }

    const customerInfoIdx = text.indexOf("Customer information", orderSummaryIdx);
    const itemsBlock = text.slice(
        orderSummaryIdx + "Order summary".length,
        customerInfoIdx === -1 ? undefined : customerInfoIdx
    );

    const rawLines = itemsBlock
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

    const items = [];
    let i = 0;

    // ---------------------------
    // 4. Item Parsing Loop
    // ---------------------------
    while (i < rawLines.length) {
        const line = rawLines[i];

        // Stop when we hit totals
        if (
            /^Subtotal\b/i.test(line) ||
            /^Discount\b/i.test(line) ||
            /^Shipping\b/i.test(line) ||
            /^Total\b/i.test(line)
        ) {
            break;
        }

        // Product header: "Product Name   3"
        const nameQtyMatch = line.match(/^(.*\S)\s+(\d+)$/);
        if (!nameQtyMatch) {
            i += 1;
            continue;
        }

        const name = nameQtyMatch[1].trim();
        const quantity = parseInt(nameQtyMatch[2], 10) || 0;
        i += 1;

        // Optional options line
        let options = "";
        if (
            i < rawLines.length &&
            !/^SKU:/i.test(rawLines[i]) &&
            !/^\$/i.test(rawLines[i]) &&
            !/^Subtotal\b/i.test(rawLines[i]) &&
            !/^Total\b/i.test(rawLines[i])
        ) {
            options = rawLines[i].trim();
            i += 1;
        }

        // SKU line
        let sku = "";
        if (i < rawLines.length && /^SKU:/i.test(rawLines[i])) {
            const skuMatch = rawLines[i].match(/SKU:\s*(\S+)/i);
            if (skuMatch) sku = skuMatch[1];
            i += 1;
        }

        // Price line
        let priceLine = "";
        if (i < rawLines.length && /^\$/i.test(rawLines[i])) {
            priceLine = rawLines[i];
            i += 1;
        }

        const lineTotal = parseMoney(priceLine);
        const unitPrice =
            lineTotal && quantity > 0
                ? Number((lineTotal / quantity).toFixed(2))
                : null;

        const description = options ? `${name} - ${options}` : name;

        items.push({
            vendorId: "neometal",
            vendor_sku: sku || null,
            description,
            quantity,
            unitPrice,
            lineTotal,
        });
    }

    result.items = items;

    // ---------------------------
    // 5. Totals
    // ---------------------------
    const subtotalMatch = text.match(/Subtotal\s+\$([0-9,.\sA-Z]+)/i);
    if (subtotalMatch) result.subtotal = parseMoney(subtotalMatch[1]);

    const shippingMatch = text.match(/Shipping\s+\$([0-9,.\sA-Z]+)/i);
    if (shippingMatch) result.shipping = parseMoney(shippingMatch[1]);

    const taxMatch = text.match(/Tax\s+\$([0-9,.\sA-Z]+)/i);
    if (taxMatch) result.tax = parseMoney(taxMatch[1]);

    const totalMatch = text.match(/Total\s+\$([0-9,.\sA-Z]+)/i);
    if (totalMatch) result.total = parseMoney(totalMatch[1]);

    return result;
}
