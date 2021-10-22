import * as bcrypt from 'bcrypt';
import crypto from 'crypto';
import dotenv from 'dotenv';
import request from 'supertest';
import { app } from '../app';
import { Post } from '../model/post';
import { Room } from '../model/room';
import { User } from '../model/user';
import { prisma } from '../prismaClient';
dotenv.config();

const tokenRegExp = /^[\-\~\+\/\w]{48}$/;
const iso8601RegExp = /Z|[+-](0\d|1[012])(:?[012345]\d)?/;
const invitePasswordRegExp = /^[A-Za-z0-9_-]{32}$/;

afterEach(async () => {
  jest.restoreAllMocks();
  jest.useRealTimers();

  await prisma.post.deleteMany();
  await prisma.room.deleteMany();
  await prisma.token.deleteMany();
  await prisma.user.deleteMany();
});

/* 処理等のテスト */

describe('/model/user.ts', () => {
  test('email, passでトークンが適切に生成されるか', async () => {
    const createTestEmail = 'createtest@example.com';
    const createTestPassword = 'password';

    const user = await User.createUserByEmailAndPassword(
      createTestEmail,
      createTestPassword,
      ''
    );

    expect(user.validToken.loginToken).toMatch(tokenRegExp);
    expect(user.validToken.refreshToken).toMatch(tokenRegExp);
  });

  test('ログイントークンがかぶった場合に再生成されるか', async () => {
    const loginTokenDuplicationTestEmail =
      'logintokenduplicationtest@example.com';
    const loginTokenDuplicationTestPass = 'password';

    const loginTokenDuplicationTestToken =
      'zTrGJKGJTSMB5NpeA7Xi5AGphKPHwyKNYzSEwxjRNhMhKyps';

    // 次回と次々回に同じ文字列を出力する
    const randomBytesSpy = jest.spyOn(crypto, 'randomBytes');
    randomBytesSpy.mockImplementationOnce(() => loginTokenDuplicationTestToken);
    randomBytesSpy.mockImplementationOnce(() => loginTokenDuplicationTestToken);

    const existUser = await User.createUserByEmailAndPassword(
      'logintokenduplicationtestexistuser@example.com',
      'password',
      'kaburu-user'
    );

    const testUser = await User.createUserByEmailAndPassword(
      loginTokenDuplicationTestEmail,
      loginTokenDuplicationTestPass,
      'testuser'
    );

    expect(testUser.validToken.loginToken).toMatch(tokenRegExp);
    expect(testUser.validToken.loginToken).not.toBe(
      loginTokenDuplicationTestToken
    );
  });

  test('ログイントークンが無効なトークンと重複したときに同じトークンになるか', async () => {
    const email = 'logintokenduplicationbutusefultest1@example.com';

    const oldDuplicationToken =
      'OLDGJKGJTSMB5NpeA7Xi5AGphKPHwyKNYzSEwxjRNhMhKyps';

    const oldUser = await prisma.user.create({
      data: {
        email: email,
        hashedPassword: '',
        username: '',
        tokens: {
          create: {
            loginToken: oldDuplicationToken,
            refreshToken: '',
            createdAt: new Date(1980, 12, 31),
          },
        },
      },
    });

    // 次回に同じ文字列を出力する
    const randomBytesSpy = jest.spyOn(crypto, 'randomBytes');
    randomBytesSpy.mockImplementationOnce(() => oldDuplicationToken);

    const user = await User.createUserByEmailAndPassword(
      'logintokenduplicationbutusefultest2@example.com',
      'password',
      ''
    );

    expect(user.validToken.loginToken).toBe(oldDuplicationToken);
  });

  test('リフレッシュトークンがかぶった場合に再生成されるか', async () => {
    const refreshTokenDuplicationTestEmail =
      'refreshduplicationtest@example.com';
    const refreshTokenDuplicationTestPass = 'password';

    const refreshTokenDuplicationTestToken =
      'zTrGJKGJTSMB5NpeA7Xi5AGphKPHwyKNYzSEwxjRNhMhKyps';

    // 次回と次々回に同じ文字列を出力する
    const randomBytesSpy = jest.spyOn(crypto, 'randomBytes');
    randomBytesSpy.mockImplementationOnce(
      () => refreshTokenDuplicationTestToken
    );
    randomBytesSpy.mockImplementationOnce(
      () => refreshTokenDuplicationTestToken
    );

    const existUser = await User.createUserByEmailAndPassword(
      'logintokenduplicationtestexistuser@example.com',
      'password',
      'kaburu-user'
    );

    const testUser = await User.createUserByEmailAndPassword(
      refreshTokenDuplicationTestEmail,
      refreshTokenDuplicationTestPass,
      'testuser'
    );

    expect(testUser.validToken.refreshToken).toMatch(tokenRegExp);
    expect(testUser.validToken.refreshToken).not.toBe(
      refreshTokenDuplicationTestToken
    );
  });

  test('リフレッシュトークンが無効なトークンと重複したときに同じトークンになるか', async () => {
    const email = 'refreshtokenduplicationbutusefultest1@example.com';

    const oldDuplicationToken =
      'OLDREFRESHMB5NpeA7Xi5AGphKPHwyKNYzSEwxjRNhMhKyps';

    const oldUser = await prisma.user.create({
      data: {
        email: email,
        hashedPassword: '',
        username: '',
        tokens: {
          create: {
            loginToken: '',
            refreshToken: oldDuplicationToken,
            createdAt: new Date(1980, 12, 31),
          },
        },
      },
    });

    // リフレッシュトークンはログイントークンのあとに発行されるので、2回目に同じ文字列が出力されればいい
    const randomBytesSpy = jest.spyOn(crypto, 'randomBytes');
    randomBytesSpy.mockImplementationOnce(() => oldDuplicationToken);
    randomBytesSpy.mockImplementationOnce(() => oldDuplicationToken);

    const user = await User.createUserByEmailAndPassword(
      'logintokenduplicationbutusefultest2@example.com',
      'password',
      ''
    );

    expect(user.validToken.refreshToken).toBe(oldDuplicationToken);
  });

  test('トークンから正しくユーザーデータを取得できるか', async () => {
    const findByTokenTestEmail = 'findbytokentest@example.com';
    const findByTokenTestPass = 'password';

    const user = await User.createUserByEmailAndPassword(
      findByTokenTestEmail,
      findByTokenTestPass,
      ''
    );

    const findResult = await User.findUserByLoginToken(
      user.validToken.loginToken
    );

    expect(findResult).toStrictEqual(user);
  });

  test('ログイントークンに合致するユーザーがいなかったときのテスト', async () => {
    const loginTokenNotMatchTestToken =
      'zTrGJKGJTSMB5NpeA7Xi5AGphKPHwyKNYzSEwxjRNhMhKypa';

    const findResult = await User.findUserByLoginToken(
      loginTokenNotMatchTestToken
    );

    expect(findResult).toBe(null);
  });

  test('リフレッシュ時に正しくトークンが置き換わるか', async () => {
    const regenerateTestEmail = 'regeneratetest@example.com';
    const regenerateTestPass = 'password';

    const beforeRegenerateLoginToken =
      'BLrGJKGJTSMB5NpeA7Xi5AGphKPHwyKNYzSEwxjRNhMhoyps';
    const beforeRegenerateRefreshToken =
      'BRrGJKGJTSMB5NpeA7Xi5AGphKPHwyKNYzSEwxjRNhppKyps';

    const user = await prisma.user.create({
      data: {
        email: regenerateTestEmail,
        hashedPassword: bcrypt.hashSync(regenerateTestPass, 10),
        username: '',
        tokens: {
          create: {
            loginToken: beforeRegenerateLoginToken,
            refreshToken: beforeRegenerateRefreshToken,
          },
        },
      },
      include: {
        rooms: true,
        tokens: true,
      },
    });

    const regeneratedUser = await User.regenerateUsersToken(
      user.tokens[0].refreshToken
    );

    expect(regeneratedUser.id).toEqual(user.id);

    expect(regeneratedUser.validToken.loginToken).toMatch(tokenRegExp);
    expect(regeneratedUser.validToken.refreshToken).toMatch(tokenRegExp);

    expect(regeneratedUser.validToken.loginToken).not.toBe(
      beforeRegenerateLoginToken
    );

    expect(regeneratedUser.validToken.refreshToken).not.toBe(
      beforeRegenerateRefreshToken
    );
  });

  test('リフレッシュ後のトークンがリフレッシュ前と同じものになってしまわないかのテスト', async () => {
    const refreshTokenSameAsBeforeTestEmail =
      'refreshtokensameasbeforetest@example.com';

    const existRefreshToken =
      'EXISTREFRESH5NpeA7Xi5AGphKPHwyKNYzSEwxjRNhMhKyps';
    const existLoginToken = 'EXISTLOGINMB5NpeA7Xi5AGphKPHwyKNYzSEwxjRNhMhKyps';

    const user = await prisma.user.create({
      data: {
        email: refreshTokenSameAsBeforeTestEmail,
        hashedPassword: '',
        username: '',
        tokens: {
          create: {
            loginToken: existLoginToken,
            refreshToken: existRefreshToken,
          },
        },
      },
      include: {
        tokens: true,
      },
    });

    const randomBytesSpy = jest.spyOn(crypto, 'randomBytes');
    randomBytesSpy.mockImplementationOnce(() => existLoginToken);
    randomBytesSpy.mockImplementationOnce(() => existRefreshToken);

    const newUser = await User.regenerateUsersToken(
      user.tokens[0].refreshToken
    );

    expect(newUser.validToken.loginToken).toMatch(tokenRegExp);
    expect(newUser.validToken.refreshToken).toMatch(tokenRegExp);

    expect(newUser.validToken.loginToken).not.toBe(existLoginToken);
    expect(newUser.validToken.refreshToken).not.toBe(existRefreshToken);
  });

  // TODO 期限切れ時のテストの実装
});

