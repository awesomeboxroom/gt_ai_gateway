import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import responsesAccumulator from "../../src/util/responsesAccumulator";

function requireFixture(fileName: string): string {
    const logFile = join(__dirname, "..", "resource", "stream_logs", fileName);

    if (!existsSync(logFile)) {
        throw new Error(`Fixture not found: ${logFile}`);
    }

    return readFileSync(logFile, "utf-8");
}

function parseResponsesStream(content: string) {
    const accumulator = new responsesAccumulator.ResponsesAccumulator();
    const lines = content.split("\n").filter((line) => line.startsWith("data:"));

    for (const line of lines) {
        const data = line.slice(5).trim();
        if (!data) continue;

        try {
            accumulator.addEvent(JSON.parse(data));
        } catch {
            // ignore unparseable lines
        }
    }

    return accumulator;
}

describe("ResponsesAccumulator", () => {
    describe("fixture: responses-stream.log", () => {
        it("parses response id and model", () => {
            const acc = parseResponsesStream(requireFixture("responses-stream.log"));
            const response = acc.getResponse();

            expect(response.id).toBe("resp_abc123");
            expect(response.model).toBe("gpt-4o");
            expect(response.object).toBe("response");
        });

        it("parses response status as completed", () => {
            const acc = parseResponsesStream(requireFixture("responses-stream.log"));
            const response = acc.getResponse();

            expect(response.status).toBe("completed");
            expect(acc.isCompleted()).toBe(true);
        });

        it("parses output text content", () => {
            const acc = parseResponsesStream(requireFixture("responses-stream.log"));
            const response = acc.getResponse();

            expect(response.output).toHaveLength(1);
            expect(response.output[0].role).toBe("assistant");
            expect(response.output[0].content).toHaveLength(1);
            expect(response.output[0].content[0].type).toBe("output_text");
            expect(response.output[0].content[0].text).toBe("Hello! How can I help you?");
        });

        it("parses usage tokens", () => {
            const acc = parseResponsesStream(requireFixture("responses-stream.log"));
            const response = acc.getResponse();

            expect(response.usage?.input_tokens).toBe(10);
            expect(response.usage?.output_tokens).toBe(8);
            expect(response.usage?.total_tokens).toBe(18);
            expect(response.usage?.input_tokens_details?.cached_tokens).toBe(0);
            expect(response.usage?.output_tokens_details?.reasoning_tokens).toBe(0);
            expect(acc.getUsage()).toEqual(response.usage);
        });

        it("getText() returns plain text of first output item", () => {
            const acc = parseResponsesStream(requireFixture("responses-stream.log"));
            expect(acc.getText()).toBe("Hello! How can I help you?");
        });
    });

    describe("incremental text accumulation", () => {
        it("accumulates delta text before response.completed arrives", () => {
            const acc = new responsesAccumulator.ResponsesAccumulator();

            acc.addEvent({ type: "response.created", response: { id: "r1", model: "gpt-4o", object: "response", status: "in_progress" } });
            acc.addEvent({ type: "response.output_item.added", output_index: 0, item: { id: "m1", type: "message", role: "assistant", status: "in_progress" } });
            acc.addEvent({ type: "response.content_part.added", output_index: 0, content_index: 0, part: { type: "output_text", text: "", annotations: [] } });
            acc.addEvent({ type: "response.output_text.delta", output_index: 0, content_index: 0, delta: "Hello" });
            acc.addEvent({ type: "response.output_text.delta", output_index: 0, content_index: 0, delta: " world" });

            // response.completed 还未到达，getText() 已可使用
            expect(acc.getText()).toBe("Hello world");
        });

        it("output_text.done overwrites incremental text", () => {
            const acc = new responsesAccumulator.ResponsesAccumulator();

            acc.addEvent({ type: "response.output_item.added", output_index: 0, item: { role: "assistant" } });
            acc.addEvent({ type: "response.output_text.delta", output_index: 0, content_index: 0, delta: "partia" });
            acc.addEvent({ type: "response.output_text.delta", output_index: 0, content_index: 0, delta: "l" });
            // done 事件携带权威完整文本
            acc.addEvent({ type: "response.output_text.done", output_index: 0, content_index: 0, text: "partial" });

            expect(acc.getResponse().output[0].content[0].text).toBe("partial");
        });
    });

    describe("stream state", () => {
        it("marks stream completed on response.completed", () => {
            const acc = new responsesAccumulator.ResponsesAccumulator();

            acc.addEvent({
                type: "response.completed",
                response: {
                    id: "r1",
                    object: "response",
                    status: "completed",
                    output: [],
                    usage: {
                        input_tokens: 2,
                        output_tokens: 3,
                        total_tokens: 5,
                    },
                },
            });

            expect(acc.isCompleted()).toBe(true);
            expect(acc.isErrored()).toBe(false);
            expect(acc.getUsage()).toEqual({
                input_tokens: 2,
                output_tokens: 3,
                total_tokens: 5,
            });
        });

        it("marks event:error payload as errored", () => {
            const acc = new responsesAccumulator.ResponsesAccumulator();
            const errorPayload = {
                type: "error",
                error: {
                    type: "rate_limit_error",
                    code: "1302",
                    message: "rate limited",
                },
            };

            acc.addEvent(errorPayload, "error");

            expect(acc.isCompleted()).toBe(false);
            expect(acc.isErrored()).toBe(true);
            expect(acc.getError()).toEqual(errorPayload);
        });

        it("marks response.failed as errored", () => {
            const acc = new responsesAccumulator.ResponsesAccumulator();
            const failedPayload = {
                type: "response.failed",
                response: {
                    id: "r1",
                    status: "failed",
                    error: {
                        code: "server_error",
                        message: "upstream failed",
                    },
                },
            };

            acc.addEvent(failedPayload);

            expect(acc.isErrored()).toBe(true);
            expect(acc.getError()).toEqual(failedPayload);
        });
    });

    describe("reset()", () => {
        it("clears all accumulated state", () => {
            const acc = new responsesAccumulator.ResponsesAccumulator();

            acc.addEvent({ type: "response.created", response: { id: "r1", model: "gpt-4o" } });
            acc.addEvent({ type: "error", error: { message: "failed" } }, "error");
            acc.reset();

            const response = acc.getResponse();
            expect(response.id).toBeUndefined();
            expect(response.model).toBeUndefined();
            expect(response.output).toHaveLength(0);
            expect(acc.isCompleted()).toBe(false);
            expect(acc.isErrored()).toBe(false);
            expect(acc.getError()).toBeNull();
        });
    });
});
