// /srv/backend/services/glasswearParser.js

// Basic utility to normalize whitespace and HTML leftovers
function normalizeText(text) {
    if (!text) return "";
    return text
        .replace(/&nbsp;/gi, " ")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/\t/g, " ")
        // Collapse all whitespace (including newlines) to a single space
        .replace(/\s+/g, " ")
        .trim();
}

export function parseGlasswearOrder(rawText) {
    const text = normalizeText(rawText);

    const result = {
        vendorId: "glass_wear",
        orderStatus: "confirmed", // added
        orderNumber: null,
        customerId: null,
        orderDate: null,
        orderTime: null,
        billTo: null,
        shipTo: null,
        items: [],
        subtotal: null,
        shipping: null,
        tax: null,
        total: null,
        rawTextLength: text.length,
    };

    // Customer ID
    const customerMatch = text.match(/CustomerID#\s*([0-9]+)/i);
    if (customerMatch) {
        result.customerId = customerMatch[1];
    }

    // Order number variants: "Your order number is 34064" or "Order #34064"
    let orderMatch =
        text.match(/Your order number is\s*([0-9]+)/i) ||
        text.match(/Order\s*#\s*([0-9]+)/i);

    if (orderMatch) {
        result.orderNumber = orderMatch[1];
    }

    // Date and time: "placed 11/19/2025 at 12:31PM"
    const dateMatch = text.match(
        /placed\s+([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})\s+at\s+([0-9:APMapm\s]+)/i
    );
    if (dateMatch) {
        result.orderDate = dateMatch[1];
        result.orderTime = dateMatch[2].trim();
    }

    // Bill To and Ship To sections
    const billToMatch = text.match(/Bill To:\s*(.+?)Ship To:/i);
    if (billToMatch) {
        result.billTo = billToMatch[1].trim();
    }

    const shipToMatch = text.match(
        /Ship To:\s*(.+?)(Payment Info:|Order summary|Items?:)/i
    );
    if (shipToMatch) {
        result.shipTo = shipToMatch[1].trim();
    }

    // --------------- Item section detection ---------------

    let itemsSection = null;

    // 1) Glasswear specific: table region between column headers and the Subtotal line
    const tableRegionMatch = text.match(
        /Code\s+Item\s+Quanty.*?(Subtotal[:\s]*\$[0-9,.]+)/i
    );

    if (tableRegionMatch) {
        let region = tableRegionMatch[0];

        region = region.replace(
            /Code\s+Item\s+Quanty.*?Grand Total/i,
            ""
        );

        region = region.replace(/Subtotal[:\s]*\$[0-9,.]+.*/i, "");

        region = region.trim();
        if (region) {
            itemsSection = region;
        }
    }

    // 2) Fallback: original "Order summary" region
    if (!itemsSection) {
        const summaryMatch = text.match(/Order summary(.*)$/i);
        if (summaryMatch) {
            itemsSection = summaryMatch[1];
        }
    }

    // 3) Fallback: generic "Items:" region
    if (!itemsSection) {
        const altMatch = text.match(/Items?:\s*(.*)$/i);
        if (altMatch) {
            itemsSection = altMatch[1];
        }
    }

    // --------------- Item parsing ---------------

    if (itemsSection) {
        const items = [];

        const itemRegex =
            /(.+?)\s+(?:[x×]\s*(\d+)\s+)?\$([0-9.,]+)(?:\s*\$([0-9.,]+))?/g;

        let match;
        while ((match = itemRegex.exec(itemsSection)) !== null) {
            const rawLine = match[0].trim();
            let rawDescription = match[1].trim();
            const quantityText = match[2];
            const unitPrice = match[3];
            const lineTotal = match[4] || unitPrice;

            if (/Subtotal|Tax|Shipping|Grand Total/i.test(rawDescription)) {
                continue;
            }

            let vendor_sku = null;
            const parts = rawDescription.split(/\s+/);
            if (parts.length > 1) {
                vendor_sku = parts[0];
                rawDescription = parts.slice(1).join(" ").trim();
            }

            let explicitQty = null;
            const qtyTailMatch = rawLine.match(/(\d+)\s*(?:\$[0-9.,]+\s*\$[0-9.,]+)?$/);
            if (qtyTailMatch) {
                explicitQty = parseInt(qtyTailMatch[1], 10);
            }

            let quantity =
                quantityText != null ? parseInt(quantityText, 10) : explicitQty;

            const unitNum = parseFloat(unitPrice.replace(/,/g, ""));
            const lineNum = parseFloat(lineTotal.replace(/,/g, ""));
            if (!Number.isNaN(unitNum) && !Number.isNaN(lineNum) && unitNum > 0) {
                const ratio = lineNum / unitNum;
                const rounded = Math.round(ratio);
                if (
                    rounded > 0 &&
                    (quantity == null || Math.abs(ratio - rounded) < 0.01)
                ) {
                    quantity = rounded;
                }
            }

            if (Number.isNaN(quantity) || quantity == null || quantity <= 0) {
                quantity = 1;
            }

            const description = rawDescription.replace(/\s*\d+$/, "").trim();

            items.push({
                vendor_sku,
                description,
                quantity,
                unitPrice,
                lineTotal,
                rawLine,
            });
        }

        result.items = items;
    }

    // --------------- Totals ---------------

    const subtotalMatch = text.match(/Subtotal[:\s]*\$([0-9,.]+)/i);
    if (subtotalMatch) result.subtotal = subtotalMatch[1];

    const shippingMatch = text.match(
        /Shipping(?: Cost)?:[:\s]*\$([0-9,.]+)/i
    );
    if (shippingMatch) result.shipping = shippingMatch[1];

    const taxMatch = text.match(/Tax[:\s]*\$([0-9,.]+)/i);
    if (taxMatch) result.tax = taxMatch[1];

    const totalMatch =
        text.match(/Grand Total[:\s]*\$([0-9,.]+)/i) ||
        text.match(/Order Total[:\s]*\$([0-9,.]+)/i) ||
        text.match(/Total[:\s]*\$([0-9,.]+)/i);

    if (totalMatch) result.total = totalMatch[1];

    return result;
}