describe('/model/room.ts', () => {
  test('部屋が作成できるかのテスト', async () => {
    const roomName = 'createTestRoom';

    const roomCreateTestEmail = 'roomcreatetest@example.com';
    const roomCreateTestPass = 'password';

    const createUser = await User.createUserByEmailAndPassword(
      roomCreateTestEmail,
      roomCreateTestPass,
      ''
    );

    const room = await Room.create(roomName, createUser);

    expect(await prisma.room.findUnique({ where: { id: room.id } })).not.toBe(
      null
    );
  });

  test('招待URLが生成できているかのテスト', async () => {
    const roomName = 'inviteURLgenerateTestRoom';

    const inviteURLgenerateTestEmail = 'inviteurlgeneratetest@example.com';
    const inviteURLgenerateTestPass = 'password';

    const user = await User.createUserByEmailAndPassword(
      inviteURLgenerateTestEmail,
      inviteURLgenerateTestPass,
      ''
    );

    const room = await Room.create(roomName, user);

    expect(room.invitePassword).toMatch(invitePasswordRegExp);
  });

  test('招待パスワードから入室できるか', async () => {
    const roomName = 'enterroomtestroom';

    const enterRoomTestEmail = 'enterroomtest1@example.com';
    const enterRoomTestPass = 'password';

    const user = await User.createUserByEmailAndPassword(
      enterRoomTestEmail,
      enterRoomTestPass,
      ''
    );

    const joinUser = await User.createUserByEmailAndPassword(
      'enterroomtest2@example.com',
      'password',
      ''
    );

    const room = await Room.create(roomName, user);

    const joinResult = await Room.joinRoom(
      joinUser.id,
      room.id,
      room.invitePassword
    );

    expect(joinResult.joinedUsers.map((e) => e.id)).toEqual([
      user.id,
      joinUser.id,
    ]);

    expect(
      (
        await prisma.user.findUnique({
          where: {
            id: joinUser.id,
          },
          include: {
            rooms: true,
          },
        })
      ).rooms.map((e) => e.name)
    ).toEqual([roomName]);
  });

  test('退室できるか', async () => {
    const user1 = await User.createUserByEmailAndPassword(
      'exittest1@example.com',
      'password',
      ''
    );

    const room = await Room.create('exittestroom', user1);

    const user2 = await User.createUserByEmailAndPassword(
      'exittest2@example.com',
      'password',
      ''
    );

    const joinRoom = await Room.joinRoom(
      user2.id,
      room.id,
      room.invitePassword
    );

    await joinRoom.exit(user2);

    expect(
      (
        await prisma.room.findUnique({
          where: {
            id: room.id,
          },
          include: {
            joinedUsers: {
              select: {
                id: true,
              },
            },
          },
        })
      ).joinedUsers
    ).toStrictEqual([{ id: user1.id }]);

    expect(
      (
        await prisma.user.findUnique({
          where: {
            id: user2.id,
          },
          include: {
            rooms: true,
          },
        })
      ).rooms
    ).toStrictEqual([]);
  });

  test('新規投稿ができるか', async () => {
    const user = await User.createUserByEmailAndPassword(
      'posttest@example.com',
      'password',
      ''
    );

    const room = await Room.create('posttestroom', user);

    const text = 'foobarbuzz';

    const newPostId1 = await room.createNewPost(
      new Post({ text: text, author: user })
    );

    const newPostId2 = await room.createNewPost(
      new Post({ text: text + text, author: user })
    );

    expect(newPostId1).not.toBe(null);

    expect(newPostId2).not.toBe(null);

    expect(
      (
        await prisma.room.findUnique({
          where: {
            id: room.id,
          },
          include: {
            posts: {
              select: {
                id: true,
                text: true,
              },
            },
          },
        })
      ).posts
    ).toStrictEqual([
      {
        id: newPostId1,
        text: text,
      },
      {
        id: newPostId2,
        text: text + text,
      },
    ]);
  });
});

