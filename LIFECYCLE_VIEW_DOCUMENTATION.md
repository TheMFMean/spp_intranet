# Lifecycle View Documentation

## Overview

The `v_order_items_flat` view is the **canonical lifecycle export view** that aggregates order and item data to produce a flat, item-level lifecycle report matching `Example_of_endstate_requirements.csv`.

## Purpose

Track each item's journey through the order lifecycle:
- Order placement (confirmed)
- Shipment (shipped)
- Delivery progress (out_for_delivery)
- Final delivery (delivered)
- Cancellations and refunds

## Data Sources

### Tables
- **Order**: `orderStatus`, `orderDate`, vendor identification
- **OrderItem**: quantities, prices, SKUs, descriptions

### Lifecycle Statuses
- `confirmed` - Order placed, source of unit price and initial quantity
- `shipped` - Items shipped to customer
- `out_for_delivery` - Items out for delivery
- `delivered` - Items successfully delivered
- `canceled` - Order canceled
- `refunded` - Order refunded

## View Structure

### Grouping Key
Items are aggregated by:
- `vendorId`
- `vendorOrderNumber`
- `internalSku`
- `description`

This ensures all lifecycle events for the same physical item are combined into a single row.

### Column Definitions

| Column Name | Type | Description |
|------------|------|-------------|
| **Vendor ID** | String | Vendor identifier (cascade, jtw, oracle, etc.) |
| **Order Number** | String | Vendor's order number |
| **Internal Sku** | String | SPP internal SKU (SPP-XXXXXX format) |
| **Vendor Sku** | String | Vendor's original SKU code (may be null) |
| **Description** | String | Item description |
| **Quantity** | Integer | Event-level quantity (currently = Order Placed Quantity) |
| **Unit Price** | Decimal | Price per unit (from confirmation events) |
| **Order Placed Quantity** | Integer | Sum of quantities from confirmed events |
| **Order Date** | Date | Earliest date of confirmed event |
| **Shipped Quantity** | Integer | Sum of quantities from shipped events |
| **Shipped Date** | Date | Earliest date of shipped event |
| **Out for Delivery Quantity** | Integer | Sum of quantities from out_for_delivery events |
| **Out for Delivery Date** | Date | Earliest date of out_for_delivery event |
| **Delivered Quantity** | Integer | Sum of quantities from delivered events |
| **Delivered Date** | Date | Earliest date of delivered event |
| **Canceled** | Integer | Sum of quantities from canceled events |
| **Refunded** | Integer | Sum of quantities from refunded events |
| **Net Open** | Integer | Order Placed - Delivered - Canceled - Refunded |

## Calculation Logic

### Quantities
Each lifecycle status aggregates quantities from matching events:

```sql
Order Placed Quantity = SUM(quantity WHERE orderStatus = 'confirmed')
Shipped Quantity = SUM(quantity WHERE orderStatus = 'shipped')
Out for Delivery Quantity = SUM(quantity WHERE orderStatus = 'out_for_delivery')
Delivered Quantity = SUM(quantity WHERE orderStatus = 'delivered')
Canceled = SUM(quantity WHERE orderStatus = 'canceled')
Refunded = SUM(quantity WHERE orderStatus = 'refunded')
```

### Net Open
Represents items still in transit or pending:

```sql
Net Open = GREATEST(
    Order Placed Quantity - Delivered Quantity - Canceled - Refunded,
    0
)
```

### Dates
Each lifecycle milestone uses the **earliest** event date:

```sql
Order Date = MIN(orderDate WHERE orderStatus = 'confirmed')
Shipped Date = MIN(orderDate WHERE orderStatus = 'shipped')
Out for Delivery Date = MIN(orderDate WHERE orderStatus = 'out_for_delivery')
Delivered Date = MIN(orderDate WHERE orderStatus = 'delivered')
```

### Unit Price
Taken from confirmation events (where pricing is typically present):

```sql
Unit Price = MAX(unitPrice WHERE orderStatus = 'confirmed')
```

## Usage

### Apply the View

```bash
node scripts/applyLifecycleView.js
```

This reads `prisma/Views/v_order_items_flat.sql` and creates/replaces the view in the database.

### Validate the View

```bash
node test/lifecycleViewValidation.js
```

Checks:
- View exists
- Column names match CSV requirements
- Data structure is correct
- Sample data is queryable

### Export to CSV

```bash
node scripts/exportLifecycleCSV.js
```

Exports the view to `lifecycle_export.csv` with:
- Exact column headers matching Example_of_endstate_requirements.csv
- Proper CSV formatting (quoted strings, escaped commas)
- Date formatting (YYYY-MM-DD)

### Direct SQL Export

Using psql:

```bash
psql $DATABASE_URL -c "\COPY (SELECT * FROM v_order_items_flat) TO 'lifecycle_export.csv' CSV HEADER"
```

## Example Data Flow

### Scenario: 2 Gold Rings Ordered, 2 Shipped, 2 Delivered

**Events in Database:**

