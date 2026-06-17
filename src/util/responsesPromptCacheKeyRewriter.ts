function normalizePromptCacheKeyPart(value: string | null | undefined, fallback: string): string {
    const trimmed = (value ?? "").trim();
    return trimmed || fallback;
}


function buildResponsesPromptCacheKey(hostKey: string, clientName: string | null | undefined): string {
    const safeHostKey = normalizePromptCacheKeyPart(hostKey, "local");
    const safeClientName = normalizePromptCacheKeyPart(clientName, "unknown");
    return `${safeHostKey}:${safeClientName}`;
}


function injectResponsesPromptCacheKey(upstreamBody: string, hostKey: string, clientName: string | null | undefined): string {
    try {
        const bodyJson = JSON.parse(upstreamBody);
        if (bodyJson.prompt_cache_key !== undefined && bodyJson.prompt_cache_key !== null && bodyJson.prompt_cache_key !== "") {
            return upstreamBody;
        }

        bodyJson.prompt_cache_key = buildResponsesPromptCacheKey(hostKey, clientName);
        return JSON.stringify(bodyJson);
    } catch (e) {
        console.log("[responsesPromptCacheKeyRewriter] Failed to inject prompt_cache_key:", e);
        return upstreamBody;
    }
}


export {
    buildResponsesPromptCacheKey,
    injectResponsesPromptCacheKey,
};
