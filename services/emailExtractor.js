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

    // Helper to get header value
    const getHeader = (name) => {
        const header = headers.find(
            (h) => h.name && h.name.toLowerCase() === name.toLowerCase()
        );
        return header?.value || "";
    };

    // Helper to parse email header
    const parseEmailHeader = (headerValue) => {
        if (!headerValue) return { address: "", displayName: "" };

        const angleMatch = headerValue.match(/^(.+?)\s*<([^>]+)>$/);
        if (angleMatch) {
            const displayName = angleMatch[1].replace(/^["']|["']$/g, "").trim();
            const address = angleMatch[2].toLowerCase().trim();
            return { address, displayName };
        }

        const address = headerValue.toLowerCase().trim();
        return { address, displayName: "" };
    };

    // Extract ALL identity headers for Google Group forwarding
    const fromHeader = getHeader("From");
    const replyToHeader = getHeader("Reply-To");
    const toHeader = getHeader("To");
    const senderHeader = getHeader("Sender");
    const returnPathHeader = getHeader("Return-Path");
    const subjectHeader = getHeader("Subject");
    const dateHeader = getHeader("Date");

    const from = parseEmailHeader(fromHeader);
    const replyTo = parseEmailHeader(replyToHeader);
    const to = parseEmailHeader(toHeader);
    const sender = parseEmailHeader(senderHeader);
    const returnPath = parseEmailHeader(returnPathHeader);

    // Identity address priority for Google Group forwarding:
    // 1) Reply-To (true vendor), 2) Sender, 3) Return-Path, 4) From (group address)
    const identityAddress = replyTo.address || sender.address || returnPath.address || from.address;

    const result = {
        id: res.data.id,
        headers,
        // Identity fields for classification (Google Group aware)
        identityAddress: identityAddress,
        replyToAddress: replyTo.address,
        senderAddress: sender.address,
        returnPathAddress: returnPath.address,
        fromAddress: from.address,
        toAddress: to.address,
        // Display names
        fromDisplayName: from.displayName,
        replyToDisplayName: replyTo.displayName,
        // Message metadata
        subject: subjectHeader,
        messageDate: dateHeader,
        // Content fields
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
