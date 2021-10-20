import cookieParser from 'cookie-parser';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import createError from 'http-errors';
import logger from 'morgan';
import passport from 'passport';
import { Strategy as BearerTokenStrategy } from 'passport-http-bearer';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { User } from './model/user';
import { router as refreshRouter } from './routes/v0/auth/refresh';
import { router as registerRouter } from './routes/v0/auth/register';
import { router as pingRouter } from './routes/v0/ping';
import { router as createRoomRouter } from './routes/v0/rooms/create';
import { router as meRouter } from './routes/v0/users/me';

const app = express();

// view engine setup
app.set('views', 'views');
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

// helmetの設定 参考: https://stackoverflow.com/questions/60706823/what-modules-of-helmet-should-i-use-in-my-rest-api
app.use(helmet.expectCt());
app.use(helmet.frameguard());
app.use(helmet.hsts());
app.use(helmet.noSniff());
app.use(helmet.permittedCrossDomainPolicies());

const swaggerOptions: swaggerJSDoc.Options = {
  swaggerDefinition: {
    swagger: '2.0',
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
    const user = await User.findUserByLoginToken(token);

    if (!user || !user.validToken) {
      return done(null, false, 'invalid_token');
    }

    return done(null, user);
  })
);

app.use(passport.initialize());

app.use('/api/v0/', pingRouter);
app.use('/api/v0/', registerRouter);
app.use('/api/v0/', meRouter);
app.use('/api/v0/', refreshRouter);
app.use('/api/v0', createRoomRouter);

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
