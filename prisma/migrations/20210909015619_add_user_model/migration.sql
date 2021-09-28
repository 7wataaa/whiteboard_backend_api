/*
  Warnings:

  - Added the required column `login_token` to the `user` table without a default value. This is not possible if the table is not empty.
  - Added the required column `login_token_expiration_at` to the `user` table without a default value. This is not possible if the table is not empty.
  - Added the required column `refresh_token` to the `user` table without a default value. This is not possible if the table is not empty.
  - Added the required column `refresh_token_expiration_at` to the `user` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "user" ADD COLUMN     "login_token" TEXT NOT NULL,
ADD COLUMN     "login_token_expiration_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "refresh_token" TEXT NOT NULL,
ADD COLUMN     "refresh_token_expiration_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
