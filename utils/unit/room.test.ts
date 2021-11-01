import { Post } from '../../model/post';
import { Room } from '../../model/room';
import { User } from '../../model/user';
import { prisma } from '../../prismaClient';
import { invitePasswordRegExp } from '../jest-setup';

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
