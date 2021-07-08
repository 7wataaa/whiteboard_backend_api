"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
exports.router = express_1.Router();
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
exports.router.get('/:username', (req, res) => {
    const username = req.params['username'];
    res.json({
        message: `Hello: ${username}`,
        date: new Date(),
        query: req.query,
    });
});
