/*
  Warnings:

  - You are about to drop the column `login_token` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `login_token_expiration_at` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `refresh_token` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `refresh_token_expiration_at` on the `user` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "user_login_token_key";

-- DropIndex
DROP INDEX "user_refresh_token_key";

-- AlterTable
ALTER TABLE "user" DROP COLUMN "login_token",
DROP COLUMN "login_token_expiration_at",
DROP COLUMN "refresh_token",
DROP COLUMN "refresh_token_expiration_at";

-- CreateTable
CREATE TABLE "token" (
    "user_id" UUID NOT NULL,
    "login_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "isValid" BOOLEAN NOT NULL DEFAULT true
);

-- CreateIndex
CREATE UNIQUE INDEX "token_login_token_key" ON "token"("login_token");

-- CreateIndex
CREATE UNIQUE INDEX "token_refresh_token_key" ON "token"("refresh_token");

-- AddForeignKey
ALTER TABLE "token" ADD CONSTRAINT "token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
