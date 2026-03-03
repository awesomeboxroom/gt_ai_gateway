import { Context } from "hono";

// 使用 Symbol 标记来识别 AppError 实例
const APP_ERROR_SYMBOL = Symbol.for("AppError");


class AppError extends Error {
    readonly [APP_ERROR_SYMBOL] = true;

    constructor(
        public message: string,
        public statusCode: number = 400,
        public code?: string,
    ) {
        super(message);
        this.name = "AppError";
    }
}


class NotFoundError extends AppError {
    constructor(message: string) {
        super(message, 404, "NOT_FOUND");
        this.name = "NotFoundError";
    }
}


export default {
    AppError,
    NotFoundError,
};