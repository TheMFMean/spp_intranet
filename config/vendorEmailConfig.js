// config/vendorEmailConfig.js
// Vendor email configuration for Gmail search and order classification.
// Each vendor includes:
// - emailFromTokens: domains/addresses for Gmail search
// - subjectQuery: Gmail query for subject filtering
// - headerTokens: tokens for header matching
// - statusPatterns: regex patterns for lifecycle state detection

const vendorEmailConfig = [
    {
        vendorId: "quetzalli",
        displayName: "Quetzalli Jewelry",
        queryType: "from", // Use from-based query only
        emailFromTokens: [
            "@quetzallijewelry.com",
            "contact@quetzallijewelry.com",
        ],
        // Removed generic subjectQuery - using from-based filtering only
        headerTokens: ["quetzallijewelry.com", "Quetzalli Jewelry"],
        statusPatterns: {
            canceled: [/order\s+(canceled|cancelled)/i, /has\s+been\s+cancelled/i],
            refunded: [/has\s+been\s+refunded/i, /refund\s+issued/i],
            delivered: [/has\s+been\s+delivered/i, /order\s+was\s+delivered/i, /delivery\s+confirmation/i],
            out_for_delivery: [/out\s+for\s+delivery/i, /is\s+out\s+for\s+delivery/i],
            shipped: [/order\s+has\s+shipped/i, /shipment\s+for\s+order/i, /tracking\s+number/i, /is\s+on\s+the\s+way/i],
            confirmed: [/order\s+confirmation/i, /thank\s+you\s+for\s+your\s+order/i, /order\s+confirmed/i],
        },
    },

    {
        vendorId: "oracle",
        displayName: "Oracle Body Jewelry",
        queryType: "from", // Use from-based query only
        emailFromTokens: [
            "@oraclebodyjewelry.com",
            "noreply@oraclebodyjewelry.com",
            "orders@oraclebodyjewelry.com",
        ],
        // Removed generic subjectQuery - using from-based filtering only
        headerTokens: ["oraclebodyjewelry.com", "Oracle Body Jewelry"],
        statusPatterns: {
            canceled: [/order\s+(canceled|cancelled)/i],
            refunded: [/has\s+been\s+refunded/i, /refund\s+issued/i],
            delivered: [/has\s+been\s+delivered/i, /delivered/i],
            out_for_delivery: [/out\s+for\s+delivery/i],
            shipped: [/order\s+has\s+shipped/i, /shipment\s+notification/i, /tracking\s+number/i],
            confirmed: [/order\s+confirmation/i, /order\s+confirmed/i, /thank\s+you\s+for\s+your\s+order/i],
        },
    },

    {
        vendorId: "jtw",
        displayName: "Jewelry This Way",
        queryType: "from", // Use from-based query only
        emailFromTokens: [
            "@jewelrythisway.com",
            "@jtwbodyjewelry.com",
        ],
        // Removed generic subjectQuery - using from-based filtering only
        headerTokens: ["jtw", "Jewelry This Way"],
        statusPatterns: {
            canceled: [/order\s+(canceled|cancelled)/i, /has\s+been\s+cancelled/i],
            refunded: [/has\s+been\s+refunded/i, /refund\s+issued/i, /credit\s+issued/i],
            delivered: [/has\s+been\s+delivered/i, /order\s+has\s+been\s+delivered/i, /delivery\s+update/i],
            out_for_delivery: [/out\s+for\s+delivery/i, /is\s+out\s+for\s+delivery/i],
            shipped: [/shipment\s+from\s+order/i, /order\s+is\s+on\s+the\s+way/i, /is\s+on\s+the\s+way/i, /has\s+shipped/i],
            confirmed: [/order\s+confirmed/i, /thank\s+you\s+for\s+your\s+(purchase|order)/i],
        },
    },

    {
        vendorId: "cascade",
        displayName: "Cascade Body Jewelry",
        queryType: "from", // Use from-based query only
        emailFromTokens: [
            "@cascadebodyjewelry.com",
            "orders@cascadebodyjewelry.com",
        ],
        // Removed generic subjectQuery - using from-based filtering only
        headerTokens: ["cascadebodyjewelry.com", "Cascade Body Jewelry"],
        statusPatterns: {
            canceled: [/order\s+(canceled|cancelled)/i, /has\s+been\s+cancelled/i],
            refunded: [/has\s+been\s+refunded/i, /refund\s+issued/i, /credit\s+memo/i],
            delivered: [/has\s+been\s+delivered/i, /order\s+was\s+delivered/i, /delivery\s+confirmation/i],
            out_for_delivery: [/out\s+for\s+delivery/i, /is\s+out\s+for\s+delivery/i],
            shipped: [/order\s+has\s+shipped/i, /shipment\s+has\s+shipped/i, /items\s+in\s+this\s+shipment/i, /shipping\s+confirmation/i],
            confirmed: [/order\s+confirmed/i, /thank\s+you\s+for\s+your\s+order/i, /order\s+#/i, /invoice\s+#/i],
        },
    },

    {
        vendorId: "crucial_diablo",
        displayName: "Crucial Tattoo / Diablo",
        queryType: "from", // Use from-based query only
        emailFromTokens: [
            "@crucialtattoo.com",
            "@crucialdiablo.com",
            "orders@crucialdiablo.com",
        ],
        // Removed generic subjectQuery - using from-based filtering only
        headerTokens: ["crucialdiablo.com", "Crucial Diablo"],
        statusPatterns: {
            canceled: [/order\s+(canceled|cancelled)/i],
            refunded: [/has\s+been\s+refunded/i, /refund\s+issued/i],
            delivered: [/has\s+been\s+delivered/i, /delivered/i],
            out_for_delivery: [/out\s+for\s+delivery/i],
            shipped: [/order\s+has\s+shipped/i, /shipment\s+notification/i, /tracking\s+number/i],
            confirmed: [/order\s+confirmation/i, /thank\s+you\s+for\s+your\s+order/i],
        },
    },

    {
        vendorId: "anatometal",
        displayName: "ANATOMETAL",
        queryType: "from", // Use from-based query only
        emailFromTokens: [
            "@anatometal.com",
            "sales@anatometal.com",
            "orders@anatometal.com",
        ],
        // Removed generic subjectQuery - using from-based filtering only
        headerTokens: ["anatometal.com", "ANATOMETAL"],
        statusPatterns: {
            canceled: [/order\s+(canceled|cancelled)/i],
            refunded: [/has\s+been\s+refunded/i, /refund\s+issued/i],
            delivered: [/has\s+been\s+delivered/i, /delivered/i],
            out_for_delivery: [/out\s+for\s+delivery/i],
            shipped: [/has\s+shipped/i, /order\s+has\s+shipped/i, /tracking\s+number/i],
            confirmed: [/order\s+confirmation/i, /thank\s+you\s+for\s+your\s+order/i],
        },
    },

    {
        vendorId: "isc",
        displayName: "Industrial Strength",
        queryType: "from", // Use from-based query only
        emailFromTokens: [
            "@industrialstrengthbodyjewelry.com",
            "@isbodyjewelry.com",
        ],
        // Removed generic subjectQuery - using from-based filtering only
        headerTokens: ["industrialstrength", "Industrial Strength"],
        statusPatterns: {
            canceled: [/order\s+(canceled|cancelled)/i],
            refunded: [/has\s+been\s+refunded/i, /refund\s+issued/i],
            delivered: [/has\s+been\s+delivered/i, /delivered/i],
            out_for_delivery: [/out\s+for\s+delivery/i],
            shipped: [/shipment\s+for\s+order/i, /order\s+has\s+shipped/i, /tracking\s+number/i],
            confirmed: [/thanks\s+for\s+your\s+order/i, /thank\s+you\s+for\s+your\s+order/i, /order\s+id\s+#/i],
        },
    },

    {
        vendorId: "neometal",
        displayName: "NeoMetal",
        queryType: "from", // Use from-based query only
        emailFromTokens: [
            "@neometal.com",
        ],
        // Removed generic subjectQuery - using from-based filtering only
        headerTokens: ["neometal.com", "NeoMetal"],
        statusPatterns: {
            canceled: [/order\s+(canceled|cancelled)/i],
            refunded: [/has\s+been\s+refunded/i, /refund\s+issued/i],
            delivered: [/has\s+been\s+delivered/i, /delivered/i],
            out_for_delivery: [/out\s+for\s+delivery/i],
            shipped: [/order\s+has\s+shipped/i, /shipping\s+confirmation/i],
            confirmed: [/order\s+confirmation/i, /thank\s+you\s+for\s+your\s+order/i],
        },
    },

    {
        vendorId: "glass_wear",
        displayName: "Glasswear Studios",
        queryType: "from", // Use from-based query only
        emailFromTokens: [
            "@glasswearstudios.com",
        ],
        // Removed generic subjectQuery - using from-based filtering only
        headerTokens: ["glasswearstudios.com", "Glasswear Studios"],
        statusPatterns: {
            canceled: [/order\s+(canceled|cancelled)/i],
            refunded: [/has\s+been\s+refunded/i, /refund\s+issued/i],
            delivered: [/has\s+been\s+delivered/i, /delivered/i],
            out_for_delivery: [/out\s+for\s+delivery/i],
            shipped: [/order\s+has\s+shipped/i, /shipping\s+confirmation/i],
            confirmed: [/order\s+confirmation/i, /thank\s+you\s+for\s+your\s+order/i],
        },
    },

    {
        vendorId: "ember",
        displayName: "Ember Body Jewelry",
        queryType: "from", // Use from-based query only
        emailFromTokens: [
            "@emberbodyjewelry.com",
        ],
        // Removed generic subjectQuery - using from-based filtering only
        headerTokens: ["ember", "Ember Body Jewelry"],
        statusPatterns: {
            canceled: [/order\s+(canceled|cancelled)/i],
            refunded: [/has\s+been\s+refunded/i, /refund\s+issued/i],
            delivered: [/has\s+been\s+delivered/i, /delivered/i],
            out_for_delivery: [/out\s+for\s+delivery/i],
            shipped: [/order\s+has\s+shipped/i, /shipment\s+notification/i],
            confirmed: [/order\s+confirmation/i, /thank\s+you\s+for\s+your\s+order/i],
        },
    },

    {
        vendorId: "tether",
        displayName: "Tether Jewelry",
        queryType: "from", // Use from-based query only
        emailFromTokens: [
            "@tetherjewelry.com",
        ],
        // Removed generic subjectQuery - using from-based filtering only
        headerTokens: ["tetherjewelry.com", "Tether Jewelry"],
        statusPatterns: {
            canceled: [/order\s+(canceled|cancelled)/i],
            refunded: [/has\s+been\s+refunded/i, /refund\s+issued/i],
            delivered: [/has\s+been\s+delivered/i, /delivered/i],
            out_for_delivery: [/out\s+for\s+delivery/i],
            shipped: [/order\s+has\s+shipped/i, /shipment\s+notification/i, /tracking\s+number/i],
            confirmed: [/order\s+confirmation/i, /thank\s+you\s+for\s+your\s+order/i],
        },
    },

    {
        vendorId: "regalia",
        displayName: "Regalia Jewelry",
        queryType: "from", // Use from-based query only
        emailFromTokens: [
            "@regaliajewelry.com",
        ],
        // Removed generic subjectQuery - using from-based filtering only
        headerTokens: ["regalia", "Regalia Jewelry"],
        statusPatterns: {
            canceled: [/order\s+(canceled|cancelled)/i],
            refunded: [/has\s+been\s+refunded/i, /refund\s+issued/i],
            delivered: [/has\s+been\s+delivered/i, /delivered/i],
            out_for_delivery: [/out\s+for\s+delivery/i],
            shipped: [/order\s+has\s+shipped/i, /shipment\s+notification/i, /tracking\s+number/i],
            confirmed: [/order\s+confirmation/i, /thank\s+you\s+for\s+your\s+order/i],
        },
    },
];

/**
 * Classify a vendor order email based on metadata and body text.
 * 
 * @param {Object} meta - Email metadata
 * @param {string} meta.from - From header
 * @param {string} meta.to - To header
 * @param {string} meta.subject - Subject line
 * @param {string} bodyText - Email body text
 * @returns {{isOrderEmail: boolean, vendorId: string|null, orderStatus: string|null}}
 */
function classifyVendorOrderEmail(meta, bodyText) {
    const from = (meta.from || "").toLowerCase();
    const subject = (meta.subject || "").toLowerCase();
    const body = (bodyText || "").toLowerCase();
    const textBlob = `${subject}\n${body}`;

    // Find matching vendor based on emailFromTokens
    const vendor = vendorEmailConfig.find(v =>
        v.emailFromTokens.some(token => from.includes(token.toLowerCase()))
    );

    if (!vendor) {
        return { isOrderEmail: false, vendorId: null, orderStatus: null };
    }

    // Check status patterns in priority order: canceled, refunded, delivered, out_for_delivery, shipped, confirmed
    const statusPriority = ["canceled", "refunded", "delivered", "out_for_delivery", "shipped", "confirmed"];

    for (const status of statusPriority) {
        const patterns = vendor.statusPatterns[status] || [];
        for (const pattern of patterns) {
            if (pattern.test(textBlob)) {
                return {
                    isOrderEmail: true,
                    vendorId: vendor.vendorId,
                    orderStatus: status,
                };
            }
        }
    }

    // If no pattern matches but looks transactional, mark as "other" and not an order email
    const looksTransactional = /order\s*#|order\s*no\.|invoice\s*#/i.test(textBlob);

    if (looksTransactional) {
        return {
            isOrderEmail: false,
            vendorId: vendor.vendorId,
            orderStatus: "other",
        };
    }

    // No match at all
    return {
        isOrderEmail: false,
        vendorId: vendor.vendorId,
        orderStatus: null,
    };
}

export { vendorEmailConfig, classifyVendorOrderEmail };
