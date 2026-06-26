import { SgUser } from "../../model/sgUser";
import type { ConfigAdapter, CurrentClientConfig, CurrentClientConfigWithUser, FileSystemApi, GatewayUserInfo, ClientConfigStatus } from "./types";


async function pathExists(fs: FileSystemApi, path: string): Promise<boolean> {
    try {
        await fs.access(path);
        return true;
    } catch {
        return false;
    }
}


function parseJsonConfig(content: string): Record<string, any> {
    if (!content.trim()) {
        return {};
    }

    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Config file must contain a JSON object");
    }

    return parsed;
}


async function findGatewayUserByToken(token: string): Promise<GatewayUserInfo | null> {
    if (!token) {
        return null;
    }

    const normalizedToken = token.replace(/^Bearer\s+/i, "");
    let user: SgUser | null = null;
    try {
        user = await SgUser.query().where("token", normalizedToken).first();
    } catch {
        return null;
    }

    if (!user) {
        return null;
    }

    return {
        id: user.id,
        name: user.name,
        type: user.type,
        status: user.status,
    };
}

async function enrichGatewayUser(config: CurrentClientConfig | null): Promise<CurrentClientConfigWithUser | null> {
    if (!config) {
        return null;
    }
    const gatewayUser = await findGatewayUserByToken(config.token);
    return {
        ...config,
        gatewayUser,
    };
}

async function buildClientStatus(adapter: ConfigAdapter, fs: FileSystemApi): Promise<ClientConfigStatus> {
    const installed = await adapter.isInstalled();
    let configured = false;
    let message: string | undefined;
    let currentConfig: CurrentClientConfigWithUser | null = null;

    if (installed && await pathExists(fs, adapter.configPath)) {
        try {
            const rawConfig = await adapter.parseConfigContent(await adapter.readConfigFiles());
            currentConfig = await enrichGatewayUser(rawConfig);
            configured = Boolean(currentConfig);
        } catch (error) {
            message = `配置文件解析失败: ${String(error)}`;
        }
    }

    return {
        client: adapter.client,
        displayName: adapter.displayName,
        defaultGatewaySuffix: adapter.defaultGatewaySuffix,
        installed,
        configured,
        backupExists: false,
        backupCount: 0,
        backups: [],
        activeConfigModified: false,
        currentConfig,
        configPath: adapter.configPath,
        configPaths: adapter.configPaths,
        message,
    };
}


export default {
    findGatewayUserByToken,
    parseJsonConfig,
    pathExists,
    enrichGatewayUser,
    buildClientStatus,
};
