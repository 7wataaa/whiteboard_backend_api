import { Request, Response, Router } from 'express';

export const router = Router();

/**
 * @swagger
 * /api/v0/ping:
 *  get:
 *    description: ping
 *    responses:
 *      - 200:
 *
 */
router.get('/ping', (req: Request, res: Response) => {
  res.sendStatus(200);
});
