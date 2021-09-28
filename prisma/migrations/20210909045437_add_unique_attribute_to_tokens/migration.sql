/*
  Warnings:

  - A unique constraint covering the columns `[login_token]` on the table `user` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[refresh_token]` on the table `user` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "user.login_token_unique" ON "user"("login_token");

-- CreateIndex
CREATE UNIQUE INDEX "user.refresh_token_unique" ON "user"("refresh_token");
