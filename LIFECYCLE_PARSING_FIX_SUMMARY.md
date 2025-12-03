# Lifecycle Item Parsing Fix - Summary

## Problem
Only confirmation emails were parsing items. Shipped/out_for_delivery/delivered emails contain "Items in this shipment" sections but parsers weren't extracting them, causing missing lifecycle data in `v_order_items_flat`.

## Changes Made

### 1. Parser Updates (All Shopify-style vendors)

**Updated Parsers:**
- `cascadeParser.js`
- `jtwParser.js`
- `oracleParser.js`
- `regaliaParser.js`
- `emberParser.js`
- `tetherParser.js`
- `quetzalliParser.js`

**Key Improvements:**
- Added multi-anchor text search for item sections:
  - "Items in this shipment"
  - "Items in your shipment"
  - "Items in this order"
  - "Order summary"
- Enhanced regex to handle quoted-printable encoding (`=D7` for `×`)
- Added plain-text fallback parsing for all lifecycle events
- Parsers now accept `orderStatus` parameter from classification

**Item Extraction Pattern:**
```regex
/^(.+?)\s*(?:[xX×]|=D7)\s*(\d+)\s*$/
```

This matches lines like:
- `16g 14KY 1.6mm Curb Chain - 28mm × 1`
- `Threadless 12g Fixed Disk Post 4.5mm - 11/32" × 5`

### 2. gmailPoller.js Updates

**Fixed orderStatus passing:**
- All parsers now receive `classification.orderStatus` as a parameter
- Removed redundant conditional status assignment after parsing
- Ensures parsers have access to lifecycle status during item extraction

**Before:**
```javascript
const parsed = parseJtwOrder({...});
if (classification.orderStatus) {
    parsed.orderStatus = classification.orderStatus;
}
```

**After:**
```javascript
const parsed = parseJtwOrder({
    ...
    orderStatus: classification.orderStatus,
});
```

### 3. Dummy SKU Helper

The existing `itemNormalizer.js` already handles dummy SKU generation:
- Creates stable fingerprint from description
- Generates `SPP-XXXXXX` format SKUs
- Reuses same SKU for identical descriptions

## Testing Instructions

### 1. Run the Poller

```bash
cd /srv/backend
node workers/gmailPoller.js
```

### 2. Validate in Postgres

**Check Cascade Order 2543:**
```sql
SELECT 
    "vendorOrderNumber",
    "itemKey",
    "description",
    "internalSku",
    "orderedQty",
    "shippedQty",
    "outForDeliveryQty",
    "deliveredQty",
    "lifecycleStatus"
FROM v_order_items_flat
WHERE "vendorId" = 'cascade' 
  AND "vendorOrderNumber" = '2543'
ORDER BY "itemKey";
```

**Expected Result:**
- `shippedQty > 0` for items that were shipped
- `outForDeliveryQty > 0` for items out for delivery (if applicable)
- `deliveredQty > 0` for items that were delivered (if applicable)
- Each unique item should show aggregated quantities across all lifecycle stages

**Check JTW Order 10750:**
```sql
SELECT 
    "vendorOrderNumber",
    "itemKey",
    "description",
    "internalSku",
    "orderedQty",
    "shippedQty",
    "outForDeliveryQty",
    "deliveredQty",
    "lifecycleStatus"
FROM v_order_items_flat
WHERE "vendorId" = 'jtw' 
  AND "vendorOrderNumber" = '10750'
ORDER BY "itemKey";
```

**Check All Vendors Summary:**
```sql
SELECT 
    "vendorId",
    COUNT(DISTINCT "vendorOrderNumber") as order_count,
    COUNT(*) as unique_items,
    SUM("orderedQty") as total_ordered,
    SUM("shippedQty") as total_shipped,
    SUM("outForDeliveryQty") as total_out_for_delivery,
    SUM("deliveredQty") as total_delivered
FROM v_order_items_flat
WHERE "shippedQty" > 0 OR "outForDeliveryQty" > 0 OR "deliveredQty" > 0
GROUP BY "vendorId"
ORDER BY "vendorId";
```

**Verify Dummy SKUs are Consistent:**
```sql
SELECT 
    "vendorId",
    "vendorOrderNumber",
    "itemKey",
    "description",
    "internalSku",
    "orderedQty",
    "shippedQty",
    "deliveredQty",
    "lifecycleStatus"
FROM v_order_items_flat
WHERE "vendorId" IN ('cascade', 'jtw')
  AND "vendorOrderNumber" IN ('2543', '10750')
ORDER BY "vendorId", "vendorOrderNumber", "itemKey";
```

**Check for Items with Lifecycle Progression:**
```sql
SELECT 
    "vendorId",
    "vendorOrderNumber",
    "itemKey",
    "orderedQty",
    "shippedQty",
    "outForDeliveryQty",
    "deliveredQty",
    "openQty",
    "lifecycleStatus"
FROM v_order_items_flat
WHERE "orderedQty" > 0 
  AND ("shippedQty" > 0 OR "deliveredQty" > 0)
ORDER BY "vendorId", "vendorOrderNumber", "itemKey"
LIMIT 20;
```

## Architecture Notes

- **ES Module imports**: All parsers use ES module syntax
- **Dummy SKU generation**: Handled by `itemNormalizer.js` via `normalizeItem()`
- **Event save rule**: Events saved if `hasItems OR hasStatus` (status !== "other")
- **Classification**: `classifyVendorOrderEmail()` determines orderStatus from subject/body
- **Database**: Postgres with Prisma ORM

## Files Modified

1. `backend/services/cascadeParser.js` - Enhanced item extraction
2. `backend/services/jtwParser.js` - Added orderStatus param, enhanced parsing
3. `backend/services/oracleParser.js` - Added orderStatus param, plain-text parsing
4. `backend/services/regaliaParser.js` - Added orderStatus param, plain-text parsing
5. `backend/services/emberParser.js` - Added orderStatus param, plain-text parsing
6. `backend/services/tetherParser.js` - Added orderStatus param, plain-text parsing
7. `backend/services/quetzalliParser.js` - Added orderStatus param, plain-text parsing
8. `backend/workers/gmailPoller.js` - Fixed orderStatus passing to all parsers

## What Was Fixed

✅ Parsers now extract items from shipped/out_for_delivery/delivered emails
✅ Multi-anchor search finds "Items in this shipment" sections reliably
✅ Quoted-printable encoding handled (=D7 → ×)
✅ orderStatus passed from classification to all parsers
✅ Dummy SKU helper called consistently for all items
✅ Plain-text fallback for all Shopify-style vendors

## Expected Outcome

After running the poller, `v_order_items_flat` should show:
- Items for ALL lifecycle events (confirmed, shipped, out_for_delivery, delivered)
- Consistent dummy SKUs (SPP-XXXXXX) for items without vendor SKUs
- Proper quantity tracking across lifecycle stages
- Complete order history for Cascade 2543, JTW 10750, and all other orders
