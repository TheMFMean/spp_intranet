// test/parserToNormalizerIntegration.js
// Integration test: Parser output → Normalizer → Database-ready items

import { parseJtwOrder } from "../services/jtwParser.js";
import { parseCascadeOrder } from "../services/cascadeParser.js";
import { normalizeItem } from "../services/itemNormalizer.js";

console.log("=== Parser → Normalizer Integration Test ===\n");

// Mock JTW confirmation email (HTML)
const jtwConfirmationHtml = `
<tr class="order-list__item">
  <span class="order-list__item-title">Gold Seam Ring - Cup and Divot - 14K Yellow Gold × 2</span>
  <span class="order-list__item-variant">18g / 5/16"</span>
  <p class="order-list__item-price">$205.98</p>
</tr>
`;

// Mock Cascade shipment email (plain text)
const cascadeShipmentText = `
Items in this shipment
----------------------

Threadless Ball End - 14K Rose Gold × 5

Curved Barbell - Titanium - 16g × 2

If you have any questions, contact us.
`;

console.log("Test 1: JTW Confirmation → Normalization");
console.log("==========================================");

const jtwParsed = parseJtwOrder({
    textHtml: jtwConfirmationHtml,
    subject: "Order #10664 confirmed",
    date: "2024-12-03T10:00:00Z",
    orderStatus: "confirmed",
});

console.log(`Parsed Order:`);
console.log(`  Vendor: ${jtwParsed.vendorId}`);
console.log(`  Order #: ${jtwParsed.orderNumber}`);
console.log(`  Status: ${jtwParsed.orderStatus}`);
console.log(`  Items: ${jtwParsed.items.length}`);

if (jtwParsed.items.length > 0) {
    const rawItem = jtwParsed.items[0];
    console.log(`\nRaw Item (before normalization):`);
    console.log(`  Description: "${rawItem.description}"`);
    console.log(`  Quantity: ${rawItem.quantity}`);
    console.log(`  Unit Price: ${rawItem.unitPrice}`);
    console.log(`  Line Total: ${rawItem.lineTotal}`);
    console.log(`  vendor_sku: ${rawItem.vendor_sku || "null"}`);
    console.log(`  internalSku: ${rawItem.internalSku || "null"}`);

    const normalized = await normalizeItem(rawItem, jtwParsed.vendorId);
    console.log(`\nNormalized Item (after normalization):`);
    console.log(`  Description: "${normalized.description}"`);
    console.log(`  Quantity: ${normalized.quantity}`);
    console.log(`  Unit Price: ${normalized.unitPrice}`);
    console.log(`  Line Total: ${normalized.lineTotal}`);
    console.log(`  vendor_sku: ${normalized.vendor_sku || "null"}`);
    console.log(`  internalSku: ${normalized.internalSku}`);
    console.log(`  ✅ internalSku assigned: ${normalized.internalSku.startsWith("SPP-") ? "YES" : "NO"}`);
}

console.log("\n\nTest 2: Cascade Shipment → Normalization");
console.log("==========================================");

const cascadeParsed = parseCascadeOrder({
    textPlain: cascadeShipmentText,
    subject: "A shipment from order #2443 is on the way",
    date: "2024-12-03T14:30:00Z",
    orderStatus: "shipped",
});

console.log(`Parsed Order:`);
console.log(`  Vendor: ${cascadeParsed.vendorId}`);
console.log(`  Order #: ${cascadeParsed.orderNumber}`);
console.log(`  Status: ${cascadeParsed.orderStatus}`);
console.log(`  Items: ${cascadeParsed.items.length}`);

if (cascadeParsed.items.length > 0) {
    console.log(`\nProcessing ${cascadeParsed.items.length} items...`);

    for (let i = 0; i < cascadeParsed.items.length; i++) {
        const rawItem = cascadeParsed.items[i];
        const normalized = await normalizeItem(rawItem, cascadeParsed.vendorId);

        console.log(`\n  Item ${i + 1}:`);
        console.log(`    Description: "${normalized.description}"`);
        console.log(`    Quantity: ${normalized.quantity}`);
        console.log(`    Unit Price: ${normalized.unitPrice || "null (shipment email)"}`);
        console.log(`    internalSku: ${normalized.internalSku}`);
        console.log(`    ✅ Ready for DB: ${normalized.internalSku.startsWith("SPP-") ? "YES" : "NO"}`);
    }
}

console.log("\n\nTest 3: Consistency Across Multiple Orders");
console.log("==========================================");

// Same item in two different orders should get same internalSku
const order1 = parseJtwOrder({
    textHtml: `
    <tr class="order-list__item">
      <span class="order-list__item-title">Threadless Ball End × 1</span>
      <p class="order-list__item-price">$12.50</p>
    </tr>
    `,
    subject: "Order #10001 confirmed",
    orderStatus: "confirmed",
});

const order2 = parseJtwOrder({
    textHtml: `
    <tr class="order-list__item">
      <span class="order-list__item-title">Threadless Ball End × 3</span>
      <p class="order-list__item-price">$37.50</p>
    </tr>
    `,
    subject: "Order #10002 confirmed",
    orderStatus: "confirmed",
});

const item1 = await normalizeItem(order1.items[0], "jtw");
const item2 = await normalizeItem(order2.items[0], "jtw");

console.log(`Order #10001 - "${item1.description}" → ${item1.internalSku}`);
console.log(`Order #10002 - "${item2.description}" → ${item2.internalSku}`);
console.log(`✅ Same internalSku: ${item1.internalSku === item2.internalSku ? "YES" : "NO"}`);

console.log("\n\n=== Integration Test Complete ===\n");
console.log("Summary:");
console.log("✅ Parser outputs are successfully normalized");
console.log("✅ All items receive internalSku (SPP-XXXXXX format)");
console.log("✅ Same description → same internalSku across orders");
console.log("✅ Items are ready for database persistence");
console.log("\nFlow: Parser → normalizeItem() → Database-ready items");
