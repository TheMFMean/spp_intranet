// /srv/backend/services/crucialDiabloParser.js
// Vendor: Jimmy Buddha Designs / Diablo Organics
// Vendor key: "crucial_diablo"

// ---------------------
// Helpers
// ---------------------

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

// Remove trailing discount patterns like "(-$80.00)" from description text
function stripDiscountFromDescription(text) {
    if (!text) return text;
    return text.replace(/\s*\(-\s*\$[0-9.,]+\)\s*$/i, "").trim();
}

// Extract a money value from the HTML totals table
function extractHtmlMoney(html, label) {
    if (!html) return null;
    const regex = new RegExp(
        `>${label}</span>[\\s\\S]*?<strong[^>]*>\\s*([^<]+)<`,
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

        // Title line: "Titanium V Clicker - Clear CZ (16g) × 1"
        const titleMatch = rowHtml.match(
            /class="order-list__item-title"[^>]*>([^<]+)<\/span>/i
        );
        if (!titleMatch) continue;

        let titleText = titleMatch[1]
            .replace(/\s+/g, " ")
            .trim();

        // Quantity from "× 1" or "x 1" at end of title
        let quantity = 1;
        const qtyMatch = titleText.match(/[x×]\s*([0-9]+)\s*$/i);
        if (qtyMatch && qtyMatch[1]) {
            quantity = normalizeInt(qtyMatch[1]) || 1;
            titleText = titleText.replace(/[x×]\s*[0-9]+\s*$/i, "").trim();
        }

        // Variant line below title: "9.5mm (3/8")"
        const variantMatch = rowHtml.match(
            /class="order-list__item-variant"[^>]*>([^<]+)<\/span>/i
        );
        const variant = variantMatch
            ? variantMatch[1].replace(/\s+/g, " ").trim()
            : null;

        // Combine title and variant into one description
        let description = variant ? `${titleText} ${variant}` : titleText;
        description = stripDiscountFromDescription(description);

        // Wholesale discount line, if present: WHOLESALE_CUSTOMER (-$40.00)
        const discountMatch = rowHtml.match(
            /WHOLESALE_CUSTOMER[^()]*\((-[^()]+)\)/i
        );
        const discountTotal = discountMatch
            ? Math.abs(normalizeMoney(discountMatch[1]))
            : null;

        // Original retail line total (crossed out)
        const retailMatch = rowHtml.match(
            /class="order-list__item-original-price"[^>]*>\s*([^<]+)<\/del>/i
        );
        const retailLineTotal = retailMatch
            ? normalizeMoney(retailMatch[1])
            : null;

        // Final wholesale line total (orange box)
        const netMatch = rowHtml.match(
            /class="order-list__item-price"[^>]*>\s*([^<]+)<\/p>/i
        );
        const netLineTotal = netMatch ? normalizeMoney(netMatch[1]) : null;

        let unitPrice = null;
        let retailUnitPrice = null;
        let discountPerUnit = null;

        if (quantity && quantity > 0) {
            if (netLineTotal != null) {
                unitPrice = netLineTotal / quantity;
            }
            if (retailLineTotal != null) {
                retailUnitPrice = retailLineTotal / quantity;
            }
            if (discountTotal != null) {
                discountPerUnit = discountTotal / quantity;
            }
        }

        // Skip any row that does not have an actual price
        if (netLineTotal == null && retailLineTotal == null) {
            continue;
        }

        items.push({
            vendor_sku: null,        // Diablo template does not show SKU
            description,             // red line plus size line combined, no discount text
            quantity,                // green box
            unitPrice,               // wholesale unit price
            lineTotal: netLineTotal, // wholesale line total (orange box)
            retailUnitPrice,
            retailLineTotal,
            discountTotal,
            discountPerUnit,
            metal: null,
            size: variant || null,
            color: null,
        });
    }

    return items;
}

// ---------------------
// Text item parsing fallback
// ---------------------

