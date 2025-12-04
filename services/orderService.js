// /srv/backend/services/orderService.js

import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pkg from "pg";
import "dotenv/config";
import { normalizeItem } from "./itemNormalizer.js";

const { Pool } = pkg;

// Use DATABASE_URL from .env
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error("DATABASE_URL is not set in environment");
}

// Create pg pool and Prisma adapter (Prisma 7 engineType=client)
const pool = new Pool({
    connectionString,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/**
 * Normalize a numeric-ish value into Prisma.Decimal, or null.
 * Handles things like: "$1,234.56", "538.39", 123.45, etc.
 */
function toDecimal(value) {
    if (value == null || value === "") return null;

    const cleaned = String(value).replace(/[^0-9.-]/g, "");
    if (!cleaned) return null;

    return new Prisma.Decimal(cleaned);
}

/**
 * Simple helper kept for flexibility: save a raw order if you ever
 * call this directly from somewhere else.
 *
 * WARNING: This function assumes order.items are ALREADY NORMALIZED.
 * If calling this directly, ensure items have been processed through
 * normalizeItem() first to assign internalSku values.
 * 
 * Prefer using saveParsedOrder() which handles normalization automatically.
 * 
 * Not used by the gmailPoller path.
 */
export async function saveOrder(order) {
    return prisma.order.create({
        data: {
            ...order,
            items: order.items
                ? {
                    create: order.items,
                }
                : undefined,
        },
    });
}

/**
 * Optional helper: find an existing order by vendor + vendorOrderNumber
 * (not currently used by gmailPoller, but might be handy later)
 */
export async function findExistingOrder(vendorId, orderNumber) {
    return prisma.order.findFirst({
        where: { vendorId, vendorOrderNumber: orderNumber },
    });
}

/**
 * Main entry used by gmailPoller:
 *
 * saveParsedOrder({
 *   vendorId,
 *   gmailMessageId,
 *   gmailThreadId,
 *   parsedOrder,   // object produced by vendor parser (e.g. Glasswear)
 *   rawText,
 *   attachments,
 * })
 *
 * parsedOrder should look roughly like:
 * {
 *   orderNumber,
 *   customerId,
 *   orderDate,
 *   billTo,
 *   shipTo,
 *   subtotal,
 *   shipping,
 *   tax,
 *   total,
 *   currency,
 *   orderStatus,
 *   vendorMeta,
 *   items: [
 *     {
 *       lineNumber?,
 *       quantity,
 *       unitPrice,
 *       lineTotal,
 *       description,
 *       sku?,
 *       internalSku?,
 *       vendor_sku?,
 *       vendorSku?,
 *       vendorMeta?,
 *     },
 *     ...
 *   ]
 * }
 */
export async function saveParsedOrder({
    vendorId,
    gmailMessageId,
    gmailThreadId,
    parsedOrder,
    rawText,
    attachments = [],
}) {
    if (!vendorId) {
        throw new Error("saveParsedOrder requires vendorId");
    }
    if (!gmailMessageId) {
        throw new Error("saveParsedOrder requires gmailMessageId");
    }
    if (!parsedOrder) {
        throw new Error("saveParsedOrder requires parsedOrder object");
    }

    // Ensure we do not double insert the same email
    const existing = await prisma.order.findUnique({
        where: { gmailMessageId },
        include: { items: true },
    });

    if (existing) {
        console.log(
            `[ordersService] Order for gmailMessageId=${gmailMessageId} already exists as id=${existing.id} items=${existing.items.length}. Skipping create.`
        );
        return existing;
    }

    // Normalize orderDate once so we can reuse on Order and OrderItem rows
    const parsedOrderDate = parsedOrder.orderDate
        ? new Date(parsedOrder.orderDate)
        : null;

    // Extract orderStatus for top level Order row
    const status =
        parsedOrder.orderStatus || parsedOrder.order_status || null;

    // ========== ITEM NORMALIZATION ==========
    // All items are normalized here via itemNormalizer.normalizeItem()
    // Dummy SKUs (SPP-XXXXXX) are generated only here, ensuring stable internalSku
    // for the same (vendorId, vendorOrderNumber, description) combination.
    // =========================================

    const rawItems = parsedOrder.items || [];

    const items = await Promise.all(
        rawItems.map(async (item, idx) => {
            const normalized = await normalizeItem(item, vendorId);

            const quantity =
                normalized.quantity != null
                    ? Number(normalized.quantity)
                    : null;

            return {
                lineNumber: normalized.lineNumber ?? idx + 1,
                description: normalized.description ?? "",
                quantity,
                unitPrice: toDecimal(normalized.unitPrice),
                lineTotal: toDecimal(normalized.lineTotal),

                // Existing sku fields
                sku: normalized.sku ?? null,
                internalSku: normalized.internalSku ?? null,
                vendorMeta: normalized.vendorMeta ?? null,

                // New vendor level and duplicated order metadata
                vendor_sku: normalized.vendor_sku ?? normalized.vendorSku ?? null,
                vendorId,
                vendorOrderNumber: parsedOrder.orderNumber ?? null,
                orderDate: parsedOrderDate,
            };
        })
    );

    // Build main order payload
    const data = {
        vendorId,
        vendorOrderNumber: parsedOrder.orderNumber ?? null,
        customerId: parsedOrder.customerId ?? null,
        gmailMessageId,
        gmailThreadId: gmailThreadId ?? null,

        orderDate: parsedOrderDate,
        orderStatus: status,

        billTo: parsedOrder.billTo ?? null,
        shipTo: parsedOrder.shipTo ?? null,

        subtotal: toDecimal(parsedOrder.subtotal),
        shipping: toDecimal(parsedOrder.shipping),
        tax: toDecimal(parsedOrder.tax),
        total: toDecimal(parsedOrder.total),
        currency: parsedOrder.currency ?? "USD",

        rawText: rawText ?? null,
        parsedJson: parsedOrder ?? null,
        attachments: attachments ?? [],
        primaryPdfFilename:
            attachments.find(a => a.mimeType === "application/pdf")
                ?.filename ?? null,
        vendorMeta: parsedOrder.vendorMeta ?? null,

        // Nested create of normalized OrderItem rows
        items: {
            create: items,
        },
    };

    const created = await prisma.order.create({
        data,
        include: { items: true },
    });

    console.log(
        `[ordersService] Created order id=${created.id} ` +
        `vendorId=${created.vendorId} vendorOrderNumber=${created.vendorOrderNumber} items=${created.items.length}`
    );

    return created;
}

/**
 * Convenience readers for later intranet UI
 */
export async function getOrderById(id) {
    return prisma.order.findUnique({
        where: { id },
        include: { items: true },
    });
}

export async function listOrdersByVendor(vendorId, limit = 50) {
    return prisma.order.findMany({
        where: { vendorId },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { items: true },
    });
}

// Export prisma in case you want to reuse the client elsewhere
export { prisma };
