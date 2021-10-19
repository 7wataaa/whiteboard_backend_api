/*
  Warnings:

  - The primary key for the `token` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `isValid` on the `token` table. All the data in the column will be lost.
  - The required column `id` was added to the `token` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "token" DROP CONSTRAINT "token_pkey",
DROP COLUMN "isValid",
ADD COLUMN     "id" UUID NOT NULL,
ADD CONSTRAINT "token_pkey" PRIMARY KEY ("id");
