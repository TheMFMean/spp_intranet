// /srv/backend/routes/incomingInventoryExport.js

import express from "express";
import { prisma } from "../services/orderService.js";

const router = express.Router();

router.get("/incoming-inventory/export", async (req, res) => {
  try {
    // Raw SQL gives us a perfectly flat table
    const rows = await prisma.$queryRawUnsafe(`
      select
        o."vendorId"                               as vendor,
        coalesce(o."orderDate", o."createdAt")     as order_date,
        o."vendorOrderNumber"                      as order_number,
        oi."vendor_sku"                            as sku,
        oi."description",
        oi."quantity",
        oi."unitPrice"                             as unit_price,
        oi."lineTotal"                             as line_total
      from "OrderItem" oi
      join "Order" o
        on oi."orderId" = o."id"
      order by order_date desc, o."vendorId", oi."id";
    `);



    // Build CSV header
    let csv = "vendor,order_date,order_number,sku,description,quantity,unit_price,line_total\n";

    // Rows → CSV lines
    for (const r of rows) {
      const line = [
        r.vendor,
        r.order_date?.toISOString() ?? "",
        r.order_number ?? "",
        r.sku ?? "",
        // Escape quotes & commas in description
        `"${(r.description || "").replace(/"/g, '""')}"`,
        r.quantity ?? "",
        r.unit_price ?? "",
        r.line_total ?? "",
      ].join(",");

      csv += line + "\n";
    }

    // Return CSV file
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=\"incoming_inventory.csv\"");
    res.status(200).send(csv);

  } catch (err) {
    console.error("CSV export error:", err);
    res.status(500).json({ error: "Failed to generate CSV" });
  }
});

export default router;
