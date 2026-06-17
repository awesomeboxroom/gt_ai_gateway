import { describe, it, expect } from "vitest";
import {
    buildResponsesPromptCacheKey,
    injectResponsesPromptCacheKey,
} from "../../src/util/responsesPromptCacheKeyRewriter";


describe("responsesPromptCacheKeyRewriter", () => {
    it("builds prompt cache key from host key and client name", () => {
        expect(buildResponsesPromptCacheKey("abc12345", "Codex")).toBe("abc12345:Codex");
    });

    it("falls back when host key or client name is blank", () => {
        expect(buildResponsesPromptCacheKey("", "")).toBe("local:unknown");
        expect(buildResponsesPromptCacheKey(" host-key ", " client ")).toBe("host-key:client");
    });

    it("injects prompt_cache_key when missing", () => {
        const body = JSON.stringify({ model: "gpt-4.1", input: "hello" });
        const result = injectResponsesPromptCacheKey(body, "abc12345", "Codex");

        expect(JSON.parse(result)).toEqual({
            model: "gpt-4.1",
            input: "hello",
            prompt_cache_key: "abc12345:Codex",
        });
    });

    it("does not override existing prompt_cache_key", () => {
        const body = JSON.stringify({
            model: "gpt-4.1",
            input: "hello",
            prompt_cache_key: "client-key",
        });

        expect(injectResponsesPromptCacheKey(body, "abc12345", "Codex")).toBe(body);
    });

    it("returns original body when JSON parsing fails", () => {
        const body = "not-json";

        expect(injectResponsesPromptCacheKey(body, "abc12345", "Codex")).toBe(body);
    });
});
