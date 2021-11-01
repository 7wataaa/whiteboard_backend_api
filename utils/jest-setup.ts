import dotenv from 'dotenv';
import request from 'supertest';
import { app } from '../app';
import { prisma } from '../prismaClient';

dotenv.config();

afterEach(async () => {
  jest.restoreAllMocks();
  jest.useRealTimers();

  await prisma.post.deleteMany();
  await prisma.room.deleteMany();
  await prisma.token.deleteMany();
  await prisma.user.deleteMany();
});

export const tokenRegExp = /^[\-\~\+\/\w]{48}$/;
export const iso8601RegExp = /Z|[+-](0\d|1[012])(:?[012345]\d)?/;
export const invitePasswordRegExp = /^[A-Za-z0-9_-]{32}$/;
export const uuidRegExp =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const registerRequest = async (email: string, password: string) => {
  return await request(app)
    .post('/api/v0/auth/register')
    .send({ email: email, password: password })
    .expect(200);
};

export const createRoomRequest = async (
  roomName: string,
  loginToken: string
) => {
  return await request(app)
    .post('/api/v0/rooms/create')
    .auth(loginToken, { type: 'bearer' })
    .send({
      name: roomName,
    })
    .expect(200);
};
