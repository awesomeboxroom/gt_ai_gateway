import { Context, MiddlewareHandler } from "hono";
import userService from "../service/userService";
import { UserType, ROOT_USER_ID } from "../constants";

const requireAdmin: MiddlewareHandler = async (c, next) => {
    const authHeader = c.req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return c.json({ error: "Authorization header is missing or invalid" }, 401);
    }

    const token = authHeader.split(" ")[1];
    const rootToken = c.env.ROOT_TOKEN;

    // 检查是否为 root token
    if (userService.isRootToken(token, rootToken)) {
        c.set("user_type", UserType.ROOT);
        await next();
        return;
    }

    const user = await userService.getUser(token);

    if (!user) {
        return c.json({ error: "Invalid token" }, 401);
    }

    c.set("user_type", user.type);

    if (user.type !== UserType.ADMIN) {
        return c.json({ error: "Admin access required" }, 403);
    }

    await next();
};

export default { requireAdmin };