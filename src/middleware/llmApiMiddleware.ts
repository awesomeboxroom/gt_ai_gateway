import { Context, MiddlewareHandler } from "hono";
import { ApiFormat, UserStatus } from "../constants";
import userService from "../service/userService";
import modelService from "../service/modelService";
import recordService from "../service/recordService";
import { SgVendor } from "../model/sgVendor";
import { SgUser } from "../model/sgUser";
import customError from "../util/customError";


function getLlmToken(c: Context, allowApiKey: boolean): string {
    if (allowApiKey) {
        const apiKey = c.req.header("x-api-key");
        if (apiKey) {
            return apiKey;
        }
    }

    const authHeader = c.req.header("Authorization");
    if (!authHeader) {
        const message = allowApiKey
            ? "x-api-key or Authorization header is missing"
            : "Authorization header is missing";
        throw new customError.AppError(message, 401, "authentication_error");
    }
    if (!authHeader.startsWith("Bearer ")) {
        throw new customError.AppError("Invalid token format", 401, "authentication_error");
    }

    return authHeader.split(" ")[1];
}


async function authenticateLlmUser(c: Context, allowApiKey: boolean): Promise<SgUser> {
    const token = getLlmToken(c, allowApiKey);
    const user = await userService.getUserByToken(token, c.env.ROOT_TOKEN);

    if (user == null) {
        throw new customError.AppError("Invalid token (user not found)", 401, "authentication_error");
    }
    if (user.status === UserStatus.DISABLED) {
        throw new customError.AppError("User disabled", 403, "authentication_error");
    }

    return user;
}


const requireLlmAuth = (format: ApiFormat): MiddlewareHandler => {
    return async (c: Context, next) => {
        c.set("api_format", format);
        const user = await authenticateLlmUser(c, format === ApiFormat.ANTHROPIC);

        const body = await c.req.text();
        c.set("requestBody", body);

        let bodyDict;
        try {
            bodyDict = JSON.parse(body);
        } catch (e) {
            throw new customError.AppError("Invalid JSON body", 400, "invalid_request_error");
        }

        const modelName = bodyDict.model;
        if (!modelName) {
            throw new customError.AppError("model parameter is missing", 400, "invalid_request_error");
        }

        const modelConfig = await modelService.getModel(modelName, true);
        if (modelConfig == null) {
            await recordService.recordFailedRequest(user.id, modelName, body, format, "model_not_found");
            throw new customError.NotFoundError("model not found");
        }

        const vendor = await SgVendor.query().find(modelConfig.vendor_id!);
        if (vendor == null) {
            await recordService.recordFailedRequest(user.id, modelName, body, format, "vendor_not_found", modelConfig.id, modelConfig.vendor_id);
            throw new customError.NotFoundError("vendor not found");
        }

        c.set("user", user);
        c.set("modelConfig", modelConfig);
        c.set("vendor", vendor);

        await next();
    };
};


const requireLlmModelsAuth: MiddlewareHandler = async (c: Context, next) => {
    c.set("api_format", ApiFormat.OPENAI);
    const user = await authenticateLlmUser(c, true);
    c.set("user", user);
    await next();
};

export default { requireLlmAuth, requireLlmModelsAuth };