/* URL叩くテスト */

describe('/', () => {
  test('ルートパスをgetしたときのテスト', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(404);
    expect(response.text).toBe('Not Found');
  });
});

describe('/api/v0/ping', () => {
  test('getしたときのテスト', async () => {
    const response = await request(app).get('/api/v0/ping');
    expect(response.status).toBe(200);
  });
});

describe('/api/v0/auth/register', () => {
  test('正しくトークンとリフレッシュトークンが返されるか', async () => {
    const postTestEmail = 'usercreatetest@example.com';
    const postTestPassword = 'password';

    const response = await request(app)
      .post('/api/v0/auth/register')
      .send({
        email: postTestEmail,
        password: postTestPassword,
      })
      .expect(200);

    expect(response.type).toBe('application/json');

    expect(response.body['loginToken']).toMatch(tokenRegExp);
    expect(response.body['refreshToken']).toMatch(tokenRegExp);
    expect(response.body['createdAt']).toMatch(iso8601RegExp);
  });

  test('不正なメアドだったときにエラーが返されるか', async () => {
    const invalidEmailTestEmail = '';
    const invalidEmailTestPassword = 'password';

    const response = await request(app).post('/api/v0/auth/register').send({
      email: invalidEmailTestEmail,
      password: invalidEmailTestPassword,
    });

    expect(response.status).toBe(400);
  });

  test('不正なパスワードだったときにエラーが返されるか', async () => {
    const invalidPasswordTestEmail = '';
    const invalidPasswordTestPassword = 'password';

    const response = await request(app).post('/api/v0/auth/register').send({
      email: invalidPasswordTestEmail,
      password: invalidPasswordTestPassword,
    });

    expect(response.status).toBe(400);
  });

  test('すでにユーザーが登録されていたときにエラーが返されるか', async () => {
    const aleadyExistsTestEmail = 'aleadyexiststest@example.com';
    const aleadyExistsTestPassword = 'password';

    await prisma.user.create({
      data: {
        username: 'testuser',
        email: aleadyExistsTestEmail,
        hashedPassword: bcrypt.hashSync(aleadyExistsTestPassword, 10),
      },
    });

    const response = await request(app)
      .post('/api/v0/auth/register')
      .send({
        email: aleadyExistsTestEmail,
        password: aleadyExistsTestPassword,
      })
      .expect(409);
  });

  test('ユーザーを作成できなかったときにエラーを返されるか', async () => {
    const canNotCreateTestEmail = 'cannotcreatetest@example.com';
    const canNotCreateTestPassword = 'password';

    const createUserByEmailAndPassword = jest.spyOn(
      User,
      'createUserByEmailAndPassword'
    );

    createUserByEmailAndPassword.mockImplementationOnce(null);

    const response = await request(app)
      .post('/api/v0/auth/register')
      .send({
        email: canNotCreateTestEmail,
        password: canNotCreateTestPassword,
      })
      .expect(500);
  });
});

