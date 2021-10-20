import request from 'supertest';
import { app } from '../app';

export async function createUser(email: string, password: string) {
  const response = await request(app).post('/api/v0/auth/register').send({
    email: email,
    password: password,
  });

  return response;
}
