// test/smokeTest.js
// Automated smoke test for lifecycle pipeline

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pkg from "pg";
import "dotenv/config";

const { Pool } = pkg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error("DATABASE_URL is not set in environment");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

console.log("=== Lifecycle Pipeline Smoke Test ===\n");

let passed = 0;
let failed = 0;

function pass(message) {
    console.log(`✅ ${message}`);
    passed++;
}

function fail(message) {
    console.log(`❌ ${message}`);
    failed++;
}

function info(message) {
    console.log(`ℹ️  ${message}`);
}

async function runTests() {
    try {
        // Test 1: Check Order table has data
        console.log("\n1. Checking Order table...");
        const orderCount = await prisma.$queryRaw`SELECT COUNT(*)::int as count FROM "Order"`;
        const orders = orderCount[0].count;

        if (orders > 0) {
            pass(`Order table has ${orders} records`);
        } else {
            fail("Order table is empty - run gmail poller first");
        }

        // Test 2: Check OrderItem table has data
        console.log("\n2. Checking OrderItem table...");
        const itemCount = await prisma.$queryRaw`SELECT COUNT(*)::int as count FROM "OrderItem"`;
        const items = itemCount[0].count;

        if (items > 0) {
            pass(`OrderItem table has ${items} records`);
        } else {
            fail("OrderItem table is empty");
        }

        // Test 3: Check orderStatus is populated
        console.log("\n3. Checking orderStatus values...");
        const statuses = await prisma.$queryRaw`
            SELECT DISTINCT "orderStatus" 
            FROM "Order" 
            WHERE "orderStatus" IS NOT NULL
            ORDER BY "orderStatus"
        `;

        if (statuses.length > 0) {
            pass(`Found ${statuses.length} distinct order statuses`);
            info(`   Statuses: ${statuses.map(s => s.orderStatus).join(", ")}`);
        } else {
            fail("No orderStatus values found");
        }

        // Test 4: Check internalSku is assigned
        console.log("\n4. Checking internalSku assignment...");
        const skuCount = await prisma.$queryRaw`
            SELECT COUNT(*)::int as count 
            FROM "OrderItem" 
            WHERE "internalSku" IS NOT NULL
        `;
        const skus = skuCount[0].count;

        if (skus > 0) {
            pass(`${skus} items have internalSku assigned`);

            // Check format
            const sampleSku = await prisma.$queryRaw`
                SELECT "internalSku" 
                FROM "OrderItem" 
                WHERE "internalSku" IS NOT NULL 
                LIMIT 1
            `;

            if (sampleSku.length > 0) {
                const sku = sampleSku[0].internalSku;
                if (/^SPP-\d{6}$/.test(sku)) {
                    pass(`internalSku format is correct: ${sku}`);
                } else {
                    fail(`internalSku format is incorrect: ${sku} (expected SPP-XXXXXX)`);
                }
            }
        } else {
            fail("No items have internalSku assigned");
        }

        // Test 5: Check lifecycle view exists
        console.log("\n5. Checking lifecycle view...");
        const viewExists = await prisma.$queryRaw`
            SELECT EXISTS (
                SELECT FROM information_schema.views 
                WHERE table_name = 'v_order_items_flat'
            ) as exists
        `;

        if (viewExists[0].exists) {
            pass("Lifecycle view exists");
        } else {
            fail("Lifecycle view not found - run: node scripts/applyLifecycleView.js");
        }

        // Test 6: Check view has data
        if (viewExists[0].exists) {
            console.log("\n6. Checking lifecycle view data...");
            const viewCount = await prisma.$queryRaw`
                SELECT COUNT(*)::int as count FROM "v_order_items_flat"
            `;
            const viewRows = viewCount[0].count;

            if (viewRows > 0) {
                pass(`Lifecycle view has ${viewRows} rows`);
            } else {
                fail("Lifecycle view is empty");
            }

            // Test 7: Check view columns
            console.log("\n7. Checking view columns...");
            const columns = await prisma.$queryRaw`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'v_order_items_flat'
                ORDER BY ordinal_position
            `;

            const expectedColumns = [
                "Vendor ID",
                "Order Number",
                "Internal Sku",
                "Vendor Sku",
                "Description",
                "Quantity",
                "Unit Price",
                "Order Placed Quantity",
                "Order Date",
                "Shipped Quantity",
                "Shipped Date",
                "Out for Delivery Quantity",
                "Out for Delivery Date",
                "Delivered Quantity",
                "Delivered Date",
                "Canceled",
                "Refunded",
                "Net Open",
            ];

            const actualColumns = columns.map(c => c.column_name);
            const missingColumns = expectedColumns.filter(
                col => !actualColumns.includes(col)
            );

            if (missingColumns.length === 0) {
                pass("All expected columns present");
            } else {
                fail(`Missing columns: ${missingColumns.join(", ")}`);
            }

            // Test 8: Check Net Open calculation
            if (viewRows > 0) {
                console.log("\n8. Checking Net Open calculation...");
                const netOpenCheck = await prisma.$queryRaw`
                    SELECT 
                        COUNT(*)::int as count
                    FROM "v_order_items_flat"
                    WHERE "Net Open" != GREATEST(
                        "Order Placed Quantity" - "Delivered Quantity" - "Canceled" - "Refunded",
                        0
                    )
                `;

                const incorrect = netOpenCheck[0].count;
                if (incorrect === 0) {
                    pass("Net Open calculation is correct");
                } else {
                    fail(`${incorrect} rows have incorrect Net Open calculation`);
                }

                // Test 9: Check for negative Net Open
                console.log("\n9. Checking for negative Net Open...");
                const negativeCheck = await prisma.$queryRaw`
                    SELECT COUNT(*)::int as count
                    FROM "v_order_items_flat"
                    WHERE "Net Open" < 0
                `;

                const negative = negativeCheck[0].count;
                if (negative === 0) {
                    pass("No negative Net Open values");
                } else {
                    fail(`${negative} rows have negative Net Open`);
                }

                // Test 10: Sample data
                console.log("\n10. Sampling lifecycle data...");
                const sample = await prisma.$queryRaw`
                    SELECT 
                        "Vendor ID",
                        "Order Number",
                        "Description",
                        "Order Placed Quantity",
                        "Shipped Quantity",
                        "Delivered Quantity",
                        "Net Open"
                    FROM "v_order_items_flat"
                    LIMIT 3
                `;

                if (sample.length > 0) {
                    pass(`Retrieved ${sample.length} sample rows`);
                    console.log("\n   Sample data:");
                    sample.forEach((row, idx) => {
                        console.log(`   ${idx + 1}. ${row["Vendor ID"]} | Order #${row["Order Number"]}`);
                        console.log(`      ${row["Description"]}`);
                        console.log(`      Ordered: ${row["Order Placed Quantity"]}, Shipped: ${row["Shipped Quantity"]}, Delivered: ${row["Delivered Quantity"]}, Net Open: ${row["Net Open"]}`);
                    });
                }
            }
        }

        // Summary
        console.log("\n" + "=".repeat(50));
        console.log("SMOKE TEST SUMMARY");
        console.log("=".repeat(50));
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📊 Total:  ${passed + failed}`);

        if (failed === 0) {
            console.log("\n🎉 All tests passed! Pipeline is working correctly.");
        } else {
            console.log("\n⚠️  Some tests failed. See details above.");
            console.log("\nTroubleshooting:");
            console.log("- If Order/OrderItem tables are empty: run gmail poller");
            console.log("- If view doesn't exist: run node scripts/applyLifecycleView.js");
            console.log("- If internalSku is missing: check itemNormalizer");
            console.log("- See: notes/inventory_lifecycle_smoketest.md");
        }

    } catch (error) {
        console.error("\n❌ Error running smoke test:", error.message);
        throw error;
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

runTests();
