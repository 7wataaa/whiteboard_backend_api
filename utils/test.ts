import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { app } from '../app';
import { createUser } from '../src/createUser';

const prisma = new PrismaClient();

describe('/', () => {
  test('getしたときのテスト', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'Hello World!' });
  });
});

describe('/hello:username', () => {
  test('/hello/user1 をgetしたときのテスト', async () => {
    const username = 'user1';
    const response = await request(app).get('/hello/' + username);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: `Hello: ${username}`,
    });
  });
});

describe('/users', () => {
  test('ユーザーの新規作成ができるか', async () => {
    const username =
      '9EC62C20118FF506DAC139EC30A521D12B9883E55DA92B7D9ADEEFE09ED4E0BD152E2A099339871424263784F8103391F83B781C432F45ECCB03E18E28060D2F';

    const result = await request(app)
      .post('/users')
      .send({
        username: username,
        password: 'password',
      })
      .set('Accept', 'application/json');

    expect(result.status).toBe(200);

    expect(result.header['content-type']).toStrictEqual(
      'application/json; charset=utf-8'
    );

    const userDeleteResult = await prisma.user.delete({
      where: {
        id: result.body['id'],
      },
    });

    expect(userDeleteResult.username).toBe(username);
  });
});

describe('createUser', () => {
  test('userが作成できるか', async () => {
    const username = 'user000';
    const password = 'password000';

    const result = await createUser({ username: username, password: password });
    expect(result.username).toBe(username);
    expect(result.password).toBe(password);

    const createdUser = await prisma.user.findUnique({
      where: {
        id: result.id,
      },
    });

    expect(createdUser.username).toBe(username);
    expect(createdUser.password).toBe(password);

    await prisma.user.delete({
      where: { id: result.id },
    });
  });
});
