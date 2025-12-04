# Smoke Test Summary

## Quick Validation

Run automated smoke test:

```bash
node test/smokeTest.js
```

This validates:
- ✅ Order table has data
- ✅ OrderItem table has data
- ✅ orderStatus values are populated
- ✅ internalSku is assigned (SPP-XXXXXX format)
- ✅ Lifecycle view exists
- ✅ View has data
- ✅ All expected columns present
- ✅ Net Open calculation is correct
- ✅ No negative Net Open values
- ✅ Sample data is retrievable

## Manual Validation

For detailed manual testing, see:

```
notes/inventory_lifecycle_smoketest.md
```

This includes:
- Step-by-step queries
- Expected output examples
- Specific vendor/order validation
- Troubleshooting guide

## Quick Commands

### 1. Run Gmail Poller
```bash
cd /srv/backend
node workers/gmailPoller.js
```

### 2. Apply Lifecycle View
```bash
node scripts/applyLifecycleView.js
```

### 3. Run Smoke Test
```bash
node test/smokeTest.js
```

### 4. Export CSV
```bash
node scripts/exportLifecycleCSV.js
```

## Expected Results

### Automated Test Output

```
=== Lifecycle Pipeline Smoke Test ===

1. Checking Order table...
✅ Order table has 42 records

2. Checking OrderItem table...
✅ OrderItem table has 156 records

3. Checking orderStatus values...
✅ Found 6 distinct order statuses
ℹ️  Statuses: canceled, confirmed, delivered, out_for_delivery, refunded, shipped

4. Checking internalSku assignment...
✅ 156 items have internalSku assigned
✅ internalSku format is correct: SPP-620123

5. Checking lifecycle view...
✅ Lifecycle view exists

6. Checking lifecycle view data...
✅ Lifecycle view has 52 rows

7. Checking view columns...
✅ All expected columns present

8. Checking Net Open calculation...
✅ Net Open calculation is correct

9. Checking for negative Net Open...
✅ No negative Net Open values

10. Sampling lifecycle data...
✅ Retrieved 3 sample rows

==================================================
SMOKE TEST SUMMARY
==================================================
✅ Passed: 10
❌ Failed: 0
📊 Total:  10

🎉 All tests passed! Pipeline is working correctly.
```

### Manual Query Output

**Sample Order Data:**
```sql
SELECT * FROM "Order" LIMIT 3;
```
```
 id   | vendorId | vendorOrderNumber | orderStatus | orderDate  | total
------+----------+-------------------+-------------+------------+--------
 abc1 | jtw      | 10664             | confirmed   | 2024-12-01 | 205.98
 abc2 | jtw      | 10664             | shipped     | 2024-12-02 | NULL
 abc3 | jtw      | 10664             | delivered   | 2024-12-03 | NULL
```

**Sample Lifecycle Data:**
```sql
SELECT * FROM "v_order_items_flat" LIMIT 1;
```
```
 Vendor ID | Order Number | Internal Sku | Description              | Order Placed | Shipped | Delivered | Net Open
-----------+--------------+--------------+--------------------------+--------------+---------+-----------+----------
 jtw       | 10664        | SPP-620123   | Gold Seam Ring - 14K...  |            2 |       2 |         2 |        0
```

## Troubleshooting

### Test Fails: Order table is empty

**Solution:**
```bash
node workers/gmailPoller.js
```

### Test Fails: Lifecycle view not found

**Solution:**
```bash
node scripts/applyLifecycleView.js
```

### Test Fails: internalSku format incorrect

**Check:**
```bash
node test/itemNormalizerValidation.js
```

See: `ITEM_NORMALIZATION_AUDIT.md`

### Test Fails: Net Open calculation incorrect

**Check raw data:**
```sql
SELECT 
    "Order Placed Quantity",
    "Delivered Quantity",
    "Canceled",
    "Refunded",
    "Net Open",
    ("Order Placed Quantity" - "Delivered Quantity" - "Canceled" - "Refunded") as "Expected"
FROM "v_order_items_flat"
WHERE "Net Open" != ("Order Placed Quantity" - "Delivered Quantity" - "Canceled" - "Refunded");
```

## Files

- **Automated Test**: `test/smokeTest.js`
- **Manual Test Guide**: `notes/inventory_lifecycle_smoketest.md`
- **Lifecycle View**: `prisma/Views/v_order_items_flat.sql`
- **Apply Script**: `scripts/applyLifecycleView.js`
- **Export Script**: `scripts/exportLifecycleCSV.js`

## Success Criteria

All tests pass:
- ✅ Data flows from emails → database
- ✅ Items are normalized with stable SKUs
- ✅ Lifecycle view aggregates correctly
- ✅ CSV export works
- ✅ Net Open calculation is accurate

## Next Steps

1. Run smoke test: `node test/smokeTest.js`
2. If passes: Export CSV: `node scripts/exportLifecycleCSV.js`
3. If fails: See troubleshooting in `notes/inventory_lifecycle_smoketest.md`
4. Set up scheduled poller for ongoing updates
5. Create dashboards from lifecycle data
