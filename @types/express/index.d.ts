import { User } from '.prisma/client';

// req.userをprismaで定義されたUserにする
declare global {
  namespace Express {
    export interface User {
      user: User;
    }
  }
}
