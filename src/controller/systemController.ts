import { Context } from "hono";
import ormService from "../service/ormService";
import { SgUser } from "../model/sgUser";
import { SgVendor } from "../model/sgVendor";
import { SgModel } from "../model/sgModel";
import { SgRecord } from "../model/sgRecord";

// 当前实例的启动时间（延迟初始化，避免 Workers 模块加载时日期异常）
let INSTANCE_START_TIME: Date | null = null;

function getInstanceStartTime(): Date {
    if (!INSTANCE_START_TIME) {
        INSTANCE_START_TIME = new Date();
    }
    return INSTANCE_START_TIME;
}

function formatUptime(startTime: Date): string {
    const now = new Date();
    const diff = now.getTime() - startTime.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days}天 ${hours % 24}小时 ${minutes % 60}分钟 ${seconds % 60}秒`;
    } else if (hours > 0) {
        return `${hours}小时 ${minutes % 60}分钟 ${seconds % 60}秒`;
    } else if (minutes > 0) {
        return `${minutes}分钟 ${seconds % 60}秒`;
    } else {
        return `${seconds}秒`;
    }
}

function welcome(c: Context) {
    const message =
        ormService.mode === "cloud"
            ? "Hello, welcome to serverless ai gateway!"
            : "Hello, welcome to serverless ai gateway (local mode)!";
    return c.text(message);
}

async function status(c: Context) {
    try {
        const userCount = Number(await SgUser.query().count() || 0);
        const vendorCount = Number(await SgVendor.query().count() || 0);
        const modelCount = Number(await SgModel.query().count() || 0);
        const recordCount = Number(await SgRecord.query().count() || 0);

        const startTime = getInstanceStartTime();

        return c.json({
            status: "ok",
            mode: ormService.mode,
            user_type: c.get("user_type"),
            statistics: {
                users: userCount,
                vendors: vendorCount,
                models: modelCount,
                records: recordCount,
            },
            system: {
                environment: ormService.mode === "cloud" ? "Cloudflare Workers" : "Local",
                version: process.env.npm_package_version || "1.0.0",
                startTime: startTime.toISOString(),
                uptime: formatUptime(startTime),
            },
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        return c.json(
            {
                status: "error",
                message: "Failed to get system status",
                error: String(error),
            },
            500,
        );
    }
}

export default {
    welcome,
    status,
};
