import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { app } from '../app';

const prisma = new PrismaClient();

describe('/api/v0/ping', () => {
  test('getしたときのテスト', async () => {
    const response = await request(app).get('/api/v0/ping');
    expect(response.status).toBe(200);
  });
});