describe('/api/v0/auth/refresh', () => {
  test('正しく新規アクセストークンを返すか', async () => {
    const apiRefreshTestEmail = 'apirefreshtest@example.com';
    const apiRefreshTestPass = 'password';

    const user = await User.createUserByEmailAndPassword(
      apiRefreshTestEmail,
      apiRefreshTestPass,
      ''
    );

    const response = await request(app)
      .post('/api/v0/auth/refresh')
      .auth(user.validToken.refreshToken, { type: 'bearer' })
      .expect(200);

    expect(response.body).toEqual({
      createdAt: expect.stringMatching(iso8601RegExp),
      loginToken: expect.not.stringContaining(user.validToken.loginToken),
      refreshToken: expect.not.stringContaining(user.validToken.refreshToken),
    });

    expect(
      (
        await prisma.token.findMany({
          where: {
            userId: user.id,
          },
        })
      ).length
    ).toBe(2);
  });

  test('文字数が正しくないトークンでpostされたときのテスト', async () => {
    const unkownToken = 'qwertqwertqwertqwertqwertqwertqwertqwertqwert';

    const response = await request(app)
      .post('/api/v0/auth/refresh')
      .auth(unkownToken, { type: 'bearer' })
      .expect(401);
  });

  test('トークン無しでpostされたときのテスト', async () => {
    const response = await request(app)
      .post('/api/v0/auth/refresh')
      .expect(401);
  });
});

