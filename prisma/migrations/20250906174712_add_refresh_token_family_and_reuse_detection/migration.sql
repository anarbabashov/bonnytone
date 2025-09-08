/*
  Warnings:

  - Added the required column `tokenFamily` to the `RefreshToken` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."RefreshToken" ADD COLUMN     "reusedAt" TIMESTAMP(3),
ADD COLUMN     "tokenFamily" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "RefreshToken_tokenFamily_idx" ON "public"."RefreshToken"("tokenFamily");
