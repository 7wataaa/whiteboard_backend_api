import { Router, Request, Response } from 'express';

export const router = Router();

/**
 * @swagger
 * /:
 *  get:
 *    description: タイトルを返す
 *    produces:
 *      - application/json
 *    responses:
 *      200:
 *        description: タイトル
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Hello World!',
  });
});
