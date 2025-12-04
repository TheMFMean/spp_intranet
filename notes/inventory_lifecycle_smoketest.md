# Inventory Lifecycle Smoke Test

## Purpose

Validate that the end-to-end lifecycle pipeline is working correctly:
1. Gmail poller fetches emails
2. Parsers extract items from all lifecycle events
3. Items are normalized with stable internal SKUs
4. Data flows into Order and OrderItem tables
5. Lifecycle view aggregates events correctly

## Prerequisites

- Database is running and accessible via `$DATABASE_URL`
- Gmail credentials are configured
- Lifecycle view has been applied: `node scripts/applyLifecycleView.js`

---

## Step 1: Run the Gmail Poller

Fetch and process vendor emails:

```bash
cd /srv/backend
node workers/gmailPoller.js
```

**What to look for:**
- Console output showing emails being processed
- Classification messages: `vendorId=xxx, status=yyy`
- Parser output: `parsed: orderNumber=xxx, items=N`
- Database saves: `saved to DB: orderId=xxx, items=N`

**Expected output example:**
```
========== Vendor JTW, LLC ==========
Query: from:(...) newer_than:180d

  - 2024-12-01 | jtw@example.com | Order #10664 confirmed
    classification: vendorId=jtw, status=confirmed
    [jtw] parsed: orderNumber=10664, items=2, total=205.98, status=confirmed
    [jtw] saved to DB: orderId=abc123, items=2
```

---

## Step 2: Verify Raw Order Data

Check that Order records were created:

```bash
psql $DATABASE_URL
```

### Query 1: Sample Orders

```sql
SELECT 
    "id",
    "vendorId",
    "vendorOrderNumber",
    "orderStatus",
    "orderDate",
    "total",
    "createdAt"
FROM "Order"
ORDER BY "createdAt" DESC
LIMIT 10;
```

**What to look for:**
- Recent orders with timestamps
- Various `orderStatus` values: confirmed, shipped, delivered, etc.
- Different vendors: jtw, cascade, oracle, etc.
- Order numbers populated

### Query 2: Count Orders by Vendor and Status

```sql
SELECT 
    "vendorId",
    "orderStatus",
    COUNT(*) as count
FROM "Order"
WHERE "orderStatus" IS NOT NULL
GROUP BY "vendorId", "orderStatus"
ORDER BY "vendorId", "orderStatus";
```

**Expected output:**
```
 vendorId  | orderStatus      | count
-----------+------------------+-------
 cascade   | confirmed        |     5
 cascade   | shipped          |     4
 cascade   | delivered        |     3
 jtw       | confirmed        |     8
 jtw       | shipped          |     7
 jtw       | delivered        |     6
 oracle    | confirmed        |     3
 ...
```

---

## Step 3: Verify OrderItem Data

Check that items were extracted and normalized:

### Query 3: Sample OrderItems

```sql
SELECT 
    oi."id",
    oi."vendorId",
    oi."vendorOrderNumber",
    oi."description",
    oi."quantity",
    oi."unitPrice",
    oi."internalSku",
    oi."vendor_sku",
    o."orderStatus",
    o."orderDate"
FROM "OrderItem" oi
JOIN "Order" o ON oi."orderId" = o."id"
ORDER BY o."createdAt" DESC
LIMIT 20;
```

**What to look for:**
- Items have descriptions
- Quantities are present
- `internalSku` is populated (SPP-XXXXXX format)
- `unitPrice` is present for confirmed events
- `orderStatus` varies across rows

### Query 4: Verify Internal SKU Assignment

```sql
SELECT 
    "internalSku",
    COUNT(*) as occurrences,
    STRING_AGG(DISTINCT "description", ' | ') as descriptions
FROM "OrderItem"
WHERE "internalSku" IS NOT NULL
GROUP BY "internalSku"
HAVING COUNT(*) > 1
ORDER BY occurrences DESC
LIMIT 10;
```

**What to look for:**
- Same `internalSku` appears multiple times (across lifecycle events)
- Same description maps to same SKU
- SPP-XXXXXX format is consistent

**Expected output:**
```
 internalSku | occurrences | descriptions
-------------+-------------+------------------------------------------
 SPP-620123  |           6 | Gold Seam Ring - 14K Yellow Gold - 18g / 5/16"
 SPP-423598  |           4 | Threadless Ball End
 SPP-236719  |           3 | Threadless Ball End - 14K Rose Gold
```

