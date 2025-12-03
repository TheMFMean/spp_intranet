import fs from "fs";
import path from "path";
import { parseCrucialDiabloOrder } from "../services/crucialDiabloParser.js";
import { fetchAndExtractMessage } from "../services/emailExtractor.js";
import { createGmailClient } from "../services/gmailClient.js";

// Provide the Gmail message ID YOU want to test
const TEST_MESSAGE_ID = process.argv[2];

(async () => {
    if (!TEST_MESSAGE_ID) {
        console.error("Usage: node crucialTest.js <gmailMessageId>");
        process.exit(1);
    }

    const gmail = createGmailClient();
    const content = await fetchAndExtractMessage(gmail, TEST_MESSAGE_ID);

    const parsed = parseCrucialDiabloOrder({
        textPlain: content.textPlain || "",
        textHtml: content.textHtml || "",
        subject: content.subject || "",
        date: content.date || "",
        from: content.from || "",
    });

    console.log("\nParsed Result:\n", JSON.stringify(parsed, null, 2), "\n");
})();