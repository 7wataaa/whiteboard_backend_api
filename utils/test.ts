import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { app } from '../app';

const prisma = new PrismaClient();

describe('app.ts', () => {
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
