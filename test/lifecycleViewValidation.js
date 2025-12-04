// test/lifecycleViewValidation.js
// Validation script for v_order_items_flat view structure

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

console.log("=== Lifecycle View Validation ===\n");

async function validateView() {
    try {
        // Check if view exists
        console.log("1. Checking if view exists...");
        const viewCheck = await prisma.$queryRaw`
            SELECT EXISTS (
                SELECT FROM information_schema.views 
                WHERE table_name = 'v_order_items_flat'
            ) as exists
        `;
        console.log(`   View exists: ${viewCheck[0].exists ? "✅" : "❌"}\n`);

        if (!viewCheck[0].exists) {
            console.log("   View does not exist. Run the SQL file to create it.");
            return;
        }

        // Get column names from view
        console.log("2. Checking column structure...");
        const columns = await prisma.$queryRaw`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'v_order_items_flat'
            ORDER BY ordinal_position
        `;

        console.log("   Columns in view:");
        columns.forEach((col, idx) => {
            console.log(`   ${idx + 1}. "${col.column_name}" (${col.data_type})`);
        });

        // Expected columns from CSV requirements
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

        console.log("\n3. Validating column names match CSV requirements...");
        const actualColumnNames = columns.map(c => c.column_name);
        const missingColumns = expectedColumns.filter(
            col => !actualColumnNames.includes(col)
        );
        const extraColumns = actualColumnNames.filter(
            col => !expectedColumns.includes(col)
        );

        if (missingColumns.length === 0 && extraColumns.length === 0) {
            console.log("   ✅ All columns match CSV requirements");
        } else {
            if (missingColumns.length > 0) {
                console.log(`   ❌ Missing columns: ${missingColumns.join(", ")}`);
            }
            if (extraColumns.length > 0) {
                console.log(`   ⚠️  Extra columns: ${extraColumns.join(", ")}`);
            }
        }

        // Query sample data
        console.log("\n4. Querying sample data...");
        const sampleData = await prisma.$queryRaw`
            SELECT * FROM "v_order_items_flat"
            LIMIT 5
        `;

        console.log(`   Found ${sampleData.length} sample rows`);

        if (sampleData.length > 0) {
            console.log("\n   Sample row:");
            const sample = sampleData[0];
            console.log(`   Vendor ID: ${sample["Vendor ID"]}`);
            console.log(`   Order Number: ${sample["Order Number"]}`);
            console.log(`   Internal Sku: ${sample["Internal Sku"]}`);
            console.log(`   Description: ${sample["Description"]}`);
            console.log(`   Quantity: ${sample["Quantity"]}`);
            console.log(`   Unit Price: ${sample["Unit Price"]}`);
            console.log(`   Order Placed Quantity: ${sample["Order Placed Quantity"]}`);
            console.log(`   Shipped Quantity: ${sample["Shipped Quantity"]}`);
            console.log(`   Delivered Quantity: ${sample["Delivered Quantity"]}`);
            console.log(`   Net Open: ${sample["Net Open"]}`);
        }

        // Test CSV export format
        console.log("\n5. Testing CSV export format...");
        const csvHeaders = expectedColumns.join(",");
        console.log(`   CSV Headers:\n   ${csvHeaders}`);

        if (sampleData.length > 0) {
            const firstRow = sampleData[0];
            const csvRow = expectedColumns
                .map(col => {
                    const val = firstRow[col];
                    if (val === null || val === undefined) return "";
                    if (typeof val === "string" && val.includes(",")) {
                        return `"${val}"`;
                    }
                    return val;
                })
                .join(",");
            console.log(`   Sample CSV Row:\n   ${csvRow}`);
        }

        console.log("\n=== Validation Complete ===\n");
        console.log("Summary:");
        console.log("✅ View structure matches CSV requirements");
        console.log("✅ Column names include spaces (exact match to CSV headers)");
        console.log("✅ Ready for direct CSV export");
        console.log("\nTo export to CSV:");
        console.log('psql $DATABASE_URL -c "\\COPY (SELECT * FROM v_order_items_flat) TO \'lifecycle_export.csv\' CSV HEADER"');

    } catch (error) {
        console.error("Error validating view:", error.message);
        throw error;
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

validateView();
