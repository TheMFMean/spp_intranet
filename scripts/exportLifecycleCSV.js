// scripts/exportLifecycleCSV.js
// Export v_order_items_flat view to CSV matching Example_of_endstate_requirements.csv

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

// CSV column order (matches Example_of_endstate_requirements.csv)
const CSV_COLUMNS = [
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

/**
 * Format a value for CSV output
 */
function formatCSVValue(value) {
    if (value === null || value === undefined) {
        return "";
    }

    // Handle dates
    if (value instanceof Date) {
        return value.toISOString().split("T")[0]; // YYYY-MM-DD
    }

    // Handle decimals/numbers
    if (typeof value === "number" || (value && value.constructor && value.constructor.name === "Decimal")) {
        return String(value);
    }

    // Handle strings with commas or quotes
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
    }

    return str;
}

/**
 * Convert row object to CSV line
 */
function rowToCSV(row) {
    return CSV_COLUMNS.map(col => formatCSVValue(row[col])).join(",");
}

async function exportCSV() {
    try {
        console.log("=== Exporting Lifecycle Data to CSV ===\n");

        // Query all data from view
        console.log("Querying v_order_items_flat...");
        const data = await prisma.$queryRaw`
            SELECT * FROM "v_order_items_flat"
            ORDER BY "Vendor ID", "Order Number", "Internal Sku"
        `;

        console.log(`Found ${data.length} rows\n`);

        if (data.length === 0) {
            console.log("No data to export. View is empty.");
            return;
        }

        // Build CSV content
        const csvLines = [];

        // Header row
        csvLines.push(CSV_COLUMNS.join(","));

        // Data rows
        data.forEach(row => {
            csvLines.push(rowToCSV(row));
        });

        const csvContent = csvLines.join("\n");

        // Write to file
        const outputPath = path.join(__dirname, "..", "lifecycle_export.csv");
        fs.writeFileSync(outputPath, csvContent, "utf8");

        console.log(`✅ CSV exported successfully`);
        console.log(`   File: ${outputPath}`);
        console.log(`   Rows: ${data.length}`);
        console.log(`   Size: ${csvContent.length} bytes\n`);

        // Show sample
        console.log("Sample rows (first 3):");
        data.slice(0, 3).forEach((row, idx) => {
            console.log(`\n${idx + 1}. ${row["Vendor ID"]} | Order #${row["Order Number"]}`);
            console.log(`   ${row["Description"]}`);
            console.log(`   Internal SKU: ${row["Internal Sku"]}`);
            console.log(`   Ordered: ${row["Order Placed Quantity"]}, Delivered: ${row["Delivered Quantity"]}, Net Open: ${row["Net Open"]}`);
        });

        console.log("\n=== Export Complete ===");

    } catch (error) {
        console.error("Error exporting CSV:", error.message);
        throw error;
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

exportCSV();
