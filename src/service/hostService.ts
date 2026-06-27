import configService, { ConfigKey } from "./configService";

const HOST_KEY_LENGTH = 8;

let cachedHostKey: string | null = null;
let loadingHostKey: Promise<string> | null = null;


function generateShortUuid(): string {
    return crypto.randomUUID().replace(/-/g, "").slice(0, HOST_KEY_LENGTH);
}


async function loadHostKey(): Promise<string> {
    const existing = (await configService.getConfig(ConfigKey.HOST_KEY, "")).getString().trim();
    if (existing) {
        cachedHostKey = existing;
        return existing;
    }

    const generated = generateShortUuid();
    await configService.setValue(ConfigKey.HOST_KEY, generated);
    cachedHostKey = generated;
    return generated;
}


async function getHostKey(): Promise<string> {
    if (cachedHostKey) return cachedHostKey;
    if (loadingHostKey) return await loadingHostKey;

    loadingHostKey = loadHostKey().finally(() => {
        loadingHostKey = null;
    });
    return await loadingHostKey;
}


function getLocalPort(): string {
    return process.env.PORT || "8720";
}


function getLocalHost(): string {
    return process.env.HOST || "127.0.0.1";
}


export default {
    getHostKey,
    getLocalPort,
    getLocalHost,
};

export {
    generateShortUuid,
    getHostKey,
    getLocalPort,
    getLocalHost,
};
