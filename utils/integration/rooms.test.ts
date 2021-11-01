import request from 'supertest';
import { app } from '../../app';
import { User } from '../../model/user';
import { prisma } from '../../prismaClient';

describe('/api/v0/rooms', () => {
  test('postしたときのテスト', async () => {
    const roomsPostTestEmail = 'roomsposttest@example.com';
    const roomsPostTestPass = 'password';

    const user = await User.createUserByEmailAndPassword(
      roomsPostTestEmail,
      roomsPostTestPass,
      ''
    );

    const response = await request(app)
      .post('/api/v0/rooms/create')
      .auth(user.validToken.loginToken, { type: 'bearer' })
      .send({
        name: 'test-room',
      })
      .expect(200);

    expect(response.body).toEqual({
      name: expect.stringMatching(/\w{3,10}/),
      roomId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      ),
      createdAt: expect.stringMatching(/Z|[+-](0\d|1[012])(:?[012345]\d)?/),
    });

    expect(
      await prisma.room.findUnique({
        where: {
          id: response.body['roomId'],
        },
      })
    ).not.toBe(null);
  });

  test('room nameのバリデーションのテスト', async () => {
    const roomsPostValidationTestEmail = 'roomspostvalidationtest@example.com';
    const roomsPostValidationTestPass = 'password';

    const user = await User.createUserByEmailAndPassword(
      roomsPostValidationTestEmail,
      roomsPostValidationTestPass,
      ''
    );

    const response = await request(app)
      .post('/api/v0/rooms/create')
      .auth(user.validToken.loginToken, { type: 'bearer' })
      .send({
        name: '',
      })
      .expect(400);
  });

  test('作成したユーザーがその部屋に入っているか', async () => {
    const roomPostUserJoinedTestEmail = 'roompostuserjoinedtest@example.com';
    const roomPostUserJoinedTestPass = 'password';

    const user = await User.createUserByEmailAndPassword(
      roomPostUserJoinedTestEmail,
      roomPostUserJoinedTestPass,
      ''
    );

    const response = await request(app)
      .post('/api/v0/rooms/create')
      .auth(user.validToken.loginToken, { type: 'bearer' })
      .send({ name: 'roomuserjoinedtestroom' })
      .expect(200);

    const room = await prisma.room.findUnique({
      where: {
        id: response.body['roomId'],
      },
      include: {
        joinedUsers: true,
      },
    });

    expect(room.joinedUsers).toEqual([
      await prisma.user.findUnique({
        where: {
          email: roomPostUserJoinedTestEmail,
        },
      }),
    ]);
  });
});
