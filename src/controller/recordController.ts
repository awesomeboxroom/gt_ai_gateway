import { Context } from "hono";
import { SgRecord } from "../model/sgRecord";
import recordService from "../service/recordService";

async function listRecords(c: Context) {
    const records = await SgRecord.query().get();
    return c.json(records);
}

async function latestRecords(c: Context) {
    const { limit } = c.req.query();
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    const records = await recordService.latest(limitNumber);
    return c.json(records);
}

async function getRecord(c: Context) {
    const id = c.req.param("id");
    const recordId = parseInt(id, 10);
    console.log("id", id, "recordId", recordId);

    if (isNaN(recordId)) {
        return c.json({ error: "Invalid ID format" }, 400);
    }

    const record = await SgRecord.query().find(recordId);

    if (!record) {
        return c.json({ error: "Record not found" }, 404);
    }

    return c.json(record);
}

export default {
    listRecords,
    latestRecords,
    getRecord,
};
