// /srv/backend/services/emailExtractor.js

import { Buffer } from "node:buffer";

// Gmail uses URL safe base64
function decodeBase64Url(data) {
    if (!data) return "";
    const replaced = data.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(replaced, "base64").toString("utf8");
}

// Recursively walk the payload tree and collect text and attachment info
function walkParts(part, result) {
    if (!part) return;

    const mimeType = part.mimeType || "";
    const filename = part.filename || "";
    const body = part.body || {};

    // Text parts
    if (mimeType === "text/plain" && body.data) {
        result.textPlain += decodeBase64Url(body.data) + "\n";
    } else if (mimeType === "text/html" && body.data) {
        result.textHtml += decodeBase64Url(body.data) + "\n";
    }

    // Attachments (anything with a filename and an attachmentId)
    if (filename && body.attachmentId) {
        result.attachments.push({
            filename,
            mimeType,
            attachmentId: body.attachmentId,
            size: body.size || 0,
        });
    }

    // Nested parts
    if (Array.isArray(part.parts)) {
        for (const child of part.parts) {
            walkParts(child, result);
        }
    }
}

// Fetch the full message and extract useful content
export async function fetchAndExtractMessage(gmail, messageId) {
    const res = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "full",
    });

    const payload = res.data.payload || {};
    const headers = payload.headers || [];

    const result = {
        id: res.data.id,
        headers,
        textPlain: "",
        textHtml: "",
        attachments: [],
    };

    walkParts(payload, result);

    // Cheap HTML strip so textHtml is readable if needed
    if (!result.textPlain && result.textHtml) {
        result.textPlain = result.textHtml
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    return result;
}
