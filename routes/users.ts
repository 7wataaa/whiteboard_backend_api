import { Request, Response } from 'express';
import Router from 'express-promise-router';
import { createUser } from '../src/createUser';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const userName = req.body.username;
  const password = req.body.password;

  const result = await createUser({ username: userName, password: password });

  res.status(200);
  res.json({
    id: result.id,
    username: result.username,
    password: result.password,
  });
});

export { router };