---

## Step 4: Verify Lifecycle View

Check that the view aggregates events correctly:

### Query 5: Sample Lifecycle Data

```sql
SELECT 
    "Vendor ID",
    "Order Number",
    "Internal Sku",
    "Description",
    "Order Placed Quantity",
    "Shipped Quantity",
    "Delivered Quantity",
    "Net Open",
    "Order Date",
    "Delivered Date"
FROM "v_order_items_flat"
ORDER BY "Order Date" DESC
LIMIT 20;
```

**What to look for:**
- Each row represents one item (not one event)
- Quantities aggregate across lifecycle stages
- Net Open = Order Placed - Delivered - Canceled
- Dates show progression through lifecycle

### Query 6: Items with Full Lifecycle

Find items that have been ordered, shipped, and delivered:

```sql
SELECT 
    "Vendor ID",
    "Order Number",
    "Description",
    "Order Placed Quantity",
    "Shipped Quantity",
    "Delivered Quantity",
    "Net Open",
    "Order Date",
    "Shipped Date",
    "Delivered Date"
FROM "v_order_items_flat"
WHERE "Order Placed Quantity" > 0
  AND "Shipped Quantity" > 0
  AND "Delivered Quantity" > 0
ORDER BY "Order Date" DESC
LIMIT 10;
```

**Expected output:**
```
 Vendor ID | Order Number | Description              | Order Placed | Shipped | Delivered | Net Open
-----------+--------------+--------------------------+--------------+---------+-----------+----------
 jtw       | 10664        | Gold Seam Ring...        |            2 |       2 |         2 |        0
 cascade   | 2443         | Threadless Ball End      |            5 |       5 |         5 |        0
```

### Query 7: Items Still Open (In Transit)

Find items that haven't been fully delivered:

```sql
SELECT 
    "Vendor ID",
    "Order Number",
    "Description",
    "Order Placed Quantity",
    "Shipped Quantity",
    "Delivered Quantity",
    "Net Open",
    "Order Date",
    "Shipped Date"
FROM "v_order_items_flat"
WHERE "Net Open" > 0
ORDER BY "Order Date" DESC
LIMIT 10;
```

**What to look for:**
- Net Open > 0 indicates items still in transit
- Shipped Quantity > 0 but Delivered Quantity < Order Placed Quantity

---

## Step 5: Specific Vendor/Order Validation

Test with a known order from vendor email samples:

### Query 8: JTW Order #10664 (if exists in samples)

```sql
-- Check raw events
SELECT 
    o."orderStatus",
    o."orderDate",
    oi."description",
    oi."quantity",
    oi."unitPrice",
    oi."internalSku"
FROM "Order" o
JOIN "OrderItem" oi ON o."id" = oi."orderId"
WHERE o."vendorId" = 'jtw'
  AND o."vendorOrderNumber" = '10664'
ORDER BY o."orderDate", oi."description";
```

**Expected output (example):**
```
 orderStatus | orderDate  | description              | quantity | unitPrice | internalSku
-------------+------------+--------------------------+----------+-----------+-------------
 confirmed   | 2024-12-01 | Gold Seam Ring...        |        2 |    102.99 | SPP-620123
 shipped     | 2024-12-02 | Gold Seam Ring...        |        2 |      NULL | SPP-620123
 delivered   | 2024-12-03 | Gold Seam Ring...        |        2 |      NULL | SPP-620123
```

### Query 9: JTW Order #10664 Lifecycle View

```sql
SELECT 
    "Vendor ID",
    "Order Number",
    "Internal Sku",
    "Description",
    "Unit Price",
    "Order Placed Quantity",
    "Order Date",
    "Shipped Quantity",
    "Shipped Date",
    "Delivered Quantity",
    "Delivered Date",
    "Net Open"
FROM "v_order_items_flat"
WHERE "Vendor ID" = 'jtw'
  AND "Order Number" = '10664';
```

**Expected output (example):**
```
 Vendor ID | Order Number | Internal Sku | Description        | Unit Price | Order Placed | Shipped | Delivered | Net Open
-----------+--------------+--------------+--------------------+------------+--------------+---------+-----------+----------
 jtw       | 10664        | SPP-620123   | Gold Seam Ring...  |     102.99 |            2 |       2 |         2 |        0
```

