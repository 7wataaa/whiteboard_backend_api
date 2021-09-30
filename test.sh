#!/bin/sh

env DATABASE_URL="postgresql://postgres:postgres@db:5432/test" npx prisma migrate reset --force && env DATABASE_URL="postgresql://postgres:postgres@db:5432/test" npx jest --forceExit --detectOpenHandles
