import request from 'supertest';
import { app } from '../../app';
import { Room, RoomNotFoundError } from '../../model/room';
import { User } from '../../model/user';
import { prisma } from '../../prismaClient';
import {
  createRoomRequest,
  iso8601RegExp,
  registerRequest,
  uuidRegExp,
} from '../jest-setup';

describe('/api/v0/rooms/:id/posts', () => {
  test('get: 投稿一覧の取得ができるか', async () => {
    const postGetTestEmail = 'posttest@example.com';
    const postGetTestPass = 'password';

    const registerRes = await registerRequest(
      postGetTestEmail,
      postGetTestPass
    );

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

  test('get: 部屋が見つからなかったときのテスト', async () => {
    const undefindRoomErrorTestEmail = 'undefindroomerrortestemail@example.com';
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
      .get(`/api/v0/rooms/${createRoomRes.body['roomId']}/posts`)
      .auth(registerRes.body['loginToken'], { type: 'bearer' })
      .expect(400);
  });

  test('get: 所属していない部屋の投稿を取得しようとしたときのテスト', async () => {
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
      .get(`/api/v0/rooms/${createRoomRes1.body['roomId']}/posts`)
      .auth(registerRes2.body['loginToken'], { type: 'bearer' })
      .expect(400);
  });

  test('post: 新規投稿のテスト', async () => {
    const postTestEmail = 'posttest@example.com';
    const postTestPass = 'password';

    const registerRes = await registerRequest(postTestEmail, postTestPass);

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

    const registerRes = await registerRequest(
      roomIdlengthTestEmail,
      roomIdlengthTestPass
    );

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
    const undefindRoomErrorTestEmail = 'undefindroomerrortest@example.com';
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
