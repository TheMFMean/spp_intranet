// config/vendorEmailConfig.js
// AUTO-GENERATED from vendor email samples
// DO NOT EDIT MANUALLY - regenerate using scripts/generateVendorConfigFromSamples.js

const vendorEmailConfig = {
    anatometal: {
        vendorId: "anatometal",
        displayName: "Anatometal",
        sharedMailbox: "jewelryorders@sodapoppiercing.com",
        replyToTokens: ["anatometal.com"],
        vendorNameTokens: ["anatometal", "angel ingram", "angel", "ingram", "lindsey sinner", "lindsey", "sinner", "cody mahler", "cody", "mahler"],
        statusPatterns: {
            shipped: [/shipment/i, /on\s+the\s+way/i],
            out_for_delivery: [/out\s+for\s+delivery/i],
            delivered: [/has\s+been\s+delivered/i, /delivered/i],
        },
    },

    cascade: {
        vendorId: "cascade",
        displayName: "Jenna Allen",
        sharedMailbox: "jewelryorders@sodapoppiercing.com",
        replyToTokens: ["cascadebodyjewelry.com"],
        vendorNameTokens: ["jenna allen", "jenna", "allen", "shop.cascadebodyjewelry.com", "jeremy upshaw", "jeremy", "upshaw", "cascade body jewelry", "cascade"],
        allowedFromDisplayTokens: ["shop.cascadebodyjewelry.com", "jeremy@cascadebodyjewelry.com", "cascadebodyjewelry.com"],
        ignoreFromDisplayTokens: ["jenna allen personal"],
        statusPatterns: {
            confirmed: [/invoice/i, /order\s*#/i],
            shipped: [/shipment/i, /on\s+the\s+way/i],
            out_for_delivery: [/out\s+for\s+delivery/i],
            delivered: [/has\s+been\s+delivered/i, /delivered/i],
        },
        ignorePatterns: [/mill\s+cert/i, /password/i, /personal/i, /question/i],
    },

    cinch: {
        vendorId: "cinch",
        displayName: "Cinch",
        sharedMailbox: "jewelryorders@sodapoppiercing.com",
        replyToTokens: ["cinch.jewelry"],
        vendorNameTokens: ["cinch", "jaime getman", "jaime", "getman"],
        statusPatterns: {
            confirmed: [/order\s+confirmed/i],
        },
    },

    diablo_organics: {
        vendorId: "diablo_organics",
        displayName: "Jimmy Buddha Designs",
        sharedMailbox: "jewelryorders@sodapoppiercing.com",
        replyToTokens: ["diabloorganics.com"],
        vendorNameTokens: ["jimmy buddha designs", "jimmy", "buddha"],
        statusPatterns: {
            confirmed: [/invoice/i],
            shipped: [/shipment/i, /on\s+the\s+way/i],
            out_for_delivery: [/out\s+for\s+delivery/i],
            delivered: [/has\s+been\s+delivered/i, /delivered/i],
            canceled: [/cancel(ed|lation)?/i],
        },
    },

    ember: {
        vendorId: "ember",
        displayName: "Ember Body Jewelry",
        sharedMailbox: "jewelryorders@sodapoppiercing.com",
        replyToTokens: ["emberjewelrywholesale.com"],
        vendorNameTokens: ["ember body jewelry", "ember", "yorba huynh", "yorba", "huynh", "yorba linda | ember body jewelry", "linda"],
        statusPatterns: {
            confirmed: [/invoice/i],
            shipped: [/shipment/i, /on\s+the\s+way/i],
            delivered: [/delivered/i],
        },
        ignorePatterns: [/catalog/i, /password/i],
    },

    glass_wear: {
        vendorId: "glass_wear",
        displayName: "office@glasswearstudios.com",
        sharedMailbox: "jewelryorders@sodapoppiercing.com",
        replyToTokens: ["glasswearstudios.com"],
        vendorNameTokens: ["office@glasswearstudios.com"],
        statusPatterns: {
            confirmed: [/order\s+confirmation/i],
        },
    },

    hrf: {
        vendorId: "hrf",
        displayName: "HRF Concepts",
        sharedMailbox: "jewelryorders@sodapoppiercing.com",
        replyToTokens: ["hrfconcepts.com"],
        vendorNameTokens: ["hrf"],
        statusPatterns: {
        },
    },

    isc: {
        vendorId: "isc",
        displayName: "=?utf-8?Q?IS=20Body=20Jewelry?=",
        sharedMailbox: "jewelryorders@sodapoppiercing.com",
        replyToTokens: ["isbodyjewelry.com", "isbodyjewelry.com>"],
        vendorNameTokens: ["=?utf-8?q?is=20body=20jewelry?=", "=?utf-8?q?industrial=20strength=20marketing?=", "=?utf-8?q?jonathan?=", "casandra ramirez", "casandra", "ramirez", "info change", "info", "change"],
        statusPatterns: {
            confirmed: [/order\s+confirmation/i],
        },
    },

    jtw: {
        vendorId: "jtw",
        displayName: "JTW, LLC",
        sharedMailbox: "jewelryorders@sodapoppiercing.com",
        replyToTokens: ["jewelrythisway.com"],
        vendorNameTokens: ["jtw, llc", "jtw,", "jewelry thisway", "thisway"],
        statusPatterns: {
            confirmed: [/invoice/i],
            shipped: [/shipment/i, /on\s+the\s+way/i],
            out_for_delivery: [/out\s+for\s+delivery/i],
            delivered: [/has\s+been\s+delivered/i, /delivered/i],
            refunded: [/refund(ed)?/i, /credit\s+memo/i],
        },
    },

    junipurr: {
        vendorId: "junipurr",
        displayName: "Junipurr Jewelry",
        sharedMailbox: "jewelryorders@sodapoppiercing.com",
        replyToTokens: ["junipurrjewelry.com"],
        vendorNameTokens: ["junipurr jewelry", "junipurr"],
        statusPatterns: {
        },
    },

    maya: {
        vendorId: "maya",
        displayName: "Maya",
        sharedMailbox: "jewelryorders@sodapoppiercing.com",
        replyToTokens: ["mayajewelry.com"],
        vendorNameTokens: ["maya jewelry", "=?utf-8?q?maya=20jewelry?=", "=?utf-8?q?your=20secret=20admirers=20at=20maya=20jewelry?="],
        allowedFromDisplayTokens: ["maya jewelry", "mayajewelry.com", "info@mayajewelry.com"],
        ignoreFromDisplayTokens: ["maya organics", "maya personal"],
        statusPatterns: {
            confirmed: [/invoice/i],
            shipped: [/on\s+the\s+way/i],
            out_for_delivery: [/out\s+for\s+delivery/i],
            delivered: [/delivered/i],
        },
        ignorePatterns: [/newsletter/i, /promo/i, /sale/i, /catalog/i],
    },

    modern_mood: {
        vendorId: "modern_mood",
        displayName: "Modern Mood",
        sharedMailbox: "jewelryorders@sodapoppiercing.com",
        replyToTokens: ["modernmoodjewelry.com"],
        vendorNameTokens: ["modern mood", "modern", "mood", "modern mood body jewelry"],
        statusPatterns: {
            confirmed: [/invoice/i],
            shipped: [/shipment/i, /on\s+the\s+way/i],
            out_for_delivery: [/out\s+for\s+delivery/i],
            delivered: [/has\s+been\s+delivered/i, /delivered/i],
        },
    },

    mushroom: {
        vendorId: "mushroom",
        displayName: "Mushroom Body Jewelry",
        sharedMailbox: "jewelryorders@sodapoppiercing.com",
        replyToTokens: ["mushroombodyjewelry.com"],
        vendorNameTokens: ["mushroom body jewelry", "mushroom"],
        statusPatterns: {
        },
    },

    neometal: {
        vendorId: "neometal",
        displayName: "NeoMetal Inc",
        sharedMailbox: "jewelryorders@sodapoppiercing.com",
        replyToTokens: ["neometal.com"],
        vendorNameTokens: ["neometal inc", "neometal", "claire lawrence", "claire", "lawrence"],
        statusPatterns: {
            shipped: [/on\s+the\s+way/i],
            out_for_delivery: [/out\s+for\s+delivery/i],
            delivered: [/has\s+been\s+delivered/i, /delivered/i],
        },
        ignorePatterns: [/newsletter/i, /password/i],
    },

    oracle: {
        vendorId: "oracle",
        displayName: "Oracle Body Jewelry",
        sharedMailbox: "jewelryorders@sodapoppiercing.com",
        replyToTokens: ["oraclebodyjewelry.com"],
        vendorNameTokens: ["oracle body jewelry", "oracle"],
        statusPatterns: {
            shipped: [/on\s+the\s+way/i],
            out_for_delivery: [/out\s+for\s+delivery/i],
            delivered: [/has\s+been\s+delivered/i, /delivered/i],
            refunded: [/refund(ed)?/i, /credit\s+memo/i],
        },
        ignorePatterns: [/password/i],
    },

    quetzalli: {
        vendorId: "quetzalli",
        displayName: "Quetzalli Jewelry",
        sharedMailbox: "jewelryorders@sodapoppiercing.com",
        replyToTokens: ["quetzallijewelry.com"],
        vendorNameTokens: ["quetzalli jewelry", "quetzalli"],
        statusPatterns: {
            confirmed: [/thank\s+you\s+for\s+your\s+order/i, /order\s+confirmed/i],
            out_for_delivery: [/out\s+for\s+delivery/i],
            delivered: [/has\s+been\s+delivered/i, /delivered/i],
            canceled: [/cancel(ed|lation)?/i],
        },
    },

    tawapa: {
        vendorId: "tawapa",
        displayName: "TAWAPA Wholesale",
        sharedMailbox: "jewelryorders@sodapoppiercing.com",
        replyToTokens: ["tawapa.com"],
        vendorNameTokens: ["tawapa wholesale", "tawapa"],
        statusPatterns: {
            shipped: [/shipment/i, /on\s+the\s+way/i],
            out_for_delivery: [/out\s+for\s+delivery/i],
            delivered: [/has\s+been\s+delivered/i, /delivered/i],
        },
        ignorePatterns: [/password/i],
    },

    tether: {
        vendorId: "tether",
        displayName: "Tether",
        sharedMailbox: "jewelryorders@sodapoppiercing.com",
        replyToTokens: ["tetherjewelry.com"],
        vendorNameTokens: ["tether", "tether jewelry", "eleni evangelatos", "eleni", "evangelatos"],
        statusPatterns: {
            confirmed: [/invoice/i],
            shipped: [/on\s+the\s+way/i],
            out_for_delivery: [/out\s+for\s+delivery/i],
            delivered: [/has\s+been\s+delivered/i, /delivered/i],
            refunded: [/refund(ed)?/i, /credit\s+memo/i],
        },
        ignorePatterns: [/password/i],
    },

    vira: {
        vendorId: "vira",
        displayName: "Vira",
        sharedMailbox: "jewelryorders@sodapoppiercing.com",
        replyToTokens: ["virajewelry.com"],
        vendorNameTokens: ["vira"],
        statusPatterns: {
            confirmed: [/invoice/i],
            shipped: [/shipment/i, /on\s+the\s+way/i],
            out_for_delivery: [/out\s+for\s+delivery/i],
            delivered: [/has\s+been\s+delivered/i, /delivered/i],
            refunded: [/refund(ed)?/i, /credit\s+memo/i],
        },
    },

};

/**
 * Classify a vendor order email based on metadata and body text.
 * 
 * @param {Object} meta - Email metadata
 * @param {string} meta.from - From header
 * @param {string} meta.replyTo - Reply-To header
 * @param {string} meta.subject - Subject line
 * @param {string} bodyText - Email body text
 * @returns {{isOrderEmail: boolean, vendorId: string|null, orderStatus: string|null}}
 */
function classifyVendorOrderEmail(meta, bodyText) {
    const replyTo = (meta.replyTo || "").toLowerCase();
    const from = (meta.from || "").toLowerCase();
    const subject = (meta.subject || "").toLowerCase();
    const body = (bodyText || "").toLowerCase();
    const textBlob = `${subject}\n${body}`;

    // Find matching vendor
    let matchedVendor = null;
    let matchMethod = null;

    // Priority 1: Match by Reply-To domain
    for (const [vendorId, vendor] of Object.entries(vendorEmailConfig)) {
        for (const token of vendor.replyToTokens) {
            if (replyTo.includes(token.toLowerCase())) {
                matchedVendor = vendor;
                matchMethod = `replyTo:${token}`;
                break;
            }
        }
        if (matchedVendor) break;
    }

    // Priority 2: Match by From domain (if not sodapoppiercing)
    if (!matchedVendor && !from.includes("sodapoppiercing")) {
        for (const [vendorId, vendor] of Object.entries(vendorEmailConfig)) {
            for (const token of vendor.replyToTokens) {
                if (from.includes(token.toLowerCase())) {
                    matchedVendor = vendor;
                    matchMethod = `from:${token}`;
                    break;
                }
            }
            if (matchedVendor) break;
        }
    }

    // Priority 3: Match by vendor name in subject or from display name
    if (!matchedVendor) {
        for (const [vendorId, vendor] of Object.entries(vendorEmailConfig)) {
            for (const token of vendor.vendorNameTokens) {
                if (subject.includes(token.toLowerCase()) || from.includes(token.toLowerCase())) {
                    matchedVendor = vendor;
                    matchMethod = `name:${token}`;
                    break;
                }
            }
            if (matchedVendor) break;
        }
    }

    if (!matchedVendor) {
        return { isOrderEmail: false, vendorId: null, orderStatus: null, matchMethod: null };
    }

    // Check ignore patterns first
    if (matchedVendor.ignorePatterns) {
        for (const patternStr of matchedVendor.ignorePatterns) {
            const pattern = eval(patternStr);
            if (pattern.test(textBlob)) {
                return {
                    isOrderEmail: false,
                    vendorId: matchedVendor.vendorId,
                    orderStatus: "ignored",
                    matchMethod
                };
            }
        }
    }

    // Check status patterns in priority order
    const statusPriority = ["canceled", "refunded", "delivered", "out_for_delivery", "shipped", "confirmed"];

    for (const status of statusPriority) {
        const patterns = matchedVendor.statusPatterns[status];
        if (!patterns) continue;

        for (const patternStr of patterns) {
            const pattern = eval(patternStr);
            if (pattern.test(textBlob)) {
                return {
                    isOrderEmail: true,
                    vendorId: matchedVendor.vendorId,
                    orderStatus: status,
                    matchMethod
                };
            }
        }
    }

    // Matched vendor but no clear status - mark as "other"
    return {
        isOrderEmail: false,
        vendorId: matchedVendor.vendorId,
        orderStatus: "other",
        matchMethod
    };
}

export { vendorEmailConfig, classifyVendorOrderEmail };
