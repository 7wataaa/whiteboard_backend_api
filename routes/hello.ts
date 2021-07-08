import { Router, Request, Response } from 'express';

export const router = Router();

/**
 * @swagger
 * /hello/{username}:
 *  get:
 *    description: ユーザーネームを受け取って、Dateを返す
 *    responses:
 *      - 200:
 *        description: usernameとDateが入ったjson
 *    parameters:
 *      - name: username
 *        description: ユーザの表示名
 *        in: path
 *        require: true
 *        schema: string
 *
 */
router.get('/:username', (req: Request, res: Response) => {
  const username = req.params['username'];

  res.json({
    message: `Hello: ${username}`,
    date: new Date(),
    query: req.query,
  });
});
