// /srv/backend/workers/gmailPoller.js
//
// VENDOR EMAIL CLASSIFICATION PROCESS:
// =====================================
// 1. Gmail queries fetch messages based on vendor emailFromTokens and subjectQuery
// 2. For each message, classifyVendorOrderEmail() is called with email metadata and body text
// 3. Classification logic:
//    - Matches vendor by emailFromTokens in the "from" header
//    - Scans body+subject for status patterns in priority order:
//      canceled → refunded → delivered → out_for_delivery → shipped → confirmed
//    - Returns { isOrderEmail: boolean, vendorId: string, orderStatus: string }
// 4. If isOrderEmail is false, the message is skipped (logged and not saved)
// 5. If isOrderEmail is true, the message proceeds to vendor-specific parsing
// 6. Accepted statuses: confirmed, shipped, out_for_delivery, delivered, canceled, refunded, other
//
// Note: "other" status means transactional email without clear lifecycle state (not saved as order event)

import dotenv from "dotenv";
dotenv.config();

import { createGmailClient } from "../services/gmailClient.js";
import { vendorEmailConfig, classifyVendorOrderEmail } from "../config/vendorEmailConfig.js";
import { fetchAndExtractMessage } from "../services/emailExtractor.js";

// Vendor parsers
import { parseGlasswearOrder } from "../services/glasswearParser.js";
import { parseCascadeOrder } from "../services/cascadeParser.js";
import { parseAnatometalOrder } from "../services/anatometalParser.js";
import { parseNeometalOrder } from "../services/neometalParser.js";
import { parseCrucialDiabloOrder } from "../services/crucialDiabloParser.js";
import { parseIscOrder } from "../services/iscParser.js";
import { parseEmberOrder } from "../services/emberParser.js";
import { parseTetherOrder } from "../services/tetherParser.js";
import { parseJtwOrder } from "../services/jtwParser.js";
import { parseRegaliaOrder } from "../services/regaliaParser.js";
import { parseOracleOrder } from "../services/oracleParser.js";
import { parseQuetzalliOrder } from "../services/quetzalliParser.js";

import { isQuetzalliOrderEmail } from "../services/quetzalliGuards.js";
import { saveParsedOrder } from "../services/orderService.js";

// Default days back for Gmail queries; override via env if needed
const DAYS_BACK = parseInt(process.env.GMAIL_DAYS_BACK ?? "180", 10);

// ----------------------------------------
// Gmail helpers
// ----------------------------------------

// Global stats tracking for summary
const vendorStats = {};

function initVendorStats(vendorId) {
    if (!vendorStats[vendorId]) {
        vendorStats[vendorId] = {
            totalMessagesScanned: 0,
            orderEmailsClassified: 0,
            eventsPersisted: 0,
        };
    }
}

function incrementStat(vendorId, statName) {
    initVendorStats(vendorId);
    vendorStats[vendorId][statName]++;
}

/**
 * Helper to classify if an email is a vendor order email
 * Returns null if not an order email, otherwise returns classification
 */
async function classifyEmail(gmail, details, vendorId) {
    try {
        const content = await fetchAndExtractMessage(gmail, details.id);
        const bodyText = content.textPlain || content.textHtml || "";

        const meta = {
            from: details.from,
            to: details.headers.find(h => h.name.toLowerCase() === 'to')?.value || '',
            subject: details.subject,
        };

        const classification = classifyVendorOrderEmail(meta, bodyText);

        if (!classification.isOrderEmail) {
            console.log("    classification: not an order email; skipping");
            return null;
        }

        console.log(`    classification: vendorId=${classification.vendorId}, status=${classification.orderStatus}`);
        incrementStat(vendorId, 'orderEmailsClassified');
        return { classification, content, bodyText };
    } catch (err) {
        console.error("    error during classification:", err.message);
        return null;
    }
}

async function listMessagesForQuery(gmail, query, maxResults = 20) {
    const res = await gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults,
    });

    return res.data.messages || [];
}

async function getMessageDetails(gmail, messageId) {
    const res = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "full",
    });

    const payload = res.data.payload || {};
    const headers = payload.headers || [];

    function getHeader(name) {
        const h = headers.find(
            (hdr) => hdr.name && hdr.name.toLowerCase() === name.toLowerCase()
        );
        return h?.value || "";
    }

    return {
        id: messageId,
        subject: getHeader("Subject"),
        from: getHeader("From"),
        date: getHeader("Date"),
        headers,
    };
}

