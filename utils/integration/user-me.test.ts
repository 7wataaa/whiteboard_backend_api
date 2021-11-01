import request from 'supertest';
import { app } from '../../app';
import { User } from '../../model/user';

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
