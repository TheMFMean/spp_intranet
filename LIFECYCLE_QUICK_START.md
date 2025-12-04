# Lifecycle View Quick Start

## TL;DR

Export order lifecycle data to CSV matching `Example_of_endstate_requirements.csv`:

```bash
# 1. Apply the view to database
node scripts/applyLifecycleView.js

# 2. Export to CSV
node scripts/exportLifecycleCSV.js

# Output: lifecycle_export.csv
```

## What You Get

A CSV file with these columns:

```
Vendor ID, Order Number, Internal Sku, Vendor Sku, Description, Quantity,
Unit Price, Order Placed Quantity, Order Date, Shipped Quantity, Shipped Date,
Out for Delivery Quantity, Out for Delivery Date, Delivered Quantity,
Delivered Date, Canceled, Refunded, Net Open
```

## How It Works

```
Email → Parser → Normalizer → Database → View → CSV
```

1. **Email arrives** (Gmail poller fetches it)
2. **Parser extracts** items and status (confirmed, shipped, delivered, etc.)
3. **Normalizer assigns** stable internal SKU (SPP-XXXXXX)
4. **Database stores** Order and OrderItem records
5. **View aggregates** all events for each item
6. **CSV exports** flat lifecycle report

## Key Concepts

### Grouping
Items are grouped by:
- Vendor ID + Order Number + Internal SKU + Description

All lifecycle events for the same item appear in one row.

### Quantities
- **Order Placed**: Sum of `confirmed` events
- **Shipped**: Sum of `shipped` events
- **Delivered**: Sum of `delivered` events
- **Canceled**: Sum of `canceled` events
- **Refunded**: Sum of `refunded` events
- **Net Open**: Order Placed - Delivered - Canceled - Refunded

### Dates
Each status uses the **earliest** event date.

## Example

**Database Events:**
```
Order #10664, Status: confirmed, Qty: 2, Date: 2024-12-01
Order #10664, Status: shipped,   Qty: 2, Date: 2024-12-02
Order #10664, Status: delivered, Qty: 2, Date: 2024-12-03
```

**CSV Output:**
```csv
Vendor ID,Order Number,Description,Order Placed Quantity,Shipped Quantity,Delivered Quantity,Net Open
jtw,10664,Gold Seam Ring,2,2,2,0
```

## Commands

### Apply View
```bash
node scripts/applyLifecycleView.js
```
Creates/updates the `v_order_items_flat` view in the database.

### Validate View
```bash
node test/lifecycleViewValidation.js
```
Checks view structure and shows sample data.

### Export CSV
```bash
node scripts/exportLifecycleCSV.js
```
Exports to `lifecycle_export.csv` in project root.

### Direct SQL Export
```bash
psql $DATABASE_URL -c "\COPY (SELECT * FROM v_order_items_flat) TO 'export.csv' CSV HEADER"
```

## Query the View

```javascript
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Get all lifecycle data
const data = await prisma.$queryRaw`
    SELECT * FROM "v_order_items_flat"
    ORDER BY "Vendor ID", "Order Number"
`;

// Filter by vendor
const jtwData = await prisma.$queryRaw`
    SELECT * FROM "v_order_items_flat"
    WHERE "Vendor ID" = 'jtw'
`;

// Find open orders (Net Open > 0)
const openOrders = await prisma.$queryRaw`
    SELECT * FROM "v_order_items_flat"
    WHERE "Net Open" > 0
`;
```

## Troubleshooting

**No data in view?**
- Run the gmail poller to fetch emails
- Check that orders have `orderStatus` set
- Verify items are being saved to database

**Quantities wrong?**
- Check parser is extracting items from all lifecycle emails
- Verify `orderStatus` is being classified correctly
- See [Shopify Parser Audit](SHOPIFY_PARSER_ITEM_EXTRACTION_AUDIT.md)

**Dates missing?**
- Ensure `orderDate` is set on Order records
- Check email Date header is being parsed

**Duplicate rows?**
- Verify `internalSku` is consistent (see [Item Normalization](ITEM_NORMALIZATION_AUDIT.md))
- Check for description variations

## Files

- **View SQL**: `prisma/Views/v_order_items_flat.sql`
- **Apply Script**: `scripts/applyLifecycleView.js`
- **Export Script**: `scripts/exportLifecycleCSV.js`
- **Validation**: `test/lifecycleViewValidation.js`
- **Full Docs**: `LIFECYCLE_VIEW_DOCUMENTATION.md`

## Next Steps

1. Apply the view: `node scripts/applyLifecycleView.js`
2. Run gmail poller to populate data
3. Export CSV: `node scripts/exportLifecycleCSV.js`
4. Import CSV into your analysis tool
5. Track order fulfillment and identify issues

## Support

See full documentation in `LIFECYCLE_VIEW_DOCUMENTATION.md` for:
- Detailed column definitions
- Calculation logic
- Performance optimization
- Adding new lifecycle statuses
- Integration details