### Query 10: Cascade Order (if exists)

```sql
SELECT 
    "Vendor ID",
    "Order Number",
    "Description",
    "Order Placed Quantity",
    "Shipped Quantity",
    "Out for Delivery Quantity",
    "Delivered Quantity",
    "Canceled",
    "Net Open"
FROM "v_order_items_flat"
WHERE "Vendor ID" = 'cascade'
ORDER BY "Order Number" DESC
LIMIT 5;
```

---

## Step 6: Aggregation Validation

Verify that quantities aggregate correctly:

### Query 11: Check Quantity Math

```sql
SELECT 
    "Vendor ID",
    "Order Number",
    "Internal Sku",
    "Description",
    "Order Placed Quantity",
    "Delivered Quantity",
    "Canceled",
    "Refunded",
    "Net Open",
    -- Verify calculation
    ("Order Placed Quantity" - "Delivered Quantity" - "Canceled" - "Refunded") as "Calculated Net Open"
FROM "v_order_items_flat"
WHERE "Order Placed Quantity" > 0
LIMIT 20;
```

**What to look for:**
- `Net Open` matches `Calculated Net Open`
- No negative values in Net Open

### Query 12: Items with Multiple Events

Find items that appear in multiple lifecycle stages:

```sql
SELECT 
    "Vendor ID",
    "Order Number",
    "Internal Sku",
    "Description",
    "Order Placed Quantity",
    "Shipped Quantity",
    "Out for Delivery Quantity",
    "Delivered Quantity",
    -- Count how many stages have data
    (CASE WHEN "Order Placed Quantity" > 0 THEN 1 ELSE 0 END +
     CASE WHEN "Shipped Quantity" > 0 THEN 1 ELSE 0 END +
     CASE WHEN "Out for Delivery Quantity" > 0 THEN 1 ELSE 0 END +
     CASE WHEN "Delivered Quantity" > 0 THEN 1 ELSE 0 END) as "Lifecycle Stages"
FROM "v_order_items_flat"
WHERE "Order Placed Quantity" > 0
ORDER BY "Lifecycle Stages" DESC, "Order Date" DESC
LIMIT 10;
```

**What to look for:**
- Items with 3-4 lifecycle stages (confirmed → shipped → delivered)
- Quantities should be consistent or decreasing through stages

---

## Step 7: Export Test

Test CSV export functionality:

```bash
# Export to CSV
node scripts/exportLifecycleCSV.js

# Check the file
ls -lh lifecycle_export.csv
head -20 lifecycle_export.csv
```

**What to look for:**
- File created successfully
- CSV headers match expected format
- Data rows are properly formatted
- No missing values in critical columns

---

## Expected Shape

### Item-Level Aggregation

Each row in `v_order_items_flat` represents **one item** (not one event):
- Grouped by: `(Vendor ID, Order Number, Internal Sku, Description)`
- All lifecycle events for the same item are aggregated into one row
- Example: If order #10664 has 3 events (confirmed, shipped, delivered) for "Gold Seam Ring", the view shows **1 row** with quantities from all 3 events

### Quantity Alignment

Quantities should follow logical progression:
- **Order Placed Quantity** ≥ **Shipped Quantity** ≥ **Delivered Quantity**
- **Net Open** = Order Placed - Delivered - Canceled - Refunded
- **Net Open** ≥ 0 (never negative)

### Date Progression

Dates should show chronological progression:
- **Order Date** ≤ **Shipped Date** ≤ **Out for Delivery Date** ≤ **Delivered Date**
- Each date is the **earliest** occurrence of that status
- NULL dates indicate that lifecycle stage hasn't occurred yet

### Price Availability

- **Unit Price** comes from confirmation events
- Shipment/delivery events typically don't have prices
- Same item should have same Unit Price across all events

### Internal SKU Consistency

- Same description → same Internal Sku (SPP-XXXXXX)
- Same Internal Sku → same description
- Format: `SPP-` followed by 6 digits (e.g., `SPP-620123`)

### Example: Complete Lifecycle

