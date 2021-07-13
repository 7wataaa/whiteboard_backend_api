-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "password" TEXT NOT NULL,
    "username" TEXT NOT NULL,

    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_users" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "room_id" TEXT NOT NULL,

    PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "update_at" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("id")
);
