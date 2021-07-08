import { app } from '../app';
import request from 'supertest';

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
