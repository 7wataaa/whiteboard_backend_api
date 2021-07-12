import { app } from '../app';
import request from 'supertest';
import { MockContext, Context, createMockContext } from './context';

let mockCtx: MockContext;
let ctx: Context;

describe('/', () => {
  test('getしたときのテスト', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'Hello World!' });
  });
});

describe('/hello', () => {
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
  beforeEach(() => {
    mockCtx = createMockContext();
    ctx = mockCtx as unknown as Context;
  });

  test('ユーザーの新規作成ができるか', async () => {
    const response = await request(app).post('/users').send({
      username: 'user1',
      password: 'password',
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      users: [],
    });
  });
});
