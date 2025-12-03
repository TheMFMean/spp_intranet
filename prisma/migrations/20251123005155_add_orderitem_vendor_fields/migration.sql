-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "orderDate" TIMESTAMP(3),
ADD COLUMN     "vendorId" TEXT,
ADD COLUMN     "vendorOrderNumber" TEXT,
ADD COLUMN     "vendor_sku" TEXT;

-- CreateIndex
CREATE INDEX "OrderItem_vendorId_vendorOrderNumber_idx" ON "OrderItem"("vendorId", "vendorOrderNumber");
