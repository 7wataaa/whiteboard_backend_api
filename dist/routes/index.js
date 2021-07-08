"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
exports.router = express_1.Router();
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
exports.router.get('/', (req, res) => {
    res.json({
        message: 'Hello World!',
    });
});
