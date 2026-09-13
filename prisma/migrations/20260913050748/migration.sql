/*
  Warnings:

  - You are about to drop the column `marchentInvoiceNumber` on the `payments` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[merchantInvoiceNumber]` on the table `payments` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `merchantInvoiceNumber` to the `payments` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "payments_marchentInvoiceNumber_key";

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "marchentInvoiceNumber",
ADD COLUMN     "merchantInvoiceNumber" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "payments_merchantInvoiceNumber_key" ON "payments"("merchantInvoiceNumber");
