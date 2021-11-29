import dotenv from 'dotenv';
import request from 'supertest';
import { app } from '../app';
import { prisma } from '../prismaClient';

dotenv.config();

const _onesec = 1000;
jest.setTimeout(_onesec * 20);

// テスト実行毎にメールが送信されてしまうためモック化
jest.mock('../sgMailClient', () => {
  const sgMailClient = jest.requireActual('../sgMailClient');

  const sendgridMock = {
    ...sgMailClient.sendgrid,
    send: async ({ to: to }: { to: string }) => {
      console.log(`
===sendgrid mock===
${to}さんに本人確認メールを送信した (してない)`);
    },
  };

  return {
    ...sgMailClient,
    sendgrid: sendgridMock,
  };
});

afterEach(async () => {
  jest.restoreAllMocks();
  jest.useRealTimers();

  await prisma.post.deleteMany();
  await prisma.room.deleteMany();
  await prisma.token.deleteMany();
  await prisma.confirmationToken.deleteMany();
  await prisma.user.deleteMany();
});

export const tokenRegExp = /^[\-\~\+\/\w]{48}$/;
export const iso8601RegExp = /Z|[+-](0\d|1[012])(:?[012345]\d)?/;
export const invitePasswordRegExp = /^[A-Za-z0-9_-]{32}$/;
export const uuidRegExp =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const registerRequest = async (email: string, password: string) => {
  const registerRes = await request(app)
    .post('/api/v0/auth/register')
    .send({ email: email, password: password })
    .expect(200);

  // 本人確認のためのトークン
  const token = (
    await prisma.user.findUnique({
      where: {
        email: email,
      },
      include: {
        confirmationToken: true,
      },
    })
  )?.confirmationToken?.confirmationToken;

  expect(token).toBeDefined();

  // 本人確認を行うURL
  const redirectUrl = `/api/v0/auth/email-confirmation?email=${email}&token=${token}`;

  // 本人確認処理
  const confirmRes = await request(app).get(redirectUrl).expect(200);

  return registerRes;
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
