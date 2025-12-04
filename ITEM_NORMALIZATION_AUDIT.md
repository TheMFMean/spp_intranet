# Item Normalization Audit Summary

## Overview

All vendor parser outputs now flow through a single, centralized item normalization system that ensures stable `internalSku` assignment and consistent data quality.

## Single Source of Truth

### `services/itemNormalizer.js`

This module is the **ONLY** place where:
1. Item descriptions are normalized
2. Dummy SKUs (`SPP-XXXXXX`) are generated
3. `internalSku` values are assigned

**Key Functions:**

- `normalizeItem(rawItem, vendorId)` - Main entry point for normalization
- `fingerprintDescription(desc)` - Creates stable fingerprints (lowercase, whitespace-normalized)
- `makeDummyCode(text)` - Generates 6-digit codes from fingerprints using SHA-1 hash

## Normalization Flow

### Entry Point: `services/orderService.js`

All parsed orders flow through `saveParsedOrder()`:

```javascript
// ========== ITEM NORMALIZATION ==========
// All items are normalized here via itemNormalizer.normalizeItem()
// Dummy SKUs (SPP-XXXXXX) are generated only here, ensuring stable internalSku
// for the same (vendorId, vendorOrderNumber, description) combination.
// =========================================

const items = await Promise.all(
    rawItems.map(async (item, idx) => {
        const normalized = await normalizeItem(item, vendorId);
        // ... map to database schema
    })
);
```

### Priority Order for `internalSku` Assignment

1. **Existing `internalSku`** → Preserved if already present
2. **`vendor_sku`** → Generate `SPP-XXXXXX` from vendor's SKU code
3. **`description`** → Generate `SPP-XXXXXX` from item description

This ensures that:
- The same vendor SKU always maps to the same internal SKU
- The same description always maps to the same internal SKU
- Manual SKU assignments are never overwritten

## Stability Guarantees

### Fingerprinting Rules

```javascript
fingerprintDescription("Gold Ring - 14K")
fingerprintDescription("gold ring - 14k")
fingerprintDescription("Gold  Ring  -  14K")
// All produce: "gold ring - 14k"
```

**Normalization:**
- Convert to lowercase
- Collapse multiple spaces to single space
- Trim leading/trailing whitespace

### Dummy Code Generation

```javascript
makeDummyCode("gold ring - 14k")
// Always produces: "620123"
// Format: SPP-620123
```

**Properties:**
- Deterministic (same input → same output)
- 6-digit zero-padded format
- Based on SHA-1 hash (first 8 hex chars mod 1,000,000)

## Database Schema

### OrderItem Fields

```javascript
{
    lineNumber: number,
    description: string,          // Trimmed and normalized
    quantity: number,
    unitPrice: Decimal,
    lineTotal: Decimal,
    
    // SKU fields
    sku: string,                  // Legacy field (may be null)
    internalSku: string,          // SPP-XXXXXX (always assigned)
    vendor_sku: string,           // Vendor's original SKU (may be null)
    
    // Metadata
    vendorId: string,
    vendorOrderNumber: string,
    orderDate: Date,
    vendorMeta: object,
}
```

## Code Path Verification

### ✅ All Paths Go Through Normalizer

1. **Gmail Poller → Parser → orderService.saveParsedOrder() → normalizeItem()**
   - Primary path for all vendor emails
   - Handles: Cascade, JTW, Oracle, Regalia, Ember, Tether, Glasswear, Anatometal, Neometal, ISC, Crucial/Diablo, Quetzalli

2. **Direct API (if implemented) → orderService.saveParsedOrder() → normalizeItem()**
   - Future-proof for manual order entry

3. **orderService.saveOrder() → WARNING: Assumes pre-normalized items**
   - Legacy helper function
   - Not used by gmail poller
   - Documented to require pre-normalized items

### ❌ No Bypass Paths Found

- No direct `prisma.order.create()` calls outside orderService
- No duplicate `makeDummyCode()` implementations
- No `SPP-` string generation elsewhere in codebase

## Validation Results

All tests pass ✅:

1. **Fingerprint Stability** - Case-insensitive, whitespace-normalized
2. **Dummy Code Stability** - Same input always produces same output
3. **Format Validation** - All codes match `SPP-\d{6}` pattern
4. **Consistency** - Same description → same internalSku
5. **Priority Order** - vendor_sku takes precedence over description
6. **Preservation** - Existing internalSku values are never overwritten
7. **Description Trimming** - Whitespace is properly cleaned

## Benefits

### For Data Quality

- **Stable SKUs**: Same item always gets same internal SKU across orders
- **Deduplication**: Easy to identify duplicate items across vendors
- **Traceability**: Clear mapping from vendor SKU or description to internal SKU

### For Inventory Management

- **Consistent Identification**: Items can be tracked across multiple orders
- **Vendor Agnostic**: Internal SKU is independent of vendor changes
- **Future-Proof**: Can migrate to real SKU system without breaking existing data

### For Development

- **Single Source of Truth**: All normalization logic in one place
- **No Duplication**: makeDummyCode() exists only in itemNormalizer.js
- **Easy Testing**: Pure functions with no database dependencies
- **Clear Documentation**: Well-commented code with examples

## Testing

Run validation:
```bash
node test/itemNormalizerValidation.js
```

Expected output:
- All fingerprints match ✅
- All codes match ✅
- Format valid ✅
- SKUs match ✅
- Preserved ✅
- Trimmed ✅
- Different SKUs (as expected) ✅

## Recommendations

### ✅ Current State (Excellent)

- All items flow through normalizer
- Stable SKU generation
- No bypass paths
- Well-documented

### Future Enhancements (Optional)

1. **SKU Mapping Table**: Create a `ProductSku` table to track:
   - `internalSku` → `realSku` mappings
   - Multiple vendor SKUs for same product
   - SKU aliases and variations

2. **Description Normalization**: Add more aggressive normalization:
   - Remove size variations (e.g., "16g" vs "18g")
   - Normalize metal types (e.g., "14K" vs "14k" vs "14 karat")
   - Extract and standardize dimensions

3. **Vendor SKU Validation**: Add vendor-specific SKU format validation:
   - Cascade: No SKUs exposed
   - JTW: Format validation if patterns emerge
   - Oracle: Format validation if patterns emerge

4. **Duplicate Detection**: Add API endpoint to find potential duplicates:
   - Items with similar descriptions but different SKUs
   - Items from different vendors that might be the same product

## Files Modified

- ✅ `services/itemNormalizer.js` - Enhanced documentation and exports
- ✅ `services/orderService.js` - Added normalization comments
- ✅ `test/itemNormalizerValidation.js` - Created comprehensive validation

## Files Verified (No Changes Needed)

- ✅ All vendor parsers (cascade, jtw, oracle, regalia, ember, tether, etc.)
- ✅ `workers/gmailPoller.js` - Already uses orderService.saveParsedOrder()
- ✅ No duplicate SKU generation found in codebase