// Build a from: query like: from:(@quetzallijewelry.com OR contact@quetzallijewelry.com)
function buildFromQuery(vendor) {
    const tokens = vendor.emailFromTokens;
    if (!tokens || !tokens.length) return null;
    const inner = tokens.join(" OR ");
    return `from:(${inner})`;
}

// Scan headers for vendor tokens across multiple header fields
function findMatchingHeaders(vendor, headers) {
    const tokens =
        vendor.headerTokens && vendor.headerTokens.length
            ? vendor.headerTokens
            : [vendor.displayName];

    const headerNamesToCheck = [
        "From",
        "To",
        "Cc",
        "Bcc",
        "Reply-To",
        "Delivered-To",
        "Return-Path",
        "List-Id",
        "Subject",
    ];

    const matches = [];

    for (const hdr of headers) {
        if (!hdr.name || !hdr.value) continue;

        if (!headerNamesToCheck.includes(hdr.name)) continue;

        const valLower = hdr.value.toLowerCase();

        for (const token of tokens) {
            if (!token) continue;
            const tokenLower = token.toLowerCase();
            if (valLower.includes(tokenLower)) {
                matches.push({
                    headerName: hdr.name,
                    token,
                    value: hdr.value,
                });
            }
        }
    }

    return matches;
}

// Event save rule: save if there are items OR a real status
function isOrderEvent(parsed) {
    const hasItems = parsed.items && parsed.items.length > 0;
    const status = parsed.orderStatus || parsed.order_status;
    const hasStatus = status && status !== "other";
    return hasItems || hasStatus;
}

// ----------------------------------------
// Per vendor handlers
// ----------------------------------------

async function handleGlasswear(gmail, vendor, details, headerMatches) {
    if (!headerMatches.length) return;

    const result = await classifyEmail(gmail, details, vendor.vendorId);
    if (!result) return;

    const { classification, content, bodyText: rawText } = result;

    try {
        const parsed = parseGlasswearOrder({
            textPlain: content.textPlain || "",
            textHtml: content.textHtml || "",
            subject: details.subject || "",
            date: details.date || "",
        });

        // Use classification orderStatus if available
        if (classification.orderStatus) {
            parsed.orderStatus = classification.orderStatus;
        }

        if (!isOrderEvent(parsed)) {
            console.log("    no Glasswear order event detected; skipping");
            return;
        }

        const preview = (rawText || "").slice(0, 120).replace(/\s+/g, " ");
        console.log(`    [glass_wear] text preview: ${preview || "[no text found]"}`);
        console.log(
            `    [glass_wear] parsed: orderNumber=${parsed.orderNumber ?? ""}, items=${(parsed.items || []).length}, total=${parsed.total ?? ""}, status=${parsed.orderStatus ?? ""}`
        );

        if (parsed.items && parsed.items.length) {
            for (const item of parsed.items.slice(0, 5)) {
                console.log(
                    `      item: sku=${item.sku ?? ""} qty=${item.quantity ?? ""} unit=${item.unitPrice ?? ""} line=${item.lineTotal ?? ""} desc="${item.description || ""}"`
                );
            }
        }

        const saved = await saveParsedOrder({
            vendorId: classification.vendorId || vendor.vendorId,
            gmailMessageId: details.id,
            gmailThreadId: null,
            parsedOrder: parsed,
            rawText,
            attachments: content.attachments || [],
        });

        incrementStat(vendor.vendorId, 'eventsPersisted');
        console.log(
            `    [glass_wear] saved to DB: orderId=${saved.id}, items=${saved.items.length}`
        );
    } catch (err) {
        console.error(
            "    error extracting or parsing/saving Glasswear content:",
            err.message
        );
    }
}

