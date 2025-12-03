// /srv/backend/services/anatometalParser.js

function normalizeText(text) {
    if (!text) return "";
    return text
        .replace(/=D7/g, "×")
        .replace(/&nbsp;/gi, " ")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/\t/g, " ")
        .replace(/\u00a0/g, " ")
        .trim();
}

export function parseAnatometalOrder(rawText, emailDateStr = null) {
    const text = normalizeText(rawText);

    const result = {
        vendorId: "anatometal",
        orderStatus: "confirmed", // added: these emails are order confirmations
        orderNumber: null,
        customerId: null,
        orderDate: emailDateStr || null,
        items: [],
        subtotal: null,
        shipping: null,
        tax: null,
        total: null,
        currency: "USD",
        rawTextLength: text.length,
    };

    const orderMatch = text.match(/Order\s*#\s*([A-Z0-9]+)/i);
    if (orderMatch) result.orderNumber = orderMatch[1];

    const summaryStart = text.indexOf("Order summary");
    if (summaryStart >= 0) {
        let section = text.slice(summaryStart);
        const custIdx = section.indexOf("Customer information");
        if (custIdx >= 0) section = section.slice(0, custIdx);

        const lines = section
            .split("\n")
            .map(l => l.trim())
            .filter(Boolean);

        const items = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (/^Order summary/i.test(line)) continue;
            if (/^-{3,}/.test(line)) continue;

            const qtyMatch =
                line.match(/(.+?)\s*[×x]\s*(\d+)\s*$/) ||
                line.match(/(.+?)\s*=\s*D7\s*(\d+)\s*$/);

            if (!qtyMatch) continue;

            const title = qtyMatch[1].trim();
            const quantity = parseInt(qtyMatch[2], 10) || 1;

            // Variant line
            let variantLine = "";
            let j = i + 1;
            while (j < lines.length && !lines[j]) j++;
            if (j < lines.length) variantLine = lines[j];

            // Price line (fixed to stop picking up totals)
            let priceLine = "";
            let k = j + 1;

            while (k < lines.length) {
                const candidate = lines[k];

                // Next item header appears; stop scanning
                if (/[×x]\s*\d+\s*$/.test(candidate)) break;

                // Valid price
                if (/^\$[0-9]/.test(candidate)) {
                    priceLine = candidate;
                    break;
                }

                // FREE case (Anatometal does this for anodization bundles)
                if (/^Free$/i.test(candidate)) {
                    priceLine = "Free";
                    break;
                }

                // Stop if we hit any totals
                if (/^Subtotal/i.test(candidate)) break;
                if (/^Shipping/i.test(candidate)) break;
                if (/^Taxes?/i.test(candidate)) break;
                if (/^Total/i.test(candidate)) break;

                k++;
            }

            // If no price found, skip item
            if (!priceLine) continue;

            let lineTotalNum = 0;

            if (/^Free$/i.test(priceLine)) {
                lineTotalNum = 0;
            } else {
                const match = priceLine.match(/^\$([0-9.,]+)/);
                if (match) {
                    lineTotalNum = parseFloat(match[1].replace(/,/g, "")) || 0;
                }
            }

            const unitPrice = quantity > 0
                ? (lineTotalNum / quantity).toFixed(2)
                : lineTotalNum.toFixed(2);

            const description =
                variantLine ? `${title} - ${variantLine}` : title;

            items.push({
                description,
                quantity,
                unitPrice,
                lineTotal: lineTotalNum.toFixed(2),
                sku: null,
                internalSku: null,
                vendorMeta: { vendor: "anatometal" },
            });

            i = Math.max(i, k);
        }

        result.items = items;
    }

    const subtotalMatch = text.match(/Subtotal\s*\$([0-9,.]+)/i);
    if (subtotalMatch) result.subtotal = subtotalMatch[1];

    const shippingMatch = text.match(/Shipping\s*\$([0-9,.]+)/i);
    if (shippingMatch) result.shipping = shippingMatch[1];

    const taxMatch = text.match(/Taxes?\s*\$([0-9,.]+)/i);
    if (taxMatch) result.tax = taxMatch[1];

    const totalMatch =
        text.match(/Total\s*\$([0-9,.]+)\s*USD/i) ||
        text.match(/Total\s*\$([0-9,.]+)/i);
    if (totalMatch) result.total = totalMatch[1];

    return result;
}