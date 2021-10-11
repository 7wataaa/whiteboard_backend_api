import { app } from '../app';
import request from 'supertest';

export async function createUser(email: string, password: string) {
  const response = await request(app).post('/api/v0/auth/register').send({
    email: email,
    password: password,
  });

  return response;
}
