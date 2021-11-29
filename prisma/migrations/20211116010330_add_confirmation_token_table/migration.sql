-- AlterTable
ALTER TABLE "user" ADD COLUMN     "is_confirmed" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "confirmation_token" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "confirmation_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "confirmation_token_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "confirmation_token_user_id_key" ON "confirmation_token"("user_id");

-- AddForeignKey
ALTER TABLE "confirmation_token" ADD CONSTRAINT "confirmation_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
