import ormService from "./ormService";
import configService from "./configService";
import { SgStorageRecord } from "../model/sgStorageRecord";
import { ConfigKey, RecordPayloadStorage } from "../constants";
import customError from "../util/customError";

interface StoredObject {
    object_key: string;
    data: Uint8Array;
    size_bytes: number;
    created_at?: string | Date;
    updated_at?: string | Date;
}

let r2Bucket: R2Bucket | null = null;

function setR2Bucket(bucket: R2Bucket | null | undefined) {
    r2Bucket = bucket ?? null;
}

function assertValidKey(key: string) {
    if (!key || !key.trim()) {
        throw new customError.AppError("object key is required", 400);
    }
}

function assertValidPrefix(prefix: string) {
    if (!prefix || !prefix.trim()) {
        throw new customError.AppError("object key prefix is required", 400);
    }
}

function normalizeBytes(data: unknown): Uint8Array {
    // 1. 标准 Uint8Array
    if (data instanceof Uint8Array) {
        return new Uint8Array(data);
    }

    // 2. ArrayBuffer
    if (data instanceof ArrayBuffer) {
        return new Uint8Array(data);
    }

    // 3. 其他 TypedArray 或 DataView
    if (ArrayBuffer.isView(data)) {
        return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    }

    // 4. 字符串（可能是 base64 编码）
    if (typeof data === "string") {
        return new TextEncoder().encode(data);
    }

    // 5. D1 可能返回的 Buffer 序列化对象: { type: "Buffer", data: [byte1, byte2, ...] }
    if (data !== null && typeof data === "object" && "type" in data && "data" in data) {
        const obj = data as { type: string; data: number[] | Uint8Array };
        if (obj.type === "Buffer" && Array.isArray(obj.data)) {
            return new Uint8Array(obj.data);
        }
    }

    // 6. 鸭子类型：具有 buffer/byteOffset/byteLength 属性的对象
    if (data !== null && typeof data === "object" && "buffer" in data && "byteLength" in data) {
        const typedData = data as { buffer: ArrayBuffer; byteOffset: number; byteLength: number };
        return new Uint8Array(typedData.buffer, typedData.byteOffset, typedData.byteLength);
    }

    // 7. 数字（单字节）
    if (typeof data === "number") {
        return new Uint8Array([data]);
    }

    // 8. null 或 undefined
    if (data === null || data === undefined) {
        return new Uint8Array(0);
    }

    // 9. 未知对象类型 - 记录详细信息用于调试
    console.error("[normalizeBytes] Unknown object type:", {
        type: typeof data,
        constructor: (data as any)?.constructor?.name,
        keys: data !== null && typeof data === "object" ? Object.keys(data) : [],
        json: JSON.stringify(data)?.substring(0, 200),
    });

    throw new customError.AppError(`unsupported object data type: ${typeof data}`, 500);
}

function getWorkerBucket(): R2Bucket {
    if (!r2Bucket) {
        throw new customError.AppError("R2 object bucket is not configured", 500);
    }
    return r2Bucket;
}

function isValidStorageLocation(value: string): value is RecordPayloadStorage.DATABASE | RecordPayloadStorage.R2 {
    return value === RecordPayloadStorage.DATABASE || value === RecordPayloadStorage.R2;
}

async function resolveStorageLocation(): Promise<RecordPayloadStorage.DATABASE | RecordPayloadStorage.R2> {
    const configured = (await configService.getConfig(ConfigKey.RECORD_PAYLOAD_STORAGE)).getString().trim();
    if (isValidStorageLocation(configured)) {
        return configured;
    }

    if (ormService.isWorker && r2Bucket) {
        return RecordPayloadStorage.R2;
    }

    return RecordPayloadStorage.DATABASE;
}

function alternateStorageLocation(
    location: RecordPayloadStorage.DATABASE | RecordPayloadStorage.R2,
): RecordPayloadStorage.DATABASE | RecordPayloadStorage.R2 {
    return location === RecordPayloadStorage.R2
        ? RecordPayloadStorage.DATABASE
        : RecordPayloadStorage.R2;
}

function isLocationAvailable(location: RecordPayloadStorage.DATABASE | RecordPayloadStorage.R2): boolean {
    if (location === RecordPayloadStorage.R2) {
        return r2Bucket !== null;
    }
    return true;
}

function assertLocationAvailable(location: RecordPayloadStorage.DATABASE | RecordPayloadStorage.R2) {
    if (location === RecordPayloadStorage.R2) {
        getWorkerBucket();
    }
}

function toDatabaseBytes(data: Uint8Array): Uint8Array {
    if (typeof Buffer !== "undefined") {
        return Buffer.from(data);
    }
    return data;
}

