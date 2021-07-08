"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const http_errors_1 = __importDefault(require("http-errors"));
const morgan_1 = __importDefault(require("morgan"));
const hello_1 = require("./routes/hello");
const index_1 = require("./routes/index");
const app = express_1.default();
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
// view engine setup
app.set('views', 'views');
app.set('view engine', 'pug');
app.use(morgan_1.default('dev'));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: false }));
app.use(cookie_parser_1.default());
app.use(express_1.default.static('public'));
app.use(helmet_1.default());
const swaggerOptions = {
    swaggerDefinition: {
        info: {
            title: 'Express TypeScript',
            version: '0.1.0',
        },
    },
    apis: ['routes/*'],
};
// Swaggerの設定
app.use('/spec', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_jsdoc_1.default(swaggerOptions)));
app.use('/', index_1.router);
app.use('/hello', hello_1.router);
// catch 404 and forward to error handler
app.use((req, res, next) => {
    next(http_errors_1.default(404));
});
// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    // render the error page
    res.status(err.status || 500);
    res.json('ERR');
});
module.exports = app;
