import * as bcrypt from 'bcrypt';
import crypto from 'crypto';
import dotenv from 'dotenv';
import request from 'supertest';
import { app } from '../app';
import { Post } from '../model/post';
import { Room, RoomNotFoundError } from '../model/room';
import { User } from '../model/user';
import { prisma } from '../prismaClient';
dotenv.config();

const tokenRegExp = /^[\-\~\+\/\w]{48}$/;
const iso8601RegExp = /Z|[+-](0\d|1[012])(:?[012345]\d)?/;
const invitePasswordRegExp = /^[A-Za-z0-9_-]{32}$/;
const uuidRegExp =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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

  test('投稿の一覧が取得できるか', async () => {
    const user1 = await User.createUserByEmailAndPassword(
      'getallpoststest1@example.com',
      'password',
      ''
    );
    const user2 = await User.createUserByEmailAndPassword(
      'getallpoststest2@example.com',
      'password',
      ''
    );

    const room = await Room.create('getallpoststestroom', user1);

    await Room.joinRoom(user2.id, room.id, room.invitePassword);

    const postId1 = await room.createNewPost(
      new Post({
        text: 'post1',
        author: user1,
      })
    );

    const postId2 = await room.createNewPost(
      new Post({
        text: 'post2',
        author: user2,
      })
    );

    const postId3 = await room.createNewPost(
      new Post({
        text: 'post3',
        author: user2,
      })
    );

    const allPosts = await room.fetchAllPosts();

    expect(
      allPosts.map((e) => ({ id: e.id, authorId: e.authorId, text: e.text }))
    ).toStrictEqual([
      {
        id: postId1,
        authorId: user1.id,
        text: 'post1',
      },
      {
        id: postId2,
        authorId: user2.id,
        text: 'post2',
      },
      {
        id: postId3,
        authorId: user2.id,
        text: 'post3',
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

const registerRequest = async (email: string, password: string) => {
  return await request(app)
    .post('/api/v0/auth/register')
    .send({ email: email, password: password })
    .expect(200);
};

const createRoomRequest = async (roomName: string, loginToken: string) => {
  return await request(app)
    .post('/api/v0/rooms/create')
    .auth(loginToken, { type: 'bearer' })
    .send({
      name: roomName,
    })
    .expect(200);
};

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

describe('/api/v0/rooms/:id/posts', () => {
  test('get: 投稿一覧の取得ができるか', async () => {
    const postGetTestEmail = 'posttest@example.com';
    const postGetTestPass = 'password';

    const registerRes = await request(app)
      .post('/api/v0/auth/register')
      .send({ email: postGetTestEmail, password: postGetTestPass })
      .expect(200);

    const loginToken = registerRes.body['loginToken'] as string;

    const roomCreateRes = await request(app)
      .post('/api/v0/rooms/create')
      .auth(loginToken, { type: 'bearer' })
      .send({
        name: 'posttestroom',
      })
      .expect(200);

    const roomId = roomCreateRes.body['roomId'] as string;

    // 複数のポストがある状態を作る
    const postRes1 = await request(app)
      .post(`/api/v0/rooms/${roomId}/posts`)
      .auth(loginToken, { type: 'bearer' })
      .send({
        text: 'テスト用ポスト1',
      })
      .expect(200);

    const postRes2 = await request(app)
      .post(`/api/v0/rooms/${roomId}/posts`)
      .auth(loginToken, { type: 'bearer' })
      .send({
        text: 'テスト用ポスト2',
      })
      .expect(200);

    const response = await request(app)
      .get(`/api/v0/rooms/${roomId}/posts`)
      .auth(loginToken, { type: 'bearer' });

    expect(response.body['posts'].length).toBe(2);

    expect(response.body['posts']).toStrictEqual([
      {
        authorId: (
          await User.findUserByLoginToken(registerRes.body['loginToken'])
        ).id,
        createdAt: expect.stringMatching(iso8601RegExp),
        updateAt: expect.stringMatching(iso8601RegExp),
        deletedAt: null,
        id: postRes1.body['id'],
        roomId: roomId,
        text: 'テスト用ポスト1',
      },
      {
        authorId: (
          await User.findUserByLoginToken(registerRes.body['loginToken'])
        ).id,
        createdAt: expect.stringMatching(iso8601RegExp),
        updateAt: expect.stringMatching(iso8601RegExp),
        deletedAt: null,
        id: postRes2.body['id'],
        roomId: roomId,
        text: 'テスト用ポスト2',
      },
    ]);
  });

  test('get: roomIdの長さが違ったときのテスト', async () => {
    const registerRes = await registerRequest(
      'getroomidlengthincorrecttest@example.com',
      'password'
    );

    const createRoomRes = await createRoomRequest(
      'room',
      registerRes.body['loginToken']
    );

    const incorrectRoomId = (createRoomRes.body['roomId'] as string).slice(
      0,
      35
    );

    console.log(createRoomRes.body['roomId'] as string);
    console.log(incorrectRoomId);

    const response = await request(app)
      .get(`/api/v0/rooms/${incorrectRoomId}/posts`)
      .auth(registerRes.body['loginToken'], { type: 'bearer' })
      .expect(400);
  });

  test('get: 0123456789abcdefABCDEF-以外の文字をパスに入れられたときのテスト', async () => {
    const registerRes = await registerRequest(
      'getroomidlengthincorrecttest@example.com',
      'password'
    );

    const response = await request(app)
      .get(`/api/v0/rooms/GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG/posts`)
      .auth(registerRes.body['loginToken'], { type: 'bearer' })
      .expect(400);
  });

  test('get: 存在しない部屋の投稿を取得しようとしたときのテスト', async () => {
    const registerRes = await registerRequest(
      'differentroomtest@example.com',
      'pass'
    );

    const createRoomRes = await createRoomRequest(
      'room',
      registerRes.body['loginToken']
    );

    const roomId = createRoomRes.body['roomId'] as string;

    const nthReplace = (str: string, n: number, after: string) => {
      return str.substr(0, n - 1) + after + str.substr(n);
    };

    const differentRoomId = roomId.startsWith('a')
      ? nthReplace(roomId, 0, 'b')
      : nthReplace(roomId, 0, 'a');

    const response = await request(app)
      .get(`/api/v0/rooms/${differentRoomId}/posts`)
      .auth(registerRes.body['loginToken'], { type: 'bearer' })
      .expect(400);
  });

  test('post: 新規投稿のテスト', async () => {
    const postTestEmail = 'posttest@example.com';
    const postTestPass = 'password';

    const registerRes = await request(app)
      .post('/api/v0/auth/register')
      .send({ email: postTestEmail, password: postTestPass })
      .expect(200);

    const loginToken = registerRes.body['loginToken'] as string;

    const roomCreateRes = await request(app)
      .post('/api/v0/rooms/create')
      .auth(loginToken, { type: 'bearer' })
      .send({
        name: 'posttestroom',
      })
      .expect(200);

    const roomId = roomCreateRes.body['roomId'] as string;

    const response = await request(app)
      .post(`/api/v0/rooms/${roomId}/posts`)
      .auth(loginToken, { type: 'bearer' })
      .send({
        text: '新規投稿のテスト',
      })
      .expect(200);

    const postId = response.body['id'];

    expect(postId).toMatch(uuidRegExp);

    const testPost = await prisma.post.findUnique({
      where: {
        id: postId,
      },
      include: {
        room: true,
      },
    });

    expect(testPost.text).toBe('新規投稿のテスト');

    expect(testPost.authorId).toBe(
      (await User.findUserByLoginToken(loginToken)).id
    );

    const roomFromPost = await prisma.room.findUnique({
      where: {
        id: testPost.roomId,
      },
      select: {
        id: true,
      },
    });

    expect(roomFromPost.id).toBe(roomId);
  });

  test('post: roomIdの長さが違ったときのテスト', async () => {
    const roomIdlengthTestEmail = 'posttest@example.com';
    const roomIdlengthTestPass = 'password';

    const registerRes = await request(app)
      .post('/api/v0/auth/register')
      .send({ email: roomIdlengthTestEmail, password: roomIdlengthTestPass })
      .expect(200);

    const loginToken = registerRes.body['loginToken'] as string;

    const roomCreateRes = await request(app)
      .post('/api/v0/rooms/create')
      .auth(loginToken, { type: 'bearer' })
      .send({
        name: 'posttestroom',
      })
      .expect(200);

    const roomId = roomCreateRes.body['roomId'] as string;

    const response = await request(app)
      .post(`/api/v0/rooms/${roomId}0/posts`)
      .auth(loginToken, { type: 'bearer' })
      .send({
        text: 'roomIdが違うときのテスト',
      })
      .expect(400);
  });

  test('post: 不明な部屋を参照したときのエラー', async () => {
    const undefindRoomErrorTestEmail = 'undefindroomerrortestemail';
    const undefindRoomErrorTestPass = 'password';

    const registerRes = await registerRequest(
      undefindRoomErrorTestEmail,
      undefindRoomErrorTestPass
    );

    const createRoomRes = await createRoomRequest(
      'undefindRoomErrorTestRoom',
      registerRes.body['loginToken']
    );

    const findRoomByIdSpy = jest.spyOn(Room, 'findRoomById');

    findRoomByIdSpy.mockImplementationOnce(async (roomId: string) => {
      throw new RoomNotFoundError();
    });

    const response = await request(app)
      .post(`/api/v0/rooms/${createRoomRes.body['roomId']}/posts`)
      .auth(registerRes.body['loginToken'], { type: 'bearer' })
      .send({
        text: 'テスト用ポスト1',
      })
      .expect(400);
  });

  test('post: 存在しない部屋に投稿しようとしたときのテスト', async () => {
    const registerRes = await registerRequest(
      'differentroomtest@example.com',
      'pass'
    );

    const createRoomRes = await createRoomRequest(
      'room',
      registerRes.body['loginToken']
    );

    const roomId = createRoomRes.body['roomId'] as string;

    const nthReplace = (str: string, n: number, after: string) => {
      return str.substr(0, n - 1) + after + str.substr(n);
    };

    const differentRoomId = roomId.startsWith('a')
      ? nthReplace(roomId, 0, 'b')
      : nthReplace(roomId, 0, 'a');

    const response = await request(app)
      .post(`/api/v0/rooms/${differentRoomId}/posts`)
      .auth(registerRes.body['loginToken'], { type: 'bearer' })
      .send({
        text: 'テスト用ポスト1',
      })
      .expect(400);
  });

  test('post: 所属していない部屋に投稿しようとしたときのテスト', async () => {
    const registerRes1 = await registerRequest(
      'posttonotentered1@example.com',
      'password'
    );

    const registerRes2 = await registerRequest(
      'posttonotentered2@example.com',
      'password'
    );

    const createRoomRes1 = await createRoomRequest(
      'room1',
      registerRes1.body['loginToken']
    );

    // ユーザー1だけ所属している部屋にユーザー2が投稿しようとすると400が返されるか

    const response = await request(app)
      .post(`/api/v0/rooms/${createRoomRes1.body['roomId']}/posts`)
      .auth(registerRes2.body['loginToken'], { type: 'bearer' })
      .send({
        text: 'テスト用ポスト1',
      })
      .expect(400);
  });

  test('post: 投稿するテキストが空だったときのテスト', async () => {
    const registerRes = await registerRequest(
      'differentroomtest@example.com',
      'pass'
    );

    const createRoomRes = await createRoomRequest(
      'room',
      registerRes.body['loginToken']
    );

    const response = await request(app)
      .post(`/api/v0/rooms/${createRoomRes.body['roomId']}/posts`)
      .auth(registerRes.body['loginToken'], { type: 'bearer' })
      .send({
        text: '',
      })
      .expect(400);
  });
});

/*
describe('/api/v0/rooms/:id/posts/:id', () => {
  test('');
});
*/
