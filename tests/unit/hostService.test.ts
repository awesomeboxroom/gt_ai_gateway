import { beforeEach, describe, expect, it, vi } from "vitest";

const configMocks = vi.hoisted(() => ({
    getValue: vi.fn(),
    setValue: vi.fn(),
}));

vi.mock("../../src/service/configService", () => ({
    default: {
        getValue: configMocks.getValue,
        setValue: configMocks.setValue,
    },
}));


async function loadService() {
    return await import("../../src/service/hostService");
}


describe("hostService", () => {
    beforeEach(() => {
        vi.resetModules();
        configMocks.getValue.mockReset();
        configMocks.setValue.mockReset();
    });

    it("uses existing host key from config and caches it in memory", async () => {
        configMocks.getValue.mockResolvedValue("stored123");
        const service = await loadService();

        await expect(service.getResponsesPromptCacheHostKey()).resolves.toBe("stored123");
        await expect(service.getResponsesPromptCacheHostKey()).resolves.toBe("stored123");

        expect(configMocks.getValue).toHaveBeenCalledTimes(1);
        expect(configMocks.setValue).not.toHaveBeenCalled();
    });

    it("generates and stores a short uuid when config is missing", async () => {
        configMocks.getValue.mockResolvedValue("");
        configMocks.setValue.mockResolvedValue({});
        const service = await loadService();

        const hostKey = await service.getResponsesPromptCacheHostKey();
        const cachedHostKey = await service.getResponsesPromptCacheHostKey();

        expect(hostKey).toMatch(/^[0-9a-f]{8}$/);
        expect(cachedHostKey).toBe(hostKey);
        expect(configMocks.getValue).toHaveBeenCalledTimes(1);
        expect(configMocks.setValue).toHaveBeenCalledTimes(1);
        expect(configMocks.setValue).toHaveBeenCalledWith(
            service.RESPONSES_PROMPT_CACHE_HOST_KEY,
            hostKey,
        );
    });

    it("shares one loading promise for concurrent cold reads", async () => {
        let resolveConfig: (value: string) => void = () => {};
        configMocks.getValue.mockReturnValue(new Promise<string>((resolve) => {
            resolveConfig = resolve;
        }));
        configMocks.setValue.mockResolvedValue({});
        const service = await loadService();

        const first = service.getResponsesPromptCacheHostKey();
        const second = service.getResponsesPromptCacheHostKey();
        resolveConfig("");

        const [firstKey, secondKey] = await Promise.all([first, second]);

        expect(firstKey).toBe(secondKey);
        expect(configMocks.getValue).toHaveBeenCalledTimes(1);
        expect(configMocks.setValue).toHaveBeenCalledTimes(1);
    });
});