**Raw Events (3 rows in database):**
```
Order #10664, Status: confirmed,  Qty: 2, Date: 2024-12-01, Price: $102.99
Order #10664, Status: shipped,    Qty: 2, Date: 2024-12-02, Price: NULL
Order #10664, Status: delivered,  Qty: 2, Date: 2024-12-03, Price: NULL
```

**Lifecycle View (1 row):**
```
Vendor ID: jtw
Order Number: 10664
Description: Gold Seam Ring - 14K Yellow Gold
Internal Sku: SPP-620123
Unit Price: 102.99
Order Placed Quantity: 2
Order Date: 2024-12-01
Shipped Quantity: 2
Shipped Date: 2024-12-02
Delivered Quantity: 2
Delivered Date: 2024-12-03
Net Open: 0
```

### Example: Partial Fulfillment

**Raw Events:**
```
Order #2443, Status: confirmed, Qty: 5, Date: 2024-12-01
Order #2443, Status: shipped,   Qty: 5, Date: 2024-12-02
Order #2443, Status: delivered, Qty: 3, Date: 2024-12-03
Order #2443, Status: canceled,  Qty: 2, Date: 2024-12-03
```

**Lifecycle View:**
```
Order Placed Quantity: 5
Shipped Quantity: 5
Delivered Quantity: 3
Canceled: 2
Net Open: 0  (5 - 3 - 2 = 0)
```

---

## Troubleshooting

### No Data in View

**Problem:** `SELECT * FROM v_order_items_flat` returns 0 rows

**Check:**
1. Run poller: `node workers/gmailPoller.js`
2. Verify Order table has data: `SELECT COUNT(*) FROM "Order";`
3. Verify OrderItem table has data: `SELECT COUNT(*) FROM "OrderItem";`
4. Check orderStatus is set: `SELECT DISTINCT "orderStatus" FROM "Order";`

### Quantities Don't Match

**Problem:** Net Open calculation seems wrong

**Check:**
1. Verify raw events: Query 8 (specific order)
2. Check for duplicate events (same status, same date)
3. Verify parser is extracting quantities correctly
4. Check classification is assigning correct status

### Missing Lifecycle Stages

**Problem:** Items show confirmed but not shipped/delivered

**Check:**
1. Verify parsers extract items from shipment emails (not just confirmations)
2. Check vendor email samples have shipped/delivered emails
3. Verify classification detects shipped/delivered statuses
4. See: `SHOPIFY_PARSER_ITEM_EXTRACTION_AUDIT.md`

### Internal SKU Inconsistency

**Problem:** Same item has different Internal Skus

**Check:**
1. Verify description is consistent (whitespace, case)
2. Check normalizer is working: `node test/itemNormalizerValidation.js`
3. See: `ITEM_NORMALIZATION_AUDIT.md`

### Dates Are NULL

**Problem:** Shipped Date or Delivered Date is NULL

**Check:**
1. Verify Order records have orderDate set
2. Check email Date header is being parsed
3. Verify events exist for those statuses

---

## Success Criteria

✅ **Gmail Poller runs without errors**
✅ **Order table has records with various orderStatus values**
✅ **OrderItem table has items with internalSku assigned (SPP-XXXXXX)**
✅ **v_order_items_flat view returns data**
✅ **Quantities aggregate correctly (Net Open = Order Placed - Delivered - Canceled)**
✅ **Dates show logical progression (Order Date ≤ Shipped Date ≤ Delivered Date)**
✅ **Same item (description) has same Internal Sku across events**
✅ **CSV export produces valid file with correct headers**

---

## Next Steps

Once smoke test passes:
1. Run full poller to fetch all historical emails
2. Export complete lifecycle data: `node scripts/exportLifecycleCSV.js`
3. Import CSV into analysis tool (Excel, Google Sheets, etc.)
4. Set up scheduled poller (cron job) for ongoing updates
5. Create dashboards/reports from lifecycle data

---

## Related Documentation

- **Lifecycle View**: `LIFECYCLE_VIEW_DOCUMENTATION.md`
- **Quick Start**: `LIFECYCLE_QUICK_START.md`
- **Item Normalization**: `ITEM_NORMALIZATION_AUDIT.md`
- **Parser Audit**: `SHOPIFY_PARSER_ITEM_EXTRACTION_AUDIT.md`
- **Email Classification**: `VENDOR_EMAIL_CLASSIFICATION_AUDIT.md`
