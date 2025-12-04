// test/shopifyParserValidation.js
// Quick validation that Shopify parsers extract items from all lifecycle events

import { parseCascadeOrder } from "../services/cascadeParser.js";
import { parseJtwOrder } from "../services/jtwParser.js";
import { parseOracleOrder } from "../services/oracleParser.js";
import { parseRegaliaOrder } from "../services/regaliaParser.js";
import { parseEmberOrder } from "../services/emberParser.js";
import { parseTetherOrder } from "../services/tetherParser.js";

// Mock confirmation email (HTML with prices)
const mockConfirmationHtml = `
<tr class="order-list__item">
  <span class="order-list__item-title">Gold Seam Ring - 14K Yellow Gold × 2</span>
  <span class="order-list__item-variant">18g / 5/16"</span>
  <p class="order-list__item-price">$205.98</p>
</tr>
`;

// Mock shipment email (plain text, no prices)
const mockShipmentText = `
Items in this shipment
----------------------

Gold Seam Ring - 14K Yellow Gold - 18g / 5/16" × 2

Threadless Ball End - 14K Rose Gold × 5

If you have any questions, contact us.
`;

console.log("=== Shopify Parser Validation ===\n");

// Test JTW
console.log("1. JTW Parser");
const jtwConfirmed = parseJtwOrder({
    textHtml: mockConfirmationHtml,
    subject: "Order #10664 confirmed",
    orderStatus: "confirmed",
});
console.log(`   Confirmed: ${jtwConfirmed.items.length} items, has prices: ${jtwConfirmed.items[0]?.unitPrice != null}`);

const jtwShipped = parseJtwOrder({
    textPlain: mockShipmentText,
    subject: "A shipment from order #10664 is on the way",
    orderStatus: "shipped",
});
console.log(`   Shipped: ${jtwShipped.items.length} items, has prices: ${jtwShipped.items[0]?.unitPrice != null}`);

// Test Oracle
console.log("\n2. Oracle Parser");
const oracleConfirmed = parseOracleOrder({
    textHtml: mockConfirmationHtml,
    subject: "Order! #8588",
    orderStatus: "confirmed",
});
console.log(`   Confirmed: ${oracleConfirmed.items.length} items, has prices: ${oracleConfirmed.items[0]?.unitPrice != null}`);

const oracleShipped = parseOracleOrder({
    textPlain: mockShipmentText,
    subject: "Time to stalk the mail carrier",
    orderStatus: "shipped",
});
console.log(`   Shipped: ${oracleShipped.items.length} items, has prices: ${oracleShipped.items[0]?.unitPrice != null}`);

// Test Cascade
console.log("\n3. Cascade Parser");
const cascadeConfirmed = parseCascadeOrder({
    textHtml: mockConfirmationHtml,
    subject: "Order #2443 confirmed",
    orderStatus: "confirmed",
});
console.log(`   Confirmed: ${cascadeConfirmed.items.length} items, has prices: ${cascadeConfirmed.items[0]?.unitPrice != null}`);

const cascadeShipped = parseCascadeOrder({
    textPlain: mockShipmentText,
    subject: "A shipment from order #2443 is on the way",
    orderStatus: "shipped",
});
console.log(`   Shipped: ${cascadeShipped.items.length} items, has prices: ${cascadeShipped.items[0]?.unitPrice != null}`);

// Test Ember
console.log("\n4. Ember Parser");
const emberConfirmed = parseEmberOrder({
    textHtml: mockConfirmationHtml,
    subject: "Order #5426 confirmed",
    orderStatus: "confirmed",
});
console.log(`   Confirmed: ${emberConfirmed.items.length} items, has prices: ${emberConfirmed.items[0]?.unitPrice != null}`);

const emberShipped = parseEmberOrder({
    textPlain: mockShipmentText,
    subject: "Order #5426 has been shipped",
    orderStatus: "shipped",
});
console.log(`   Shipped: ${emberShipped.items.length} items, has prices: ${emberShipped.items[0]?.unitPrice != null}`);

// Test Tether
console.log("\n5. Tether Parser");
const tetherConfirmed = parseTetherOrder({
    textHtml: mockConfirmationHtml,
    subject: "Order 10945 confirmed",
    orderStatus: "confirmed",
});
console.log(`   Confirmed: ${tetherConfirmed.items.length} items, has prices: ${tetherConfirmed.items[0]?.unitPrice != null}`);

const tetherShipped = parseTetherOrder({
    textPlain: mockShipmentText,
    subject: "Order 10945 has been shipped",
    orderStatus: "shipped",
});
console.log(`   Shipped: ${tetherShipped.items.length} items, has prices: ${tetherShipped.items[0]?.unitPrice != null}`);

// Test Regalia
console.log("\n6. Regalia Parser");
const regaliaConfirmed = parseRegaliaOrder({
    textHtml: mockConfirmationHtml,
    subject: "Receipt for order #7234",
    orderStatus: "confirmed",
});
console.log(`   Confirmed: ${regaliaConfirmed.items.length} items, has prices: ${regaliaConfirmed.items[0]?.unitPrice != null}`);

const regaliaShipped = parseRegaliaOrder({
    textPlain: mockShipmentText,
    subject: "Order #7234 has been shipped",
    orderStatus: "shipped",
});
console.log(`   Shipped: ${regaliaShipped.items.length} items, has prices: ${regaliaShipped.items[0]?.unitPrice != null}`);

console.log("\n=== Validation Complete ===");
console.log("\nExpected Results:");
console.log("- Confirmed emails: 1 item with prices (unitPrice != null)");
console.log("- Shipped emails: 2 items without prices (unitPrice == null)");