async function handleCascade(gmail, vendor, details, headerMatches) {
    if (!headerMatches.length) return;

    const result = await classifyEmail(gmail, details, vendor.vendorId);
    if (!result) return;

    const { classification, content, bodyText: rawText } = result;

    try {
        const parsed = parseCascadeOrder({
            textPlain: content.textPlain || "",
            textHtml: content.textHtml || "",
            subject: details.subject || "",
            date: details.date || "",
            orderStatus: classification.orderStatus,
        });

        if (!isOrderEvent(parsed)) {
            console.log("    no Cascade order event detected; skipping");
            return;
        }

        const preview = (rawText || "").slice(0, 120).replace(/\s+/g, " ");
        console.log(`    [cascade] text preview: ${preview || "[no text found]"}`);
        console.log(
            `    [cascade] parsed: orderNumber=${parsed.orderNumber ?? ""}, items=${(parsed.items || []).length}, total=${parsed.total ?? ""}, status=${parsed.orderStatus ?? ""}`
        );

        if (parsed.items && parsed.items.length) {
            for (const item of parsed.items.slice(0, 5)) {
                console.log(
                    `      item: sku=${item.sku ?? ""} qty=${item.quantity ?? ""} unit=${item.unitPrice ?? ""} line=${item.lineTotal ?? ""} desc="${item.description || ""}"`
                );
            }
        }

        const saved = await saveParsedOrder({
            vendorId: classification.vendorId || vendor.vendorId,
            gmailMessageId: details.id,
            gmailThreadId: null,
            parsedOrder: parsed,
            rawText,
            attachments: content.attachments || [],
        });

        incrementStat(vendor.vendorId, 'eventsPersisted');
        console.log(
            `    [cascade] saved to DB: orderId=${saved.id}, items=${saved.items.length}`
        );
    } catch (err) {
        console.error(
            "    error extracting or parsing/saving Cascade content:",
            err.message
        );
    }
}

async function handleAnatometal(gmail, vendor, details, headerMatches) {
    if (!headerMatches.length) return;

    const result = await classifyEmail(gmail, details, vendor.vendorId);
    if (!result) return;

    const { classification, content, bodyText: rawText } = result;

    try {
        const parsed = parseAnatometalOrder({
            textPlain: content.textPlain || "",
            textHtml: content.textHtml || "",
            subject: details.subject || "",
            date: details.date || "",
        });

        if (classification.orderStatus) {
            parsed.orderStatus = classification.orderStatus;
        }

        if (!isOrderEvent(parsed)) {
            console.log("    no Anatometal order event detected; skipping");
            return;
        }

        const preview = (rawText || "").slice(0, 120).replace(/\s+/g, " ");
        console.log(`    [anatometal] text preview: ${preview || "[no text found]"}`);
        console.log(
            `    [anatometal] parsed: orderNumber=${parsed.orderNumber ?? ""}, items=${(parsed.items || []).length}, total=${parsed.total ?? ""}, status=${parsed.orderStatus ?? ""}`
        );

        if (parsed.items && parsed.items.length) {
            for (const item of parsed.items.slice(0, 5)) {
                console.log(
                    `      item: sku=${item.sku ?? ""} qty=${item.quantity ?? ""} unit=${item.unitPrice ?? ""} line=${item.lineTotal ?? ""} desc="${item.description || ""}"`
                );
            }
        }

        const saved = await saveParsedOrder({
            vendorId: classification.vendorId || vendor.vendorId,
            gmailMessageId: details.id,
            gmailThreadId: null,
            parsedOrder: parsed,
            rawText,
            attachments: content.attachments || [],
        });

        incrementStat(vendor.vendorId, 'eventsPersisted');
        console.log(
            `    [anatometal] saved to DB: orderId=${saved.id}, items=${saved.items.length}`
        );
    } catch (err) {
        console.error(
            "    error extracting or parsing/saving Anatometal content:",
            err.message
        );
    }
}

async function handleNeometal(gmail, vendor, details, headerMatches) {
    if (!headerMatches.length) return;

    const result = await classifyEmail(gmail, details, vendor.vendorId);
    if (!result) return;

    const { classification, content, bodyText: rawText } = result;

    try {
        const parsed = parseNeometalOrder({
            textPlain: content.textPlain || "",
            textHtml: content.textHtml || "",
            subject: details.subject || "",
            date: details.date || "",
        });

        if (classification.orderStatus) {
            parsed.orderStatus = classification.orderStatus;
        }

        if (!isOrderEvent(parsed)) {
            console.log("    no Neometal order event detected; skipping");
            return;
        }

        const preview = (rawText || "").slice(0, 120).replace(/\s+/g, " ");
        console.log(`    [neometal] text preview: ${preview || "[no text found]"}`);
        console.log(
            `    [neometal] parsed: orderNumber=${parsed.orderNumber ?? ""}, items=${(parsed.items || []).length}, total=${parsed.total ?? ""}, status=${parsed.orderStatus ?? ""}`
        );

        if (parsed.items && parsed.items.length) {
            for (const item of parsed.items.slice(0, 5)) {
                console.log(
                    `      item: sku=${item.sku ?? ""} qty=${item.quantity ?? ""} unit=${item.unitPrice ?? ""} line=${item.lineTotal ?? ""} desc="${item.description || ""}"`
                );
            }
        }

        const saved = await saveParsedOrder({
            vendorId: classification.vendorId || vendor.vendorId,
            gmailMessageId: details.id,
            gmailThreadId: null,
            parsedOrder: parsed,
            rawText,
            attachments: content.attachments || [],
        });

        incrementStat(vendor.vendorId, 'eventsPersisted');
        console.log(
            `    [neometal] saved to DB: orderId=${saved.id}, items=${saved.items.length}`
        );
    } catch (err) {
        console.error(
            "    error extracting or parsing/saving Neometal content:",
            err.message
        );
    }
}

