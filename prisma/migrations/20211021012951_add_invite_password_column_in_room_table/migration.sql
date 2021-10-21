/*
  Warnings:

  - Added the required column `invitePassword` to the `room` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "room" ADD COLUMN     "invitePassword" TEXT NOT NULL;