function parseItemsFromText(text) {
    if (!text) return [];
    const rawLines = text.split(/\r?\n/);
    const lines = rawLines.map((l) => l.trim());
    const items = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Match only lines where the quantity is at the end:
        // "Titanium V Clicker - Clear CZ (16g) × 1"
        const titleMatch = line.match(/^(.+?)\s*[x×]\s*([0-9]+)\s*$/i);
        if (!titleMatch) continue;

        let baseTitle = titleMatch[1].trim();
        const quantity = normalizeInt(titleMatch[2]) || 1;

        // If the title was broken across two lines (like:
        // "Titanium Marquise Threadless End - Clear CZ - 3 sizes"
        // "available (18g/16g) × 10")
        // then merge the previous line into the title.
        if (i > 0) {
            const prev = lines[i - 1];
            if (
                prev &&
                !/^(\$|WHOLESALE_CUSTOMER|Order summary|Subtotal|Shipping|Taxes|Total)/i.test(
                    prev
                ) &&
                !/^Thank you/i.test(prev) &&
                !/^View your order/i.test(prev) &&
                !/\(-\s*\$[0-9.,]+\)/.test(prev) &&           // do not treat discount line as title
                !/-\s*\$[0-9.,]+/.test(prev)
            ) {
                baseTitle = `${prev} ${baseTitle}`.replace(/\s+/g, " ").trim();
                // blank out the previous line so it does not get reused
                lines[i - 1] = "";
            }
        }

        let variant = null;
        let discountTotal = null;
        let retailLineTotal = null;
        let netLineTotal = null;

        // Look ahead a few lines to collect variant, discount, and prices
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
            const l = lines[j];

            if (!l) continue;

            // Discount lines: WHOLESALE_CUSTOMER and "(-$xx.xx)" that follow it
            if (/WHOLESALE_CUSTOMER/i.test(l)) {
                // next line usually has "(-$40.00)" type pattern
                if (j + 1 < lines.length) {
                    const dLine = lines[j + 1];
                    const dMatch = dLine.match(/\((-[^()]+)\)/);
                    if (dMatch && dMatch[1]) {
                        discountTotal = Math.abs(normalizeMoney(dMatch[1]));
                    }
                }
                continue;
            }
            if (/\(-\s*\$[0-9.,]+\)/.test(l) || /-\s*\$[0-9.,]+/.test(l)) {
                // discount numeric line, never variant
                continue;
            }

            // Variant: first non money, non wholesale, non header line
            if (
                !variant &&
                !/^(\$|Order summary|Subtotal|Shipping|Taxes|Total)/i.test(l) &&
                !/^Thank you/i.test(l) &&
                !/^View your order/i.test(l)
            ) {
                // Avoid using discount lines as variant, already filtered above
                variant = l;
                continue;
            }

            // Price lines starting with $
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

        // If we never found any price, skip this block
        if (retailLineTotal == null && netLineTotal == null) {
            continue;
        }

        let unitPrice = null;
        let retailUnitPrice = null;
        let discountPerUnit = null;

        if (quantity && quantity > 0) {
            if (netLineTotal != null) {
                unitPrice = netLineTotal / quantity;
            }
            if (retailLineTotal != null) {
                retailUnitPrice = retailLineTotal / quantity;
            }
            if (discountTotal != null) {
                discountPerUnit = discountTotal / quantity;
            }
        }

        let description = variant ? `${baseTitle} ${variant}` : baseTitle;
        description = stripDiscountFromDescription(description);

        items.push({
            vendor_sku: null,
            description,
            quantity,
            unitPrice,
            lineTotal: netLineTotal,
            retailUnitPrice,
            retailLineTotal,
            discountTotal,
            discountPerUnit,
            metal: null,
            size: variant || null,
            color: null,
        });
    }

    return items;
}

// ---------------------
// Main entry point
// ---------------------

export function parseCrucialDiabloOrder({
    textPlain = "",
    textHtml = "",
    subject = "",
    date = null,
    from = "",
}) {
    const html = textHtml || "";
    const text = textPlain || "";

    // Event type
    let orderStatus = "other";
    const subj = subject || "";
    if (/Order\s*#\s*[A-Za-z0-9]+\s+confirmed/i.test(subj)) {
        orderStatus = "confirmed";
    } else if (/has been shipped/i.test(subj)) {
        orderStatus = "shipped";
    } else if (/out for delivery/i.test(subj)) {
        orderStatus = "out_for_delivery";
    } else if (/has been delivered/i.test(subj)) {
        orderStatus = "delivered";
    } else if (/has been canceled|has been cancelled|cancellation/i.test(subj)) {
        orderStatus = "canceled";
    }

    // Order number: subject "Order #DO7445 confirmed" or body "Order #DO7445"
    let orderNumber = null;

    const subjectMatch = subj.match(/Order\s*#\s*([A-Za-z0-9]+)/i);
    if (subjectMatch && subjectMatch[1]) {
        orderNumber = subjectMatch[1].trim();
    }

    if (!orderNumber && (html || text)) {
        const bodyMatch = (html || text).match(/Order\s*#\s*([A-Za-z0-9]+)/i);
        if (bodyMatch && bodyMatch[1]) {
            orderNumber = bodyMatch[1].trim();
        }
    }

    // Totals from HTML if available
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

    // Items: HTML first, text fallback
    let items = [];
    if (html) {
        items = parseItemsFromHtml(html);
    }
    if ((!items || !items.length) && text) {
        items = parseItemsFromText(text);
    }

    return {
        vendor: "Jimmy Buddha Designs / Diablo Organics",
        vendorKey: "crucial_diablo",
        orderNumber,
        orderStatus, // added
        orderDate: date ? new Date(date) : null,
        poNumber: null,
        currency: "USD",
        subtotal,
        shipping,
        tax,
        total,
        items,
        rawEmailMetadata: {
            subject,
            from,
        },
    };
}

export default {
    parseCrucialDiabloOrder,
};