async function handleCrucialDiablo(gmail, vendor, details, headerMatches) {
    if (!headerMatches.length) return;

    const result = await classifyEmail(gmail, details, vendor.vendorId);
    if (!result) return;

    const { classification, content, bodyText: rawText } = result;

    try {
        const parsed = parseCrucialDiabloOrder({
            textPlain: content.textPlain || "",
            textHtml: content.textHtml || "",
            subject: details.subject || "",
            date: details.date || "",
        });

        if (classification.orderStatus) {
            parsed.orderStatus = classification.orderStatus;
        }

        if (!isOrderEvent(parsed)) {
            console.log("    no Crucial/Diablo order event detected; skipping");
            return;
        }

        const preview = (rawText || "").slice(0, 120).replace(/\s+/g, " ");
        console.log(
            `    [crucial_diablo] text preview: ${preview || "[no text found]"}`
        );
        console.log(
            `    [crucial_diablo] parsed: orderNumber=${parsed.orderNumber ?? ""}, items=${(parsed.items || []).length}, total=${parsed.total ?? ""}, status=${parsed.orderStatus ?? ""}`
        );

        if (parsed.items && parsed.items.length) {
            for (const item of parsed.items.slice(0, 5)) {
                console.log(
                    `      item: sku=${item.sku ?? ""} qty=${item.quantity ?? ""} unit=${item.unitPrice ?? ""} line=${item.lineTotal ?? ""} desc="${item.description || ""}"`
                );
            }
        }

        const saved = await saveParsedOrder({
            vendorId: classification.vendorId || vendor.vendorId,
            gmailMessageId: details.id,
            gmailThreadId: null,
            parsedOrder: parsed,
            rawText,
            attachments: content.attachments || [],
        });

        incrementStat(vendor.vendorId, 'eventsPersisted');
        console.log(
            `    [crucial_diablo] saved to DB: orderId=${saved.id}, items=${saved.items.length}`
        );
    } catch (err) {
        console.error(
            "    error extracting or parsing/saving Crucial/Diablo content:",
            err.message
        );
    }
}

async function handleIsc(gmail, vendor, details, headerMatches) {
    if (!headerMatches.length) return;

    const result = await classifyEmail(gmail, details, vendor.vendorId);
    if (!result) return;

    const { classification, content, bodyText: rawText } = result;

    try {
        const parsed = parseIscOrder({
            textPlain: content.textPlain || "",
            textHtml: content.textHtml || "",
            subject: details.subject || "",
            date: details.date || "",
        });

        if (classification.orderStatus) {
            parsed.orderStatus = classification.orderStatus;
        }

        if (!isOrderEvent(parsed)) {
            console.log("    no ISC order event detected; skipping");
            return;
        }

        const preview = (rawText || "").slice(0, 120).replace(/\s+/g, " ");
        console.log(`    [isc] text preview: ${preview || "[no text found]"}`);
        console.log(
            `    [isc] parsed: orderNumber=${parsed.orderNumber ?? ""}, items=${(parsed.items || []).length}, total=${parsed.total ?? ""}, status=${parsed.orderStatus ?? ""}`
        );

        if (parsed.items && parsed.items.length) {
            for (const item of parsed.items.slice(0, 5)) {
                console.log(
                    `      item: sku=${item.sku ?? ""} qty=${item.quantity ?? ""} unit=${item.unitPrice ?? ""} line=${item.lineTotal ?? ""} desc="${item.description || ""}"`
                );
            }
        }

        const saved = await saveParsedOrder({
            vendorId: classification.vendorId || vendor.vendorId,
            gmailMessageId: details.id,
            gmailThreadId: null,
            parsedOrder: parsed,
            rawText,
            attachments: content.attachments || [],
        });

        incrementStat(vendor.vendorId, 'eventsPersisted');
        console.log(
            `    [isc] saved to DB: orderId=${saved.id}, items=${saved.items.length}`
        );
    } catch (err) {
        console.error(
            "    error extracting or parsing/saving ISC content:",
            err.message
        );
    }
}

