import { ApiFormat } from "../constants";
import type { ProtocolStreamEvent } from "./protocolConverter/protocolTypes";

interface ParsedSSEEvent extends ProtocolStreamEvent {}

interface SplitSSEEventsResult {
    events: string[];
    remainingBuffer: string;
}

function splitEvents(buffer: string): SplitSSEEventsResult {
    const events = buffer.split("\n\n");
    const remainingBuffer = events.pop() ?? "";
    return { events, remainingBuffer };
}


function parseEvent(event: string): ParsedSSEEvent | null {
    const lines = event.split("\n");
    const dataLines = lines.filter((line) => line.startsWith("data:"));
    const data = dataLines.map((line) => line.slice(5).trim()).join("\n");
    if (!data) {
        return null;
    }

    const eventType = lines.find((line) => line.startsWith("event:"))?.slice(6).trim() || undefined;
    const id = lines.find((line) => line.startsWith("id:"))?.slice(3).trim() || undefined;
    return { data, event: eventType, id };
}


function getJsonEventType(data: string): string | null {
    try {
        return JSON.parse(data)?.type ?? null;
    } catch {
        return null;
    }
}


function isClientStreamError(format: ApiFormat, event: ProtocolStreamEvent): boolean {
    if (event.event === "error") return true;
    try {
        const parsed = JSON.parse(event.data);
        if (parsed?.type === "error" || parsed?.type === "response.failed" || parsed?.error) {
            return true;
        }
    } catch {}
    return false;
}

function isClientStreamCompleted(format: ApiFormat, event: ProtocolStreamEvent): boolean {
    if (format === ApiFormat.OPENAI) {
        return event.data === "[DONE]";
    }

    if (format === ApiFormat.ANTHROPIC) {
        return event.event === "message_stop" || getJsonEventType(event.data) === "message_stop";
    }

    if (format === ApiFormat.RESPONSES) {
        return getJsonEventType(event.data) === "response.completed";
    }

    return false;
}


export default {
    splitEvents,
    parseEvent,
    getJsonEventType,
    isClientStreamCompleted,
    isClientStreamError,
};
