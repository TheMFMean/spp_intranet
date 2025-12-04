# Shopify Parser Item Extraction Audit

## Summary

All Shopify-style vendor parsers have been audited and documented. Each parser now consistently extracts items from all lifecycle email types where item information is present.

## Parsers Audited

### 1. Cascade Body Jewelry (`services/cascadeParser.js`)
- **Item Extraction**: ✅ Confirmed, Shipped, Out for Delivery, Delivered, Canceled, Refunded
- **Structure**: 
  - `parseItemsFromHtml()` - Parses HTML order-list__item rows (confirmation emails)
  - Plain-text parsing with multiple anchor patterns for shipment/delivery emails
- **Pricing**: Available in confirmed emails only
- **SKU**: Not exposed in Cascade emails
- **Special**: Supports both HTML and text-based confirmation emails with 3-line price patterns

### 2. JTW / Jewelry This Way (`services/jtwParser.js`)
- **Item Extraction**: ✅ Confirmed, Shipped, Out for Delivery, Delivered, Canceled, Refunded
- **Structure**: 
  - `parseItemsFromHtml()` - Parses HTML order-list__item rows (confirmation emails)
  - `parseShipmentItemsFromPlain()` - Parses plain-text shipment sections (lifecycle emails)
- **Pricing**: Available in confirmed emails only
- **SKU**: Not exposed in JTW emails
- **Special**: Cleans duplicate style prefixes and normalizes HTML entities

### 3. Oracle Body Jewelry (`services/oracleParser.js`)
- **Item Extraction**: ✅ Confirmed, Shipped, Out for Delivery, Delivered, Canceled
- **Structure**:
  - `parseItemsFromHtml()` - Parses HTML order-list__item rows
  - `parseItemsFromText()` - Parses plain-text shipment sections with fallback to complex parsing
- **Pricing**: Available in confirmed emails (includes retail and net pricing)
- **SKU**: Not exposed in Oracle emails
- **Special**: Tracks retail pricing and discount information

### 4. Regalia Jewelry (`services/regaliaParser.js`)
- **Item Extraction**: ✅ Confirmed, Shipped, Out for Delivery, Delivered, Canceled
- **Structure**:
  - `parseItemsFromHtml()` - Parses HTML order-list__item rows
  - `parseItemsFromText()` - Parses plain-text shipment sections with fallback
- **Pricing**: Available in confirmed emails (includes retail, net, and discount)
- **SKU**: Not exposed in Regalia emails
- **Special**: Removes "Ready to Ship" suffixes and discount notation from descriptions

### 5. Ember Body Jewelry (`services/emberParser.js`)
- **Item Extraction**: ✅ Confirmed, Shipped, Out for Delivery, Delivered, Canceled
- **Structure**:
  - `parseItemsFromHtml()` - Parses HTML order-list__item rows
  - `parseItemsFromText()` - Parses plain-text shipment sections
- **Pricing**: Available in confirmed emails only
- **SKU**: Not exposed in Ember emails
- **Special**: Includes title and variant (metal type, stone color) in description

### 6. Tether Jewelry (`services/tetherParser.js`)
- **Item Extraction**: ✅ Confirmed, Shipped, Out for Delivery, Delivered, Canceled, Refunded
- **Structure**:
  - `parseItemsFromHtml()` - Parses HTML order-list__item rows
  - `parseItemsFromText()` - Parses plain-text shipment sections
- **Pricing**: Available in confirmed emails only
- **SKU**: Not exposed in Tether emails
- **Special**: Includes title and variant information in description

## Common Patterns

### Confirmation Emails (HTML)
All parsers extract from Shopify's standard HTML structure:
```html
<tr class="order-list__item">
  <span class="order-list__item-title">Product Name × Quantity</span>
  <span class="order-list__item-variant">Variant Details</span>
  <p class="order-list__item-price">$XX.XX</p>
</tr>
```

**Extracted Fields**:
- `description` - Product name + variant
- `quantity` - Parsed from "× N" suffix
- `unitPrice` - Calculated from lineTotal / quantity
- `lineTotal` - From price cell
- `vendor_sku` - null (not exposed)

### Shipment/Delivery Emails (Plain Text)
All parsers extract from plain-text sections with anchors:
- "Items in this shipment"
- "Items in your shipment"
- "Items in this order"
- "Order summary"

**Format**: `Product Name - Variant × Quantity`

**Extracted Fields**:
- `description` - Product name + variant
- `quantity` - Parsed from "× N" or "x N" or "=D7 N" (quoted-printable)
- `unitPrice` - null (not available in shipment emails)
- `lineTotal` - null (not available in shipment emails)
- `vendor_sku` - null (not exposed)

## Item Structure

All parsers return items with this consistent structure:

```javascript
{
  vendor_sku: null,           // Not exposed in Shopify emails
  description: string,        // Product name + variant
  quantity: number,           // Integer quantity
  unitPrice: number|null,     // Only in confirmation emails
  lineTotal: number|null,     // Only in confirmation emails
  // Optional fields for some vendors:
  retailLineTotal: number|null,   // Oracle, Regalia
  discountTotal: number|null,     // Regalia
}
```

## Parser Return Structure

All parsers return this consistent structure:

```javascript
{
  vendorId: string,
  vendorName: string,
  orderNumber: string|null,
  orderStatus: string,        // confirmed, shipped, out_for_delivery, delivered, canceled, refunded, other
  orderDate: Date|null,
  subtotal: number|null,
  shipping: number|null,
  tax: number|null,
  total: number|null,
  currency: string,           // "USD"
  items: Array<Item>,         // See Item Structure above
}
```

## Key Improvements

1. ✅ **Shared Parsing Logic**: All parsers use helper functions for HTML and plain-text parsing
2. ✅ **Multiple Anchors**: Parsers try multiple text patterns to find item sections
3. ✅ **Consistent Structure**: All return the same item and order structure
4. ✅ **Documentation**: Each parser has a summary comment block listing supported event types
5. ✅ **Lifecycle Coverage**: Items are extracted from confirmed, shipped, out_for_delivery, delivered, canceled, and refunded emails

## Testing Recommendations

1. Verify item extraction from confirmation emails (should include prices)
2. Verify item extraction from shipped emails (no prices, just items and quantities)
3. Verify item extraction from out_for_delivery emails
4. Verify item extraction from delivered emails
5. Confirm that items array is never empty when the email contains an item list
6. Verify that unitPrice is null for shipment/delivery emails (as expected)