async function handleEmber(gmail, vendor, details, headerMatches) {
    if (!headerMatches.length) return;

    const result = await classifyEmail(gmail, details, vendor.vendorId);
    if (!result) return;

    const { classification, content, bodyText: rawText } = result;

    try {
        const parsed = parseEmberOrder({
            textPlain: content.textPlain || "",
            textHtml: content.textHtml || "",
            subject: details.subject || "",
            date: details.date || "",
            orderStatus: classification.orderStatus,
        });

        if (!isOrderEvent(parsed)) {
            console.log("    no Ember order event detected; skipping");
            return;
        }

        const preview = (rawText || "").slice(0, 120).replace(/\s+/g, " ");
        console.log(`    [ember] text preview: ${preview || "[no text found]"}`);
        console.log(
            `    [ember] parsed: orderNumber=${parsed.orderNumber ?? ""}, items=${(parsed.items || []).length}, total=${parsed.total ?? ""}, status=${parsed.orderStatus ?? ""}`
        );

        if (parsed.items && parsed.items.length) {
            for (const item of parsed.items.slice(0, 5)) {
                console.log(
                    `      item: sku=${item.sku ?? ""} qty=${item.quantity ?? ""} unit=${item.unitPrice ?? ""} line=${item.lineTotal ?? ""} desc="${item.description || ""}"`
                );
            }
        }

        const saved = await saveParsedOrder({
            vendorId: classification.vendorId || vendor.vendorId,
            gmailMessageId: details.id,
            gmailThreadId: null,
            parsedOrder: parsed,
            rawText,
            attachments: content.attachments || [],
        });

        incrementStat(vendor.vendorId, 'eventsPersisted');
        console.log(
            `    [ember] saved to DB: orderId=${saved.id}, items=${saved.items.length}`
        );
    } catch (err) {
        console.error(
            "    error extracting or parsing/saving Ember content:",
            err.message
        );
    }
}

async function handleTether(gmail, vendor, details, headerMatches) {
    if (!headerMatches.length) return;

    const result = await classifyEmail(gmail, details, vendor.vendorId);
    if (!result) return;

    const { classification, content, bodyText: rawText } = result;

    try {
        const parsed = parseTetherOrder({
            textPlain: content.textPlain || "",
            textHtml: content.textHtml || "",
            subject: details.subject || "",
            date: details.date || "",
            orderStatus: classification.orderStatus,
        });

        if (!isOrderEvent(parsed)) {
            console.log("    no Tether order event detected; skipping");
            return;
        }

        const preview = (rawText || "").slice(0, 120).replace(/\s+/g, " ");
        console.log(`    [tether] text preview: ${preview || "[no text found]"}`);
        console.log(
            `    [tether] parsed: orderNumber=${parsed.orderNumber ?? ""}, items=${(parsed.items || []).length}, total=${parsed.total ?? ""}, status=${parsed.orderStatus ?? ""}`
        );

        if (parsed.items && parsed.items.length) {
            for (const item of parsed.items.slice(0, 5)) {
                console.log(
                    `      item: sku=${item.sku ?? ""} qty=${item.quantity ?? ""} unit=${item.unitPrice ?? ""} line=${item.lineTotal ?? ""} desc="${item.description || ""}"`
                );
            }
        }

        const saved = await saveParsedOrder({
            vendorId: classification.vendorId || vendor.vendorId,
            gmailMessageId: details.id,
            gmailThreadId: null,
            parsedOrder: parsed,
            rawText,
            attachments: content.attachments || [],
        });

        incrementStat(vendor.vendorId, 'eventsPersisted');
        console.log(
            `    [tether] saved to DB: orderId=${saved.id}, items=${saved.items.length}`
        );
    } catch (err) {
        console.error(
            "    error extracting or parsing/saving Tether content:",
            err.message
        );
    }
}

