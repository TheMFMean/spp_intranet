CREATE OR REPLACE VIEW "v_order_items_flat" AS
WITH base AS (
  SELECT
    oi."id" AS "orderItemId",
    oi."orderId",

    -- Prefer item level vendor info, fall back to order level
    COALESCE(oi."vendorId", o."vendorId") AS "vendorId",
    COALESCE(oi."vendorOrderNumber", o."vendorOrderNumber") AS "vendorOrderNumber",

    -- Item key for grouping and display: use description only
    oi."description" AS "itemKey",

    -- Item identity fields
    oi."internalSku",        -- Soda Pop SKU (real or SPP-######)
    oi."vendor_sku",         -- Vendor SKU from email
    oi."sku",                -- Any other SKU field you end up using
    oi."description",

    -- Price - only confirmations will usually have this
    oi."unitPrice",

    -- Quantities and status
    oi."quantity",
    o."orderStatus",
    o."orderDate"
  FROM "OrderItem" oi
  JOIN "Order" o
    ON oi."orderId" = o."id"
),
aggregated AS (
  SELECT
    "vendorId",
    "vendorOrderNumber",
    "itemKey",
    "internalSku",
    "vendor_sku",
    "sku",
    "description",

    -- Use a single unitPrice per itemKey - from any event that has it
    MAX("unitPrice") AS "unitPrice",

    -- Quantities by lifecycle stage
    SUM(
      CASE
        WHEN "orderStatus" = 'confirmed' THEN "quantity"
        ELSE 0
      END
    ) AS "orderedQty",

    SUM(
      CASE
        WHEN "orderStatus" = 'shipped' THEN "quantity"
        ELSE 0
      END
    ) AS "shippedQty",

    SUM(
      CASE
        WHEN "orderStatus" = 'out_for_delivery' THEN "quantity"
        ELSE 0
      END
    ) AS "outForDeliveryQty",

    SUM(
      CASE
        WHEN "orderStatus" = 'delivered' THEN "quantity"
        ELSE 0
      END
    ) AS "deliveredQty",

    SUM(
      CASE
        WHEN "orderStatus" IN ('canceled', 'refunded') THEN "quantity"
        ELSE 0
      END
    ) AS "canceledQty",

    MIN("orderDate") AS "firstEventDate",
    MAX("orderDate") AS "lastEventDate"
  FROM base
  GROUP BY
    "vendorId",
    "vendorOrderNumber",
    "itemKey",
    "internalSku",
    "vendor_sku",
    "sku",
    "description"
)
SELECT
  a."vendorId",
  a."vendorOrderNumber",
  a."itemKey",       -- description
  a."internalSku",   -- Soda Pop SKU (real or SPP-######)
  a."vendor_sku",    -- vendor SKU from email
  a."sku",
  a."description",

  a."unitPrice",

  a."orderedQty",
  a."shippedQty",
  a."outForDeliveryQty",
  a."deliveredQty",
  a."canceledQty",

  GREATEST(
    a."orderedQty"
      - a."canceledQty"
      - a."deliveredQty",
    0
  ) AS "openQty",

  a."firstEventDate",
  a."lastEventDate",

  CASE
    WHEN a."deliveredQty" > 0
         AND a."deliveredQty" >= a."orderedQty" - a."canceledQty"
      THEN 'delivered'
    WHEN a."canceledQty" > 0
         AND a."deliveredQty" = 0
      THEN 'canceled'
    WHEN a."outForDeliveryQty" > 0
         AND a."deliveredQty" = 0
      THEN 'out_for_delivery'
    WHEN a."shippedQty" > 0
         AND a."deliveredQty" = 0
      THEN 'shipped'
    WHEN a."orderedQty" > 0
         AND a."shippedQty" = 0
      THEN 'ordered'
    ELSE 'other'
  END AS "lifecycleStatus"
FROM aggregated a;
