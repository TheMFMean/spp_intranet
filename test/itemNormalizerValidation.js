// test/itemNormalizerValidation.js
// Validation that itemNormalizer produces stable, consistent internalSku values

import { normalizeItem, __testing } from "../services/itemNormalizer.js";

const { fingerprintDescription, makeDummyCode } = __testing;

console.log("=== Item Normalizer Validation ===\n");

// Test 1: Stable fingerprinting
console.log("1. Fingerprint Stability");
const desc1 = "Gold Seam Ring - 14K Yellow Gold - 18g / 5/16\"";
const desc2 = "gold seam ring - 14k yellow gold - 18g / 5/16\"";
const desc3 = "Gold  Seam   Ring  -  14K  Yellow  Gold  -  18g / 5/16\"";

const fp1 = fingerprintDescription(desc1);
const fp2 = fingerprintDescription(desc2);
const fp3 = fingerprintDescription(desc3);

console.log(`   Original: "${desc1}"`);
console.log(`   Lowercase: "${desc2}"`);
console.log(`   Extra spaces: "${desc3}"`);
console.log(`   All fingerprints match: ${fp1 === fp2 && fp2 === fp3 ? "✅" : "❌"}`);
console.log(`   Fingerprint: "${fp1}"\n`);

// Test 2: Stable dummy code generation
console.log("2. Dummy Code Stability");
const code1 = makeDummyCode(fp1);
const code2 = makeDummyCode(fp2);
const code3 = makeDummyCode(fp3);

console.log(`   Code from fp1: SPP-${code1}`);
console.log(`   Code from fp2: SPP-${code2}`);
console.log(`   Code from fp3: SPP-${code3}`);
console.log(`   All codes match: ${code1 === code2 && code2 === code3 ? "✅" : "❌"}`);
console.log(`   Code format valid (6 digits): ${/^\d{6}$/.test(code1) ? "✅" : "❌"}\n`);

// Test 3: normalizeItem with vendor_sku
console.log("3. Normalize Item with vendor_sku");
const item1 = {
    description: "Threadless Ball End",
    vendor_sku: "TBE-001",
    quantity: 5,
    unitPrice: 12.50,
};

const normalized1 = await normalizeItem(item1, "cascade");
console.log(`   Input: vendor_sku="${item1.vendor_sku}"`);
console.log(`   Output: internalSku="${normalized1.internalSku}"`);
console.log(`   Format valid: ${normalized1.internalSku.startsWith("SPP-") ? "✅" : "❌"}\n`);

// Test 4: normalizeItem without vendor_sku (uses description)
console.log("4. Normalize Item without vendor_sku");
const item2 = {
    description: "Gold Seam Ring - 14K Yellow Gold - 18g / 5/16\"",
    quantity: 2,
    unitPrice: 102.99,
};

const normalized2 = await normalizeItem(item2, "jtw");
console.log(`   Input: description="${item2.description}"`);
console.log(`   Output: internalSku="${normalized2.internalSku}"`);
console.log(`   Format valid: ${normalized2.internalSku.startsWith("SPP-") ? "✅" : "❌"}\n`);

// Test 5: Same description always produces same internalSku
console.log("5. Consistency Check - Same Description");
const item3a = {
    description: "Silver Necklace - 16 inch",
    quantity: 1,
};
const item3b = {
    description: "Silver Necklace - 16 inch",
    quantity: 3,
};

const normalized3a = await normalizeItem(item3a, "oracle");
const normalized3b = await normalizeItem(item3b, "oracle");

console.log(`   Item A: "${item3a.description}" → ${normalized3a.internalSku}`);
console.log(`   Item B: "${item3b.description}" → ${normalized3b.internalSku}`);
console.log(`   SKUs match: ${normalized3a.internalSku === normalized3b.internalSku ? "✅" : "❌"}\n`);

// Test 6: Preserve existing internalSku
console.log("6. Preserve Existing internalSku");
const item4 = {
    description: "Custom Item",
    internalSku: "CUSTOM-123",
    quantity: 1,
};

const normalized4 = await normalizeItem(item4, "ember");
console.log(`   Input: internalSku="${item4.internalSku}"`);
console.log(`   Output: internalSku="${normalized4.internalSku}"`);
console.log(`   Preserved: ${normalized4.internalSku === "CUSTOM-123" ? "✅" : "❌"}\n`);

// Test 7: Description trimming
console.log("7. Description Trimming");
const item5 = {
    description: "  Padded Description  ",
    quantity: 1,
};

const normalized5 = await normalizeItem(item5, "tether");
console.log(`   Input: "${item5.description}"`);
console.log(`   Output: "${normalized5.description}"`);
console.log(`   Trimmed: ${normalized5.description === "Padded Description" ? "✅" : "❌"}\n`);

// Test 8: Priority order (vendor_sku > description)
console.log("8. Priority Order");
const item6 = {
    description: "Test Item",
    vendor_sku: "TEST-SKU",
    quantity: 1,
};

const normalized6a = await normalizeItem(item6, "regalia");
const normalized6b = await normalizeItem({ description: "Test Item" }, "regalia");

console.log(`   With vendor_sku: ${normalized6a.internalSku}`);
console.log(`   Without vendor_sku: ${normalized6b.internalSku}`);
console.log(`   Different SKUs (as expected): ${normalized6a.internalSku !== normalized6b.internalSku ? "✅" : "❌"}\n`);

console.log("=== Validation Complete ===\n");
console.log("Summary:");
console.log("- Fingerprinting is case-insensitive and whitespace-normalized");
console.log("- Dummy codes are stable (same input → same output)");
console.log("- internalSku format: SPP-XXXXXX (6 digits)");
console.log("- Priority: existing internalSku > vendor_sku > description");
console.log("- Same description always produces same internalSku");