async function handleJtw(gmail, vendor, details, headerMatches) {
    if (!headerMatches.length) return;

    const result = await classifyEmail(gmail, details, vendor.vendorId);
    if (!result) return;

    const { classification, content, bodyText: rawText } = result;

    try {
        const parsed = parseJtwOrder({
            textPlain: content.textPlain || "",
            textHtml: content.textHtml || "",
            subject: details.subject || "",
            date: details.date || "",
            orderStatus: classification.orderStatus,
        });

        if (!isOrderEvent(parsed)) {
            console.log("    no JTW order event detected; skipping");
            return;
        }

        const preview = (rawText || "").slice(0, 120).replace(/\s+/g, " ");
        console.log(`    [jtw] text preview: ${preview || "[no text found]"}`);
        console.log(
            `    [jtw] parsed: orderNumber=${parsed.orderNumber ?? ""}, items=${(parsed.items || []).length}, total=${parsed.total ?? ""}, status=${parsed.orderStatus ?? ""}`
        );

        if (parsed.items && parsed.items.length) {
            for (const item of parsed.items.slice(0, 5)) {
                console.log(
                    `      item: sku=${item.sku ?? ""} qty=${item.quantity ?? ""} unit=${item.unitPrice ?? ""} line=${item.lineTotal ?? ""} desc="${item.description || ""}"`
                );
            }
        }

        const saved = await saveParsedOrder({
            vendorId: classification.vendorId || vendor.vendorId,
            gmailMessageId: details.id,
            gmailThreadId: null,
            parsedOrder: parsed,
            rawText,
            attachments: content.attachments || [],
        });

        incrementStat(vendor.vendorId, 'eventsPersisted');
        console.log(
            `    [jtw] saved to DB: orderId=${saved.id}, items=${saved.items.length}`
        );
    } catch (err) {
        console.error(
            "    error extracting or parsing/saving JTW content:",
            err.message
        );
    }
}

async function handleRegalia(gmail, vendor, details, headerMatches) {
    if (!headerMatches.length) return;

    const result = await classifyEmail(gmail, details, vendor.vendorId);
    if (!result) return;

    const { classification, content, bodyText: rawText } = result;

    try {
        const parsed = parseRegaliaOrder({
            textPlain: content.textPlain || "",
            textHtml: content.textHtml || "",
            subject: details.subject || "",
            date: details.date || "",
            orderStatus: classification.orderStatus,
        });

        if (!isOrderEvent(parsed)) {
            console.log("    no Regalia order event detected; skipping");
            return;
        }

        const preview = (rawText || "").slice(0, 120).replace(/\s+/g, " ");
        console.log(`    [regalia] text preview: ${preview || "[no text found]"}`);
        console.log(
            `    [regalia] parsed: orderNumber=${parsed.orderNumber ?? ""}, items=${(parsed.items || []).length}, total=${parsed.total ?? ""}, status=${parsed.orderStatus ?? ""}`
        );

        if (parsed.items && parsed.items.length) {
            for (const item of parsed.items.slice(0, 5)) {
                console.log(
                    `      item: sku=${item.sku ?? ""} qty=${item.quantity ?? ""} unit=${item.unitPrice ?? ""} line=${item.lineTotal ?? ""} desc="${item.description || ""}"`
                );
            }
        }

        const saved = await saveParsedOrder({
            vendorId: classification.vendorId || vendor.vendorId,
            gmailMessageId: details.id,
            gmailThreadId: null,
            parsedOrder: parsed,
            rawText,
            attachments: content.attachments || [],
        });

        incrementStat(vendor.vendorId, 'eventsPersisted');
        console.log(
            `    [regalia] saved to DB: orderId=${saved.id}, items=${saved.items.length}`
        );
    } catch (err) {
        console.error(
            "    error extracting or parsing/saving Regalia content:",
            err.message
        );
    }
}

