/*
  Warnings:

  - You are about to drop the column `user_id` on the `confirmation_token` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[user_email]` on the table `confirmation_token` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `user_email` to the `confirmation_token` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "confirmation_token" DROP CONSTRAINT "confirmation_token_user_id_fkey";

-- DropIndex
DROP INDEX "confirmation_token_user_id_key";

-- AlterTable
ALTER TABLE "confirmation_token" DROP COLUMN "user_id",
ADD COLUMN     "user_email" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "confirmation_token_user_email_key" ON "confirmation_token"("user_email");

-- AddForeignKey
ALTER TABLE "confirmation_token" ADD CONSTRAINT "confirmation_token_user_email_fkey" FOREIGN KEY ("user_email") REFERENCES "user"("email") ON DELETE RESTRICT ON UPDATE CASCADE;