async function putToTable(key: string, data: Uint8Array) {
    const existing = await SgStorageRecord.query().where("object_key", key).first();

    if (existing) {
        await existing.update({
            size_bytes: data.byteLength,
            data: toDatabaseBytes(data),
            updated_at: new Date(),
        });
        return;
    }

    await SgStorageRecord.query().create({
        object_key: key,
        size_bytes: data.byteLength,
        data: toDatabaseBytes(data),
    });
}

async function getFromTable(key: string): Promise<StoredObject | null> {
    const row = await SgStorageRecord.query().where("object_key", key).first();

    if (!row) {
        return null;
    }

    return {
        object_key: row.object_key,
        size_bytes: Number(row.size_bytes ?? 0),
        created_at: row.created_at,
        updated_at: row.updated_at,
        data: normalizeBytes(row.data),
    };
}

async function deleteFromTable(key: string) {
    await SgStorageRecord.query().where("object_key", key).delete();
}

async function deleteFromTableByPrefix(prefix: string): Promise<number> {
    const pattern = `${prefix}%`;
    const deleted = await SgStorageRecord.query().where("object_key", "like", pattern).delete();
    return Number(deleted || 0);
}

async function putToLocation(
    location: RecordPayloadStorage.DATABASE | RecordPayloadStorage.R2,
    key: string,
    data: Uint8Array,
) {
    if (location === RecordPayloadStorage.R2) {
        await getWorkerBucket().put(key, data);
        return;
    }

    await putToTable(key, data);
}

async function getFromLocation(
    location: RecordPayloadStorage.DATABASE | RecordPayloadStorage.R2,
    key: string,
): Promise<Uint8Array | null> {
    if (location === RecordPayloadStorage.R2) {
        const object = await getWorkerBucket().get(key);
        if (!object) {
            return null;
        }
        return new Uint8Array(await object.arrayBuffer());
    }

    const object = await getFromTable(key);
    return object?.data ?? null;
}

async function deleteFromLocation(
    location: RecordPayloadStorage.DATABASE | RecordPayloadStorage.R2,
    key: string,
) {
    if (location === RecordPayloadStorage.R2) {
        await getWorkerBucket().delete(key);
        return;
    }

    await deleteFromTable(key);
}

async function deleteByPrefixFromLocation(
    location: RecordPayloadStorage.DATABASE | RecordPayloadStorage.R2,
    prefix: string,
): Promise<number> {
    if (location === RecordPayloadStorage.R2) {
        const bucket = getWorkerBucket();
        let cursor: string | undefined;
        const deleteBatches: string[][] = [];
        let deleted = 0;

        do {
            const page = await bucket.list({ cursor, limit: 1000, prefix });
            const keys = page.objects.map(object => object.key);
            if (keys.length > 0) {
                deleteBatches.push(keys);
                deleted += keys.length;
            }
            cursor = page.truncated ? page.cursor : undefined;
        } while (cursor);

        for (const keys of deleteBatches) {
            await bucket.delete(keys);
        }

        return deleted;
    }

    return deleteFromTableByPrefix(prefix);
}

async function put(key: string, data: Uint8Array) {
    assertValidKey(key);

    const location = await resolveStorageLocation();
    assertLocationAvailable(location);
    await putToLocation(location, key, data);

    const fallback = alternateStorageLocation(location);
    if (isLocationAvailable(fallback)) {
        await deleteFromLocation(fallback, key);
    }
}

async function get(key: string): Promise<Uint8Array | null> {
    assertValidKey(key);

    const location = await resolveStorageLocation();
    assertLocationAvailable(location);

    const primary = await getFromLocation(location, key);
    if (primary) {
        return primary;
    }

    const fallback = alternateStorageLocation(location);
    if (!isLocationAvailable(fallback)) {
        return null;
    }

    return getFromLocation(fallback, key);
}

async function deleteObject(key: string) {
    assertValidKey(key);

    const location = await resolveStorageLocation();
    assertLocationAvailable(location);

    await deleteFromLocation(location, key);

    const fallback = alternateStorageLocation(location);
    if (isLocationAvailable(fallback)) {
        await deleteFromLocation(fallback, key);
    }
}


async function deleteByPrefix(prefix: string): Promise<number> {
    assertValidPrefix(prefix);

    const location = await resolveStorageLocation();
    assertLocationAvailable(location);

    let deleted = await deleteByPrefixFromLocation(location, prefix);

    const fallback = alternateStorageLocation(location);
    if (isLocationAvailable(fallback)) {
        deleted += await deleteByPrefixFromLocation(fallback, prefix);
    }

    return deleted;
}


async function putText(key: string, text: string) {
    await put(key, new TextEncoder().encode(text));
}

async function getText(key: string): Promise<string | null> {
    const data = await get(key);
    if (!data) {
        return null;
    }
    return new TextDecoder().decode(data);
}

export type { StoredObject };

export default {
    setR2Bucket,
    put,
    get,
    delete: deleteObject,
    deleteByPrefix,
    putText,
    getText,
};