async function handleOracle(gmail, vendor, details, headerMatches) {
    if (!headerMatches.length) return;

    const result = await classifyEmail(gmail, details, vendor.vendorId);
    if (!result) return;

    const { classification, content, bodyText: rawText } = result;

    try {
        const parsed = parseOracleOrder({
            textPlain: content.textPlain || "",
            textHtml: content.textHtml || "",
            subject: details.subject || "",
            date: details.date || "",
            orderStatus: classification.orderStatus,
        });

        if (!isOrderEvent(parsed)) {
            console.log("    no Oracle order event detected; skipping");
            return;
        }

        const preview = (rawText || "").slice(0, 120).replace(/\s+/g, " ");
        console.log(`    [oracle] text preview: ${preview || "[no text found]"}`);
        console.log(
            `    [oracle] parsed: orderNumber=${parsed.orderNumber ?? ""}, items=${(parsed.items || []).length}, total=${parsed.total ?? ""}, status=${parsed.orderStatus ?? ""}`
        );

        if (parsed.items && parsed.items.length) {
            for (const item of parsed.items.slice(0, 5)) {
                console.log(
                    `      item: sku=${item.sku ?? ""} qty=${item.quantity ?? ""} unit=${item.unitPrice ?? ""} line=${item.lineTotal ?? ""} desc="${item.description || ""}"`
                );
            }
        }

        const saved = await saveParsedOrder({
            vendorId: classification.vendorId || vendor.vendorId,
            gmailMessageId: details.id,
            gmailThreadId: null,
            parsedOrder: parsed,
            rawText,
            attachments: content.attachments || [],
        });

        incrementStat(vendor.vendorId, 'eventsPersisted');
        console.log(
            `    [oracle] saved to DB: orderId=${saved.id}, items=${saved.items.length}`
        );
    } catch (err) {
        console.error(
            "    error extracting or parsing/saving Oracle content:",
            err.message
        );
    }
}

// Quetzalli with the additional guard helper
async function handleQuetzalli(gmail, vendor, details, headerMatches) {
    // We still like to see some header match, but the real gate is isQuetzalliOrderEmail
    if (!headerMatches.length) {
        console.log("    no header match for Quetzalli; skipping");
        return;
    }

    const result = await classifyEmail(gmail, details, vendor.vendorId);
    if (!result) return;

    const { classification, content, bodyText: rawText } = result;

    try {
        const isOrder = isQuetzalliOrderEmail(details.headers || [], rawText);

        if (!isOrder) {
            console.log("    not a Quetzalli order email; skipping");
            return;
        }

        const parsed = parseQuetzalliOrder({
            textPlain: content.textPlain || "",
            textHtml: content.textHtml || "",
            subject: details.subject || "",
            date: details.date || "",
            orderStatus: classification.orderStatus,
        });

        if (!isOrderEvent(parsed)) {
            console.log("    no Quetzalli order event detected; skipping");
            return;
        }

        const preview = (rawText || "").slice(0, 120).replace(/\s+/g, " ");
        console.log(`    [quetzalli] text preview: ${preview || "[no text found]"}`);
        console.log(
            `    [quetzalli] parsed: orderNumber=${parsed.orderNumber ?? ""}, items=${(parsed.items || []).length}, total=${parsed.total ?? ""}, status=${parsed.orderStatus ?? ""}`
        );

        if (parsed.items && parsed.items.length) {
            for (const item of parsed.items.slice(0, 5)) {
                console.log(
                    `      item: vendor=${vendor.vendorId} order=${parsed.orderNumber ?? ""} qty=${item.quantity ?? ""} unit=${item.unitPrice ?? ""} line=${item.lineTotal ?? ""} desc="${item.description || ""}"`
                );
            }
        }

        const saved = await saveParsedOrder({
            vendorId: classification.vendorId || vendor.vendorId,
            gmailMessageId: details.id,
            gmailThreadId: null,
            parsedOrder: parsed,
            rawText,
            attachments: content.attachments || [],
        });

        incrementStat(vendor.vendorId, 'eventsPersisted');
        console.log(
            `    [quetzalli] saved to DB: orderId=${saved.id}, items=${saved.items.length}`
        );
    } catch (err) {
        console.error(
            "    error extracting or parsing/saving Quetzalli content:",
            err.message
        );
    }
}

// ----------------------------------------
// Main poller
// ----------------------------------------

