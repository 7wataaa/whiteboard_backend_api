-- DropForeignKey
ALTER TABLE "user_in_room" DROP CONSTRAINT "user_in_room_room_id_fkey";

-- DropForeignKey
ALTER TABLE "user_in_room" DROP CONSTRAINT "user_in_room_user_id_fkey";

-- AlterTable
ALTER TABLE "room" ALTER COLUMN "update_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AddForeignKey
ALTER TABLE "user_in_room" ADD CONSTRAINT "user_in_room_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_in_room" ADD CONSTRAINT "user_in_room_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "user.email_unique" RENAME TO "user_email_key";

-- RenameIndex
ALTER INDEX "user.login_token_unique" RENAME TO "user_login_token_key";

-- RenameIndex
ALTER INDEX "user.refresh_token_unique" RENAME TO "user_refresh_token_key";
