import cookieParser from 'cookie-parser';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import createError from 'http-errors';
import logger from 'morgan';
import { router as pingRouter } from './routes/v0/ping';
import { router as registerRouter } from './routes/v0/auth/register';
import { router as meRouter } from './routes/v0/users/me';

const app = express();

import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';
import passport from 'passport';
import { Strategy as BearerTokenStrategy } from 'passport-http-bearer';
import { prisma } from './prismaClient';

// view engine setup
app.set('views', 'views');
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: "'none'",
      },
    },
  })
);

const swaggerOptions: swaggerJSDoc.Options = {
  swaggerDefinition: {
    info: {
      title: 'Express TypeScript',
      version: '0.1.0',
    },
  },
  apis: ['routes/v0/**/*.ts'],
};

// Swaggerの設定
app.use(
  '/spec',
  swaggerUi.serve,
  swaggerUi.setup(swaggerJSDoc(swaggerOptions))
);

passport.use(
  new BearerTokenStrategy(async (token, done) => {
    const user = await prisma.user.findUnique({
      where: { loginToken: token },
    });

    if (
      !user ||
      +new Date() > +new Date(user.loginTokenExpirationAt) ||
      +new Date() > +new Date(user.refreshTokenExpirationAt)
    ) {
      return done(null, false, 'invalid_token');
    }

    return done(null, user);
  })
);

app.use(passport.initialize());

app.use('/api/v0/', pingRouter);
app.use('/api/v0/', registerRouter);
app.use('/api/v0/', meRouter);

// catch 404 and forward to error handler
app.use((req: Request, res: Response, next: NextFunction) => {
  next(createError(404));
});

// error handler
app.use(function (err: any, req: Request, res: Response, next: NextFunction) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.send(err.message);
});

export { app };