async function main() {
    const gmail = createGmailClient();

    for (const vendor of vendorEmailConfig) {
        console.log(`\n========== Vendor ${vendor.displayName} ==========\n`);

        const usedIds = new Set();
        let totalMessagesScanned = 0;
        let orderEmailsClassified = 0;
        let eventsPersisted = 0;

        // Build query based on vendor config
        // Default: use from-based query if emailFromTokens exist
        // Only use subject query if explicitly marked with useSubjectOnly: true
        let query = null;
        let queryType = "from"; // default

        if (vendor.useSubjectOnly && vendor.subjectQuery) {
            // Vendor explicitly requires subject-based search
            query = `${vendor.subjectQuery} newer_than:${DAYS_BACK}d`;
            queryType = "subject";
        } else {
            // Default: use from-based query
            const fromQuery = buildFromQuery(vendor);
            if (fromQuery) {
                query = `${fromQuery} newer_than:${DAYS_BACK}d`;
                queryType = "from";
            } else if (vendor.subjectQuery) {
                // Fallback to subject if no from tokens
                query = `${vendor.subjectQuery} newer_than:${DAYS_BACK}d`;
                queryType = "subject";
            }
        }

        if (!query) {
            console.log("  No query configured for this vendor; skipping.\n");
            continue;
        }

        console.log(`Query type: ${queryType}`);
        console.log(`Query: ${query}\n`);

        try {
            const messages = await listMessagesForQuery(gmail, query, 20);

            if (!messages.length) {
                console.log("  No messages found for this query.\n");
                continue;
            }

            for (const msg of messages) {
                const messageId = msg.id;
                if (usedIds.has(messageId)) {
                    continue;
                }
                usedIds.add(messageId);
                incrementStat(vendor.vendorId, 'totalMessagesScanned');

                const details = await getMessageDetails(gmail, messageId);
                const headerMatches = findMatchingHeaders(
                    vendor,
                    details.headers || []
                );

                console.log(
                    `  - ${details.date} | ${details.from} | ${details.subject}`
                );

                if (headerMatches.length) {
                    const matchSummary = headerMatches
                        .map((m) => `${m.headerName} matched "${m.token}"`)
                        .join("; ");
                    console.log(`    header matches: ${matchSummary}`);
                } else {
                    console.log("    header matches: none");
                }

                // Per-vendor routing
                if (vendor.vendorId === "glass_wear") {
                    await handleGlasswear(gmail, vendor, details, headerMatches);
                } else if (vendor.vendorId === "cascade") {
                    await handleCascade(gmail, vendor, details, headerMatches);
                } else if (vendor.vendorId === "anatometal") {
                    await handleAnatometal(gmail, vendor, details, headerMatches);
                } else if (vendor.vendorId === "neometal") {
                    await handleNeometal(gmail, vendor, details, headerMatches);
                } else if (vendor.vendorId === "crucial_diablo") {
                    await handleCrucialDiablo(gmail, vendor, details, headerMatches);
                } else if (vendor.vendorId === "isc") {
                    await handleIsc(gmail, vendor, details, headerMatches);
                } else if (vendor.vendorId === "ember") {
                    await handleEmber(gmail, vendor, details, headerMatches);
                } else if (vendor.vendorId === "tether") {
                    await handleTether(gmail, vendor, details, headerMatches);
                } else if (vendor.vendorId === "jtw") {
                    await handleJtw(gmail, vendor, details, headerMatches);
                } else if (vendor.vendorId === "regalia") {
                    await handleRegalia(gmail, vendor, details, headerMatches);
                } else if (vendor.vendorId === "oracle") {
                    await handleOracle(gmail, vendor, details, headerMatches);
                } else if (vendor.vendorId === "quetzalli") {
                    await handleQuetzalli(gmail, vendor, details, headerMatches);
                } else {
                    console.log(
                        `    no handler implemented for vendorId="${vendor.vendorId}"; skipping`
                    );
                }

                console.log(""); // spacing per message
            }
        } catch (err) {
            console.error(
                `  Error processing query for vendor ${vendor.vendorId}:`,
                err
            );
        }

        // Print summary for this vendor
        const stats = vendorStats[vendor.vendorId] || { totalMessagesScanned: 0, orderEmailsClassified: 0, eventsPersisted: 0 };
        console.log(`\n--- Summary for ${vendor.displayName} ---`);
        console.log(`  Total messages scanned: ${stats.totalMessagesScanned}`);
        console.log(`  Order emails classified: ${stats.orderEmailsClassified}`);
        console.log(`  Events persisted: ${stats.eventsPersisted}`);
        console.log("");
    }

    console.log("\n========== Overall Summary ==========");
    let totalScanned = 0;
    let totalClassified = 0;
    let totalPersisted = 0;
    for (const [vendorId, stats] of Object.entries(vendorStats)) {
        totalScanned += stats.totalMessagesScanned;
        totalClassified += stats.orderEmailsClassified;
        totalPersisted += stats.eventsPersisted;
    }
    console.log(`Total messages scanned across all vendors: ${totalScanned}`);
    console.log(`Total order emails classified: ${totalClassified}`);
    console.log(`Total events persisted: ${totalPersisted}`);
    console.log("\nDone.\n");
}

main().catch((err) => {
    console.error("Fatal error in gmailPoller:", err);
    process.exit(1);
});
