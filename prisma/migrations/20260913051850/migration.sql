/*
  Warnings:

  - You are about to drop the column `merchantInvoiceNumber` on the `payments` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[marchentInvoiceNumber]` on the table `payments` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `marchentInvoiceNumber` to the `payments` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "payments_merchantInvoiceNumber_key";

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "merchantInvoiceNumber",
ADD COLUMN     "marchentInvoiceNumber" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "payments_marchentInvoiceNumber_key" ON "payments"("marchentInvoiceNumber");
