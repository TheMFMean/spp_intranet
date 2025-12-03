-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "vendorOrderNumber" TEXT,
    "customerId" TEXT,
    "gmailMessageId" TEXT NOT NULL,
    "gmailThreadId" TEXT,
    "orderDate" TIMESTAMP(3),
    "billTo" TEXT,
    "shipTo" TEXT,
    "subtotal" DECIMAL(10,2),
    "shipping" DECIMAL(10,2),
    "tax" DECIMAL(10,2),
    "total" DECIMAL(10,2),
    "currency" TEXT DEFAULT 'USD',
    "rawText" TEXT,
    "parsedJson" JSONB,
    "attachments" JSONB,
    "primaryPdfFilename" TEXT,
    "vendorMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "lineNumber" INTEGER,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2),
    "lineTotal" DECIMAL(10,2),
    "sku" TEXT,
    "internalSku" TEXT,
    "vendorMeta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_gmailMessageId_key" ON "Order"("gmailMessageId");

-- CreateIndex
CREATE INDEX "Order_vendorId_vendorOrderNumber_idx" ON "Order"("vendorId", "vendorOrderNumber");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