describe('/api/v0/users/me', () => {
  test('getしたときのテスト', async () => {
    const profileTestEmail = 'profiletest@example.com';
    const profileTestPass = 'password';

    const user = await User.createUserByEmailAndPassword(
      profileTestEmail,
      profileTestPass,
      'profiletest'
    );

    const response = request(app)
      .get('/api/v0/users/me')
      .auth(user.validToken.loginToken, { type: 'bearer' });

    expect((await response).status).toBe(200);

    expect((await response).body).toEqual({
      id: user.id,
      username: 'profiletest',
      email: profileTestEmail,
    });
  });

  test('トークンなしでgetしたときのテスト', async () => {
    const response = await request(app).get('/api/v0/users/me');

    expect(response.status).toBe(401);
  });

  test('有効期限切れのトークンでgetしたときのテスト', async () => {
    const tokenExpirationTestEmail = 'tokenexpirationtest@example.com';
    const tokenExpirationTestPass = 'password';

    const user = await User.createUserByEmailAndPassword(
      tokenExpirationTestEmail,
      tokenExpirationTestPass,
      ''
    );

    const after1hourDate = new Date(
      new Date().setHours(new Date().getHours() + 1)
    );

    jest.useFakeTimers('modern');
    jest.setSystemTime(after1hourDate);

    const response = await request(app)
      .get('/api/v0/users/me')
      .auth(user.validToken.loginToken, { type: 'bearer' })
      .expect(401);
  });
});

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
/* describe('/api/v0/rooms/:id/posts', () => {
  test('');
});

describe('/api/v0/rooms/:id/posts/:id', () => {
  test('');
});
*/
