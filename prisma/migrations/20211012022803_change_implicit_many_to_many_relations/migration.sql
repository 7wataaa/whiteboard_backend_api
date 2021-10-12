/*
  Warnings:

  - You are about to drop the `user_in_room` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "user_in_room" DROP CONSTRAINT "user_in_room_room_id_fkey";

-- DropForeignKey
ALTER TABLE "user_in_room" DROP CONSTRAINT "user_in_room_user_id_fkey";

-- DropTable
DROP TABLE "user_in_room";
