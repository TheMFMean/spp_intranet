// /srv/backend/services/cascadeParser.js

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
 * Parse items from Shopify HTML order confirmation emails
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

        const description = variant ? `${titleText} - ${variant}` : titleText;

        // Price (line total)
        const priceMatch = rowHtml.match(
            /class="order-list__item-price"[^>]*>\s*([^<]+)<\/p>/i
        );
        if (!priceMatch) continue;

        const lineTotal = parseMoney(priceMatch[1]);
        if (lineTotal == null) continue;

        const unitPrice = quantity && quantity > 0 ? lineTotal / quantity : lineTotal;

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

export function parseCascadeOrder({
    textPlain = "",
    textHtml = "",
    subject = "",
    date = "",
    orderStatus = null,
} = {}) {
    const html = normalizeText(textHtml || "");
    const text = normalizeText(textPlain || "");

    const result = {
        vendorId: "cascade",
        vendorName: "Cascade Body Jewelry",
        orderStatus: orderStatus || "other",
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
        currency: "USD",
        vendorMeta: {},
        rawTextLength: text.length,
    };

    const subj = subject || "";

    // ---------- orderStatus from subject (if not provided) ----------
    if (!result.orderStatus || result.orderStatus === "other") {
        if (/Order\s*#\s*\d+\s+confirmed/i.test(subj)) {
            result.orderStatus = "confirmed";
        } else if (/out for delivery/i.test(subj)) {
            result.orderStatus = "out_for_delivery";
        } else if (/has shipped|shipped|on the way/i.test(subj)) {
            result.orderStatus = "shipped";
        } else if (/has been delivered|was delivered/i.test(subj)) {
            result.orderStatus = "delivered";
        } else if (/has been cancelled|has been canceled|order\s*#\s*\d+.*canceled/i.test(subj)) {
            result.orderStatus = "canceled";
        } else if (/refund/i.test(subj)) {
            result.orderStatus = "refunded";
        }
    }

    // ---------- orderDate fallback from Date header ----------
    if (!result.orderDate && date) {
        try {
            result.orderDate = new Date(date);
        } catch (e) {
            // ignore invalid date
        }
    }

    // ---------- orderNumber from subject ----------
    if (!result.orderNumber && subj) {
        const subjectOrderMatch = subj.match(/order\s*#\s*([0-9]+)/i);
        if (subjectOrderMatch) {
            result.orderNumber = subjectOrderMatch[1];
        }
    }

    // ---------- orderNumber from body ----------
    const orderMatch = text.match(/Order\s*#\s*([0-9]+)/i);
    if (orderMatch) {
        result.orderNumber = result.orderNumber || orderMatch[1];
    }

    // ========== Items: Look for item sections in all lifecycle events ==========

    let items = [];

    // Try HTML first (confirmation emails)
    if (html) {
        items = parseItemsFromHtml(html);
    }

    // If no items from HTML, try plain-text parsing (shipment/delivery emails)
    if ((!items || !items.length) && text) {
        // Try multiple textual anchors for different lifecycle templates
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
                .split("\n")
                .map(l => l.trim())
                .filter(l => l.length > 0);

            // Pattern for parsing item lines:
            // Line format: "Item Name - Size × Quantity" or "Item Name × Quantity"
            // Also handle quoted-printable encoding: =D7 for ×
            for (const line of lines) {
                // Skip lines that look like headers or separators
                if (/^[-–=]+$/.test(line) || line.length < 3) {
                    continue;
                }

                // Try to match: "Description × Quantity" or "Description x Quantity" or "Description =D7 Quantity"
                const nameQtyMatch = line.match(/(.+?)\s*(?:[xX×]|=D7)\s*(\d+)\s*$/);

                if (nameQtyMatch) {
                    const description = nameQtyMatch[1].trim();
                    const quantity = parseInt(nameQtyMatch[2], 10);

                    if (!Number.isNaN(quantity) && quantity > 0) {
                        items.push({
                            vendor_sku: null, // Cascade emails do not expose SKU codes
                            description,
                            quantity,
                            unitPrice: null, // Not always available in shipment emails
                            lineTotal: null,
                        });
                    }
                }
            }
        }

        // If no items found via simple pattern, try 3-line pattern (for confirmed emails with prices)
        if (items.length === 0 && itemsSection) {
            const lines = itemsSection
                .split("\n")
                .map(l => l.trim())
                .filter(l => l.length > 0);

            // Pattern:
            // 0: "Threadless 16g Ball Ends × 10"
            // 1: '1/8"'
            // 2: "$37.50"
            for (let i = 0; i + 2 < lines.length; i += 3) {
                const descLine = lines[i];
                const sizeLine = lines[i + 1];
                const priceLine = lines[i + 2];

                // Extract base description and quantity from "Name × 10"
                const nameQtyMatch = descLine.match(/(.+?)\s*(?:[xX×]|=D7)\s*(\d+)\s*$/);

                let baseDescription = descLine.trim();
                let quantity = 1;

                if (nameQtyMatch) {
                    baseDescription = nameQtyMatch[1].trim();
                    const q = parseInt(nameQtyMatch[2], 10);
                    if (!Number.isNaN(q) && q > 0) {
                        quantity = q;
                    }
                }

                // Normalize the size line
                let normalizedSize = sizeLine.replace(/\s+/g, " ").trim();
                if (/^[-–]+$/.test(normalizedSize)) {
                    normalizedSize = "";
                }

                const description = normalizedSize
                    ? `${baseDescription} - ${normalizedSize}`
                    : baseDescription;

                // Line total from "$37.50"
                const priceMatch = priceLine.match(/\$([0-9,]+\.\d{2})/);
                if (!priceMatch) {
                    continue;
                }

                const lineTotalStr = priceMatch[1];
                const lineTotalNum = parseFloat(lineTotalStr.replace(/,/g, ""));

                // Unit price = lineTotal / quantity
                let unitPriceNum =
                    quantity > 0 ? lineTotalNum / quantity : lineTotalNum;
                unitPriceNum = Math.round(unitPriceNum * 100) / 100;
                const unitPriceStr = unitPriceNum.toFixed(2);

                items.push({
                    vendor_sku: null, // Cascade emails do not expose SKU codes
                    description,
                    quantity,
                    unitPrice: unitPriceStr,
                    lineTotal: lineTotalStr,
                });
            }
        }
    }

    result.items = items;

    // ========== Totals ==========

    const subtotalMatch = text.match(/Subtotal\s*\n\s*\$([0-9,]+\.\d{2})/i);
    if (subtotalMatch) {
        result.subtotal = subtotalMatch[1];
    }

    const shippingMatch = text.match(/Shipping\s*\n\s*\$([0-9,]+\.\d{2})/i);
    if (shippingMatch) {
        result.shipping = shippingMatch[1];
    }

    const taxMatch = text.match(/Tax(?:es)?\s*\n\s*\$([0-9,]+\.\d{2})/i);
    if (taxMatch) {
        result.tax = taxMatch[1];
    }

    const totalMatch = text.match(/Total\s*\n\s*\$([0-9,]+\.\d{2})/i);
    if (totalMatch) {
        result.total = totalMatch[1];
    }

    // ========== Customer info: Shipping and billing addresses ==========

    const customerInfoMatch = text.match(/Customer information[\s\S]*$/i);
    if (customerInfoMatch) {
        const ci = customerInfoMatch[0];

        const shipMatch = ci.match(
            /Shipping address[\s\-]*\n([\s\S]*?)\n\nBilling address/i
        );
        if (shipMatch) {
            result.shipTo = shipMatch[1].trim();
        }

        const billMatch = ci.match(
            /Billing address[\s\-]*\n([\s\S]*?)\n\nShipping method/i
        );
        if (billMatch) {
            result.billTo = billMatch[1].trim();
        }
    }

    return result;
}

/**
 * Cascade Parser - Item Extraction Support
 * 
 * Supports item parsing for:
 * - confirmed: Extracts items with description, quantity, unitPrice, lineTotal from HTML/text
 * - shipped: Extracts items with description, quantity (no prices) from "Items in this shipment" section
 * - out_for_delivery: Extracts items with description, quantity (no prices) from shipment section
 * - delivered: Extracts items with description, quantity (no prices) from shipment section
 * - canceled: Extracts items if present in email body
 * - refunded: Extracts items if present in email body
 * 
 * Note: Cascade emails do not expose vendor SKU codes.
 * Shipment/delivery emails contain item lists but no pricing information.
 */
