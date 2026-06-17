import configService from "./configService";

const RESPONSES_PROMPT_CACHE_HOST_KEY = "responses_prompt_cache_host_key";
const HOST_KEY_LENGTH = 8;

let cachedHostKey: string | null = null;
let loadingHostKey: Promise<string> | null = null;


function generateShortUuid(): string {
    return crypto.randomUUID().replace(/-/g, "").slice(0, HOST_KEY_LENGTH);
}


async function loadResponsesPromptCacheHostKey(): Promise<string> {
    const existing = (await configService.getValue(RESPONSES_PROMPT_CACHE_HOST_KEY, "")).trim();
    if (existing) {
        cachedHostKey = existing;
        return existing;
    }

    const generated = generateShortUuid();
    await configService.setValue(RESPONSES_PROMPT_CACHE_HOST_KEY, generated);
    cachedHostKey = generated;
    return generated;
}


async function getResponsesPromptCacheHostKey(): Promise<string> {
    if (cachedHostKey) return cachedHostKey;
    if (loadingHostKey) return await loadingHostKey;

    loadingHostKey = loadResponsesPromptCacheHostKey().finally(() => {
        loadingHostKey = null;
    });
    return await loadingHostKey;
}


export default {
    getResponsesPromptCacheHostKey,
};

export {
    RESPONSES_PROMPT_CACHE_HOST_KEY,
    generateShortUuid,
    getResponsesPromptCacheHostKey,
};
