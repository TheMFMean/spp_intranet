-- ============================================================================
-- v_order_items_flat.sql
-- ============================================================================
-- CANONICAL LIFECYCLE EXPORT VIEW
--
-- This view aggregates Order and OrderItem data to produce a flat,
-- item-level lifecycle report that matches Example_of_endstate_requirements.csv.
--
-- Purpose:
-- - Track each item's journey through order lifecycle stages
-- - Aggregate quantities by status (confirmed, shipped, delivered, etc.)
-- - Calculate net open quantities (ordered - delivered - canceled)
-- - Provide dates for each lifecycle milestone
--
-- Grouping Key:
-- - vendorId + vendorOrderNumber + internalSku + description
-- - Ensures all lifecycle events for the same physical item are aggregated
--
-- Column Aliases:
-- - Exact match to CSV headers (including spaces) for trivial export
--
-- Data Sources:
-- - Order table: orderStatus, orderDate, vendor info
-- - OrderItem table: quantities, prices, SKUs, descriptions
--
-- Lifecycle Statuses:
-- - confirmed: Order placed, source of unit price and initial quantity
-- - shipped: Items shipped to customer
-- - out_for_delivery: Items out for delivery
-- - delivered: Items successfully delivered
-- - canceled: Order canceled
-- - refunded: Order refunded
--
-- ============================================================================

CREATE OR REPLACE VIEW "v_order_items_flat" AS
WITH base AS (
  SELECT
    -- Vendor and order identification
    COALESCE(oi."vendorId", o."vendorId") AS "vendorId",
    COALESCE(oi."vendorOrderNumber", o."vendorOrderNumber") AS "vendorOrderNumber",

    -- Item identification
    oi."internalSku",
    oi."vendor_sku",
    oi."description",

    -- Price (only from confirmation events typically)
    oi."unitPrice",

    -- Quantity and status
    oi."quantity",
    o."orderStatus",
    o."orderDate"

  FROM "OrderItem" oi
  JOIN "Order" o ON oi."orderId" = o."id"
  WHERE o."orderStatus" IS NOT NULL
),
aggregated AS (
  SELECT
    "vendorId",
    "vendorOrderNumber",
    "internalSku",
    "vendor_sku",
    "description",

    -- Unit Price: from confirmation events (where price is typically present)
    MAX(
      CASE
        WHEN "orderStatus" = 'confirmed' THEN "unitPrice"
        ELSE NULL
      END
    ) AS "unitPrice",

    -- Order Placed Quantity: sum of confirmed quantities
    COALESCE(
      SUM(
        CASE
          WHEN "orderStatus" = 'confirmed' THEN "quantity"
          ELSE 0
        END
      ),
      0
    ) AS "orderPlacedQty",

    -- Shipped Quantity: sum of shipped quantities
    COALESCE(
      SUM(
        CASE
          WHEN "orderStatus" = 'shipped' THEN "quantity"
          ELSE 0
        END
      ),
      0
    ) AS "shippedQty",

    -- Out for Delivery Quantity: sum of out_for_delivery quantities
    COALESCE(
      SUM(
        CASE
          WHEN "orderStatus" = 'out_for_delivery' THEN "quantity"
          ELSE 0
        END
      ),
      0
    ) AS "outForDeliveryQty",

    -- Delivered Quantity: sum of delivered quantities
    COALESCE(
      SUM(
        CASE
          WHEN "orderStatus" = 'delivered' THEN "quantity"
          ELSE 0
        END
      ),
      0
    ) AS "deliveredQty",

    -- Canceled: sum of canceled quantities
    COALESCE(
      SUM(
        CASE
          WHEN "orderStatus" = 'canceled' THEN "quantity"
          ELSE 0
        END
      ),
      0
    ) AS "canceledQty",

    -- Refunded: sum of refunded quantities
    COALESCE(
      SUM(
        CASE
          WHEN "orderStatus" = 'refunded' THEN "quantity"
          ELSE 0
        END
      ),
      0
    ) AS "refundedQty",

    -- Dates: earliest event date per status
    MIN(
      CASE
        WHEN "orderStatus" = 'confirmed' THEN "orderDate"
        ELSE NULL
      END
    ) AS "orderDate",

    MIN(
      CASE
        WHEN "orderStatus" = 'shipped' THEN "orderDate"
        ELSE NULL
      END
    ) AS "shippedDate",

    MIN(
      CASE
        WHEN "orderStatus" = 'out_for_delivery' THEN "orderDate"
        ELSE NULL
      END
    ) AS "outForDeliveryDate",

    MIN(
      CASE
        WHEN "orderStatus" = 'delivered' THEN "orderDate"
        ELSE NULL
      END
    ) AS "deliveredDate"

  FROM base
  GROUP BY
    "vendorId",
    "vendorOrderNumber",
    "internalSku",
    "vendor_sku",
    "description"
)
SELECT
  -- Column aliases match CSV headers exactly (including spaces)
  a."vendorId" AS "Vendor ID",
  a."vendorOrderNumber" AS "Order Number",
  a."internalSku" AS "Internal Sku",
  a."vendor_sku" AS "Vendor Sku",
  a."description" AS "Description",

  -- Quantity: event-level quantity (for now, same as Order Placed Quantity)
  a."orderPlacedQty" AS "Quantity",

  -- Unit Price: from confirmation events
  a."unitPrice" AS "Unit Price",

  -- Order Placed
  a."orderPlacedQty" AS "Order Placed Quantity",
  a."orderDate" AS "Order Date",

  -- Shipped
  a."shippedQty" AS "Shipped Quantity",
  a."shippedDate" AS "Shipped Date",

  -- Out for Delivery
  a."outForDeliveryQty" AS "Out for Delivery Quantity",
  a."outForDeliveryDate" AS "Out for Delivery Date",

  -- Delivered
  a."deliveredQty" AS "Delivered Quantity",
  a."deliveredDate" AS "Delivered Date",

  -- Canceled and Refunded
  a."canceledQty" AS "Canceled",
  a."refundedQty" AS "Refunded",

  -- Net Open: Order Placed - Delivered - Canceled - Refunded
  GREATEST(
    a."orderPlacedQty" - a."deliveredQty" - a."canceledQty" - a."refundedQty",
    0
  ) AS "Net Open"

FROM aggregated a
WHERE a."orderPlacedQty" > 0  -- Only include items that were actually ordered
ORDER BY
  a."vendorId",
  a."vendorOrderNumber",
  a."internalSku";