| Order # | Status | Quantity | Date |
|---------|--------|----------|------|
| 10664 | confirmed | 2 | 2024-12-01 |
| 10664 | shipped | 2 | 2024-12-02 |
| 10664 | delivered | 2 | 2024-12-03 |

**View Output:**

| Vendor ID | Order Number | Description | Order Placed Quantity | Shipped Quantity | Delivered Quantity | Net Open |
|-----------|--------------|-------------|----------------------|------------------|-------------------|----------|
| jtw | 10664 | Gold Seam Ring - 14K Yellow Gold | 2 | 2 | 2 | 0 |

### Scenario: 5 Items Ordered, 3 Delivered, 2 Canceled

**Events in Database:**

| Order # | Status | Quantity | Date |
|---------|--------|----------|------|
| 2443 | confirmed | 5 | 2024-12-01 |
| 2443 | shipped | 5 | 2024-12-02 |
| 2443 | delivered | 3 | 2024-12-03 |
| 2443 | canceled | 2 | 2024-12-03 |

**View Output:**

| Vendor ID | Order Number | Description | Order Placed Quantity | Shipped Quantity | Delivered Quantity | Canceled | Net Open |
|-----------|--------------|-------------|----------------------|------------------|-------------------|----------|----------|
| cascade | 2443 | Threadless Ball End | 5 | 5 | 3 | 2 | 0 |

## Column Name Design

Column names include spaces and match CSV headers exactly:
- `"Vendor ID"` not `vendor_id`
- `"Order Number"` not `order_number`
- `"Internal Sku"` not `internal_sku`

This design choice makes CSV export trivial - no column mapping needed.

## Integration with Parsers

The view automatically aggregates data from all vendor parsers:
1. Parser extracts items from email → `orderService.saveParsedOrder()`
2. Items normalized → `normalizeItem()` assigns `internalSku`
3. Order and OrderItem records created in database
4. View aggregates by `(vendorId, vendorOrderNumber, internalSku, description)`
5. Export to CSV for analysis

## Maintenance

### Adding New Lifecycle Statuses

To add a new status (e.g., `returned`):

1. Update the view SQL:
```sql
-- Add to aggregated CTE
COALESCE(
  SUM(
    CASE
      WHEN "orderStatus" = 'returned' THEN "quantity"
      ELSE 0
    END
  ),
  0
) AS "returnedQty",

MIN(
  CASE
    WHEN "orderStatus" = 'returned' THEN "orderDate"
    ELSE NULL
  END
) AS "returnedDate"
```

2. Add to final SELECT:
```sql
a."returnedQty" AS "Returned Quantity",
a."returnedDate" AS "Returned Date",
```

3. Update Net Open calculation if needed

4. Re-apply the view: `node scripts/applyLifecycleView.js`

### Modifying Grouping Key

If you need to change how items are grouped (e.g., add `vendor_sku` to the key):

1. Update GROUP BY in aggregated CTE
2. Update final SELECT to include new grouping column
3. Re-apply the view

## Performance Considerations

### Indexes
The view benefits from these indexes (already present):

```sql
-- On Order table
CREATE INDEX ON "Order" ("vendorId", "vendorOrderNumber");

-- On OrderItem table
CREATE INDEX ON "OrderItem" ("vendorId", "vendorOrderNumber");
CREATE INDEX ON "OrderItem" ("orderId");
```

### Materialized View (Optional)
For large datasets, consider converting to a materialized view:

```sql
CREATE MATERIALIZED VIEW "v_order_items_flat" AS
-- ... same query ...

-- Refresh periodically
REFRESH MATERIALIZED VIEW "v_order_items_flat";
```

## Troubleshooting

### View Returns No Data
- Check that Order records have `orderStatus` set
- Verify OrderItem records exist and are linked to Orders
- Ensure `orderStatus` values match expected strings (case-sensitive)

### Quantities Don't Match
- Verify parser is extracting quantities correctly
- Check that all lifecycle events are being saved
- Confirm `orderStatus` is being set correctly by classifier

### Dates Are NULL
- Ensure `orderDate` is being set on Order records
- Check that Date header from emails is being parsed
- Verify timezone handling

### Duplicate Rows
- Check grouping key uniqueness
- Verify `internalSku` is being assigned consistently
- Look for description variations (whitespace, case)

## Files

- **View Definition**: `prisma/Views/v_order_items_flat.sql`
- **Apply Script**: `scripts/applyLifecycleView.js`
- **Validation**: `test/lifecycleViewValidation.js`
- **Export Script**: `scripts/exportLifecycleCSV.js`
- **Documentation**: `LIFECYCLE_VIEW_DOCUMENTATION.md` (this file)

## Related Documentation

- [Item Normalization Audit](ITEM_NORMALIZATION_AUDIT.md) - How items get stable SKUs
- [Shopify Parser Audit](SHOPIFY_PARSER_ITEM_EXTRACTION_AUDIT.md) - How items are extracted
- [Vendor Email Classification](VENDOR_EMAIL_CLASSIFICATION_AUDIT.md) - How statuses are determined
