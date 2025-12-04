// scripts/applyLifecycleView.js
// Apply the v_order_items_flat view to the database

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pkg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error("DATABASE_URL is not set in environment");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function applyView() {
    try {
        console.log("=== Applying Lifecycle View ===\n");

        // Read the SQL file
        const sqlPath = path.join(__dirname, "..", "prisma", "Views", "v_order_items_flat.sql");
        console.log(`Reading SQL from: ${sqlPath}`);

        const sql = fs.readFileSync(sqlPath, "utf8");
        console.log(`SQL file size: ${sql.length} bytes\n`);

        // Execute the SQL
        console.log("Executing CREATE OR REPLACE VIEW...");
        await prisma.$executeRawUnsafe(sql);
        console.log("✅ View created successfully\n");

        // Verify the view exists
        const viewCheck = await prisma.$queryRaw`
            SELECT EXISTS (
                SELECT FROM information_schema.views 
                WHERE table_name = 'v_order_items_flat'
            ) as exists
        `;

        if (viewCheck[0].exists) {
            console.log("✅ View verified in database\n");

            // Get row count
            const countResult = await prisma.$queryRaw`
                SELECT COUNT(*) as count FROM "v_order_items_flat"
            `;
            console.log(`View contains ${countResult[0].count} rows\n`);

            // Show sample
            const sample = await prisma.$queryRaw`
                SELECT * FROM "v_order_items_flat" LIMIT 3
            `;

            if (sample.length > 0) {
                console.log("Sample data:");
                sample.forEach((row, idx) => {
                    console.log(`\nRow ${idx + 1}:`);
                    console.log(`  Vendor ID: ${row["Vendor ID"]}`);
                    console.log(`  Order Number: ${row["Order Number"]}`);
                    console.log(`  Internal Sku: ${row["Internal Sku"]}`);
                    console.log(`  Description: ${row["Description"]}`);
                    console.log(`  Order Placed Quantity: ${row["Order Placed Quantity"]}`);
                    console.log(`  Delivered Quantity: ${row["Delivered Quantity"]}`);
                    console.log(`  Net Open: ${row["Net Open"]}`);
                });
            }
        } else {
            console.log("❌ View not found after creation");
        }

        console.log("\n=== View Applied Successfully ===");

    } catch (error) {
        console.error("Error applying view:", error.message);
        throw error;
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

applyView();
