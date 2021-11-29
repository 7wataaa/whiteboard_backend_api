import { Request, Response, Router } from 'express';
import { User } from '../../../model/user';

export const router = Router();

/* !!このURLはコマンドライン等からアクセスされるのではなく、ブラウザからGETされる */
router.get('/auth/email-confirmation', async (req: Request, res: Response) => {
  const rawEmail = req.query['email'];
  const token = req.query['token'];

  /* クエリのバリデーション */
  if (typeof rawEmail !== 'string') {
    res.sendStatus(400);
    return;
  }
  if (typeof token !== 'string') {
    res.sendStatus(400);
    return;
  }

  const email = decodeURIComponent(rawEmail);

  const emailRegexp =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!emailRegexp.test(decodeURIComponent(email))) {
    res.sendStatus(400);
    return;
  }

  if (token.length != 64) {
    res.sendStatus(400);
    return;
  }

  const tokenRegExp = /^[a-zA-Z0-9\-_]{64}$/;

  if (!tokenRegExp.test(token)) {
    res.sendStatus(400);
    return;
  }

  /* 本人確認 */

  const resultUser = await User.confirmationEmail(email, token);

  if (!resultUser) {
    res.sendStatus(400);
    return;
  }

  // TODO ディープリンクを設定し、リダイレクトする
  res.status(200).send(`<h>登録完了</h>`);
});
