import { describe, expect, it } from "vitest";
import { ApiFormat } from "../../src/constants";
import sseEvent from "../../src/util/sseEvent";

describe("sseEvent", () => {
    it("should split complete events and preserve remaining buffer", () => {
        const result = sseEvent.splitEvents(
            "event: one\ndata: 1\n\nevent: two\ndata: 2\n\ndata: partial",
        );

        expect(result.events).toEqual([
            "event: one\ndata: 1",
            "event: two\ndata: 2",
        ]);
        expect(result.remainingBuffer).toBe("data: partial");
    });

    it("should keep incomplete buffer when there are no complete events", () => {
        const result = sseEvent.splitEvents("event: one\ndata: partial");

        expect(result.events).toEqual([]);
        expect(result.remainingBuffer).toBe("event: one\ndata: partial");
    });

    it("should parse data, event and id fields", () => {
        const event = sseEvent.parseEvent("id: abc\nevent: message_delta\ndata: {\"type\":\"message_delta\"}");

        expect(event).toEqual({
            id: "abc",
            event: "message_delta",
            data: "{\"type\":\"message_delta\"}",
        });
    });

    it("should join multiple data lines", () => {
        const event = sseEvent.parseEvent("event: message\ndata: hello\ndata: world");

        expect(event?.data).toBe("hello\nworld");
    });

    it("should return null for events without data", () => {
        expect(sseEvent.parseEvent("event: ping")).toBeNull();
        expect(sseEvent.parseEvent("data:   ")).toBeNull();
    });

    it("should get JSON event type safely", () => {
        expect(sseEvent.getJsonEventType("{\"type\":\"response.completed\"}")).toBe("response.completed");
        expect(sseEvent.getJsonEventType("{ not json }")).toBeNull();
        expect(sseEvent.getJsonEventType("{\"foo\":\"bar\"}")).toBeNull();
    });

    it("should detect client stream completion by format", () => {
        expect(sseEvent.isClientStreamCompleted(ApiFormat.OPENAI, { data: "[DONE]" })).toBe(true);
        expect(sseEvent.isClientStreamCompleted(ApiFormat.OPENAI, { data: "{\"type\":\"message_stop\"}" })).toBe(false);
        expect(sseEvent.isClientStreamCompleted(ApiFormat.ANTHROPIC, {
            event: "message_stop",
            data: "{\"type\":\"message_stop\"}",
        })).toBe(true);
        expect(sseEvent.isClientStreamCompleted(ApiFormat.ANTHROPIC, {
            data: "{\"type\":\"message_stop\"}",
        })).toBe(true);
        expect(sseEvent.isClientStreamCompleted(ApiFormat.ANTHROPIC, {
            data: "{\"type\":\"message_delta\"}",
        })).toBe(false);
        expect(sseEvent.isClientStreamCompleted(ApiFormat.RESPONSES, {
            data: "{\"type\":\"response.completed\"}",
        })).toBe(false);
    });
});
