import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../../app';
import { User } from '../../model/user';
import { prisma } from '../../prismaClient';
import { iso8601RegExp, tokenRegExp } from '../jest-setup';

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
