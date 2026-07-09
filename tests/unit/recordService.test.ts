import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ConfigKey } from "../../src/constants";


const objectStorageMocks = vi.hoisted(() => ({
    putText: vi.fn(),
    getText: vi.fn(),
}));

vi.mock("../../src/service/objectStorageService", () => ({
    default: {
        putText: objectStorageMocks.putText,
        getText: objectStorageMocks.getText,
    },
}));

const configMocks = vi.hoisted(() => ({
    getConfig: vi.fn(),
    setValue: vi.fn(),
    getAll: vi.fn(),
    clearCache: vi.fn(),
}));

vi.mock("../../src/service/configService", () => ({
    default: {
        getConfig: configMocks.getConfig,
        setValue: configMocks.setValue,
        getAll: configMocks.getAll,
        clearCache: configMocks.clearCache,
    },
}));

const sgRecordMocks = vi.hoisted(() => ({
    create: vi.fn((data) => Promise.resolve({ id: 1, ...data })),
    update: vi.fn((data) => Promise.resolve([1])),
}));

vi.mock("../../src/model/sgRecord", () => ({
    SgRecord: {
        query: vi.fn(() => ({
            create: sgRecordMocks.create,
            where: vi.fn(() => ({
                update: sgRecordMocks.update,
            })),
            orderBy: vi.fn(() => ({
                limit: vi.fn(() => ({
                    get: vi.fn(() => Promise.resolve([])),
                    select: vi.fn(function (this: any) {
                        return this;
                    }),
                })),
            })),
        })),
    },
    RECORD_SUMMARY_COLUMNS: ["id", "user_id", "model_id"],
}));

const recordService = (await import("../../src/service/recordService")).default;
const { SgRecord } = await import("../../src/model/sgRecord");


describe("recordService", () => {
    const originalEnv = process.env;
    const originalConsoleLog = console.log;

    beforeEach(() => {
        process.env = { ...originalEnv };
        console.log = vi.fn();

        objectStorageMocks.putText.mockReset();
        objectStorageMocks.getText.mockReset();
        objectStorageMocks.putText.mockResolvedValue(undefined);
        objectStorageMocks.getText.mockResolvedValue(null);

        // Default: payload recording enabled (existing behaviour)
        configMocks.getConfig.mockImplementation((key: string) => {
            if (key === ConfigKey.RECORD_PAYLOAD_ENABLED) {
                return Promise.resolve({ getBoolean: () => true });
            }
            return Promise.resolve({ getBoolean: () => false, getString: () => "" });
        });

        sgRecordMocks.create.mockClear();
        sgRecordMocks.update.mockClear();
        sgRecordMocks.create.mockImplementation((data: any) => Promise.resolve({ id: 1, ...data }));
        sgRecordMocks.update.mockImplementation((data: any) => Promise.resolve([1]));
    });

    afterEach(() => {
        process.env = originalEnv;
        console.log = originalConsoleLog;
        vi.clearAllMocks();
    });

    it("should not log when RECORD_LOG_ENABLED is false", async () => {
        process.env.RECORD_LOG_ENABLED = "false";

        await recordService.create(1, 1, "test request");
        expect(console.log).not.toHaveBeenCalled();

        await recordService.update(1, { status: "success" as any });
        expect(console.log).not.toHaveBeenCalled();
    });

    it("should log when RECORD_LOG_ENABLED is true", async () => {
        process.env.RECORD_LOG_ENABLED = "true";

        await recordService.create(1, 1, "test request");
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("[RecordService] Creating record: user=1, model=1"));
        expect(console.log).toHaveBeenCalledWith(expect.stringContaining("test request"));

        await recordService.update(1, { status: "success" as any });
        expect(console.log).toHaveBeenCalledWith(
            expect.stringContaining("[RecordService] Updating record 1:"),
            expect.any(String)
        );
    });

    it("writes the request payload to object storage on create", async () => {
        await recordService.create(1, 1, "test request");

        expect(objectStorageMocks.putText).toHaveBeenCalledWith(
            "record/1",
            JSON.stringify({ request: "test request", response: null }),
        );
    });

    it("writes null request when create has no request data", async () => {
        await recordService.create(1, 1, null);

        expect(objectStorageMocks.putText).toHaveBeenCalledWith(
            "record/1",
            JSON.stringify({ request: null, response: null }),
        );
    });

    it("merges response_data into storage and keeps it out of the record table update", async () => {
        objectStorageMocks.getText.mockResolvedValue(
            JSON.stringify({ request: "req", response: null }),
        );

        await recordService.update(1, {
            response_data: "resp body",
            status: "success" as any,
        });

        // stored object now carries the response
        expect(objectStorageMocks.putText).toHaveBeenCalledWith(
            "record/1",
            JSON.stringify({ request: "req", response: "resp body" }),
        );
        // record table update excludes response_data
        expect(sgRecordMocks.update).toHaveBeenCalledWith(
            expect.not.objectContaining({ response_data: expect.anything() }),
        );
        expect(sgRecordMocks.update).toHaveBeenCalledWith(
            expect.objectContaining({ status: "success" }),
        );
    });

    it("does not touch object storage when update has no response_data", async () => {
        await recordService.update(1, { status: "failed" as any });

        expect(objectStorageMocks.putText).not.toHaveBeenCalled();
        expect(sgRecordMocks.update).toHaveBeenCalledWith({ status: "failed" });
    });

    it("skips storage write on create when payload recording is disabled", async () => {
        configMocks.getConfig.mockImplementation((key: string) => {
            if (key === ConfigKey.RECORD_PAYLOAD_ENABLED) {
                return Promise.resolve({ getBoolean: () => false });
            }
            return Promise.resolve({ getBoolean: () => false, getString: () => "" });
        });

        await recordService.create(1, 1, "test request");

        expect(objectStorageMocks.putText).not.toHaveBeenCalled();
    });

    it("skips storage write on update with response_data when payload recording is disabled", async () => {
        configMocks.getConfig.mockImplementation((key: string) => {
            if (key === ConfigKey.RECORD_PAYLOAD_ENABLED) {
                return Promise.resolve({ getBoolean: () => false });
            }
            return Promise.resolve({ getBoolean: () => false, getString: () => "" });
        });

        await recordService.update(1, {
            response_data: "resp body",
            status: "success" as any,
        });

        // No storage write
        expect(objectStorageMocks.putText).not.toHaveBeenCalled();
        // response_data still stripped from record table update
        expect(sgRecordMocks.update).toHaveBeenCalledWith(
            expect.not.objectContaining({ response_data: expect.anything() }),
        );
    });
});
