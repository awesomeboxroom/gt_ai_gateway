import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import chatAccumulator from "../../src/util/chatAccumulator";

function requireFixture(fileName: string): string {
    const logFile = join(__dirname, "..", "resource", "stream_logs", fileName);

    if (!existsSync(logFile)) {
        throw new Error(`Fixture not found: ${logFile}`);
    }

    return readFileSync(logFile, "utf-8");
}

function parseOpenAIStream(content: string) {
    const accumulator = new chatAccumulator.OpenAIChatAccumulator("openai");
    const events = content.split("\n\n").filter((event) => event.trim());

    for (const event of events) {
        const dataMatch = event.match(/^data:\s*(.+)$/m);
        if (!dataMatch) continue;

        accumulator.addEvent({ data: dataMatch[1] });
    }

    return accumulator.getResponse();
}

function parseAnthropicStream(content: string) {
    const accumulator = new chatAccumulator.OpenAIChatAccumulator("anthropic");
    const events = content.split("\n\n").filter((event) => event.trim());

    for (const event of events) {
        const lines = event.split("\n");
        let data = "";
        let eventType = "";

        for (const line of lines) {
            if (line.startsWith("data:")) {
                data = line.slice(5).trim();
            } else if (line.startsWith("event:")) {
                eventType = line.slice(6).trim();
            }
        }

        if (!data) continue;

        accumulator.addEvent({ data, event: eventType });
    }

    return accumulator.getResponse();
}

describe("SSE Accumulator Fixtures", () => {
    it("parses openai non-tool stream fixture", () => {
        const response = parseOpenAIStream(requireFixture("openai-stream.log"));

        expect(response.object).toBe("chat.completion.chunk");
        expect(response.model).toBe("gpt-3.5-turbo");
        expect(response.choices).toHaveLength(1);
        expect(response.choices[0].message.role).toBe("assistant");
        expect(response.choices[0].message.content).toBe(
            "Hello! I am a mock AI assistant. How can I help you?",
        );
        expect(response.choices[0].finish_reason).toBe("stop");
        expect(response.usage?.prompt_tokens).toBe(8);
        expect(response.usage?.completion_tokens).toBe(12);
    });

    it("parses openai tool-call stream fixture", () => {
        const response = parseOpenAIStream(requireFixture("openai-tool-call-stream.log"));
        const toolCalls = response.choices[0].message.tool_calls ?? [];

        expect(response.object).toBe("chat.completion.chunk");
        expect(response.model).toBe("glm-4.7");
        expect(response.choices[0].message.role).toBe("assistant");
        expect(response.choices[0].finish_reason).toBe("tool_calls");
        expect(toolCalls).toHaveLength(1);
        expect(toolCalls[0].type).toBe("function");
        expect(toolCalls[0].function.name).toBe("get_weather");
        expect(toolCalls[0].function.arguments).toBe(
            "{\"city\": \"上海\", \"unit\": \"celsius\"}",
        );
        expect(toolCalls[0].id).toBeTruthy();
        expect(response.usage?.prompt_tokens).toBe(197);
        expect(response.usage?.completion_tokens).toBe(76);
    });

    it("parses anthropic non-tool stream fixture", () => {
        const response = parseAnthropicStream(requireFixture("anthropic-stream.log"));

        expect(response.model).toBe("glm-4.7");
        expect(response.choices).toHaveLength(1);
        expect(response.choices[0].message.role).toBe("assistant");
        expect(response.choices[0].message.content.length).toBeGreaterThan(0);
        expect(response.choices[0].message.thinking?.length).toBeGreaterThan(0);
        expect(response.choices[0].finish_reason).toBe("max_tokens");
        expect(response.usage?.prompt_tokens).toBe(6);
        expect(response.usage?.completion_tokens).toBe(223);
    });

    it("parses openai reasoning stream fixture", () => {
        const response = parseOpenAIStream(requireFixture("openai-reasoning-stream.log"));

        expect(response.object).toBe("chat.completion.chunk");
        expect(response.model).toBe("qwen3.6-plus");
        expect(response.choices).toHaveLength(1);
        expect(response.choices[0].message.role).toBe("assistant");
        expect(response.choices[0].message.reasoning_content?.length).toBeGreaterThan(0);
        expect(response.choices[0].message.content.length).toBeGreaterThan(0);
        expect(response.choices[0].finish_reason).toBe("stop");
        expect(response.usage?.completion_tokens_details?.reasoning_tokens).toBeGreaterThan(0);
    });

    it("parses anthropic tool-use stream fixture", () => {
        const response = parseAnthropicStream(requireFixture("anthropic-tool-use-stream.log"));
        const toolUseList = response.choices[0].message.tool_use ?? [];
        const actualToolUse = toolUseList.find((item) => item?.name === "get_weather");

        expect(response.model).toBe("glm-4.7");
        expect(response.choices[0].message.role).toBe("assistant");
        expect(response.choices[0].finish_reason).toBe("tool_use");
        expect(actualToolUse).toBeDefined();
        expect(actualToolUse?.id).toBeTruthy();
        expect(actualToolUse?.input).toEqual({
            city: "上海",
            unit: "celsius",
        });
        expect(actualToolUse?.input_json).toBe(
            "{\"city\": \"上海\", \"unit\": \"celsius\"}",
        );
        expect(response.usage?.prompt_tokens).toBe(197);
        expect(response.usage?.completion_tokens).toBe(77);
    });
});

describe("OpenAIChatAccumulator stream state", () => {
    it("marks completed on [DONE] (openai)", () => {
        const acc = new chatAccumulator.OpenAIChatAccumulator("openai");
        acc.addEvent({ data: JSON.stringify({ choices: [{ delta: { content: "hi" } }] }) });
        acc.addEvent({ data: "[DONE]" });

        expect(acc.isCompleted()).toBe(true);
        expect(acc.isOutputStarted()).toBe(true);
        expect(acc.isErrored()).toBe(false);
    });

    it("marks completed on message_stop (anthropic)", () => {
        const acc = new chatAccumulator.OpenAIChatAccumulator("anthropic");
        acc.addEvent({ data: JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "hi" } }), event: "content_block_delta" });
        acc.addEvent({ data: JSON.stringify({ type: "message_stop" }), event: "message_stop" });

        expect(acc.isCompleted()).toBe(true);
        expect(acc.isOutputStarted()).toBe(true);
    });

    it("does not flag output started on lifecycle events", () => {
        const acc = new chatAccumulator.OpenAIChatAccumulator("anthropic");
        acc.addEvent({ data: JSON.stringify({ type: "message_start", message: { id: "m1", model: "claude" } }), event: "message_start" });

        // message_start 是非完成/非错误事件，按现行 TTFT 语义仍计为 outputStarted
        expect(acc.isOutputStarted()).toBe(true);
        expect(acc.isCompleted()).toBe(false);
    });

    it("marks errored on error event", () => {
        const acc = new chatAccumulator.OpenAIChatAccumulator("openai");
        acc.addEvent({ data: JSON.stringify({ type: "error", error: { message: "rate limited" } }) });

        expect(acc.isErrored()).toBe(true);
        expect(acc.isCompleted()).toBe(false);
        expect(acc.getError()).toMatchObject({ type: "error" });
    });

    it("marks errored on SSE event:error envelope", () => {
        const acc = new chatAccumulator.OpenAIChatAccumulator("anthropic");
        acc.addEvent({ data: JSON.stringify({ type: "error", error: { message: "rate limited" } }), event: "error" });

        expect(acc.isErrored()).toBe(true);
    });

    it("getUsage returns accumulated usage", () => {
        const acc = new chatAccumulator.OpenAIChatAccumulator("openai");
        acc.addEvent({ data: JSON.stringify({ choices: [{ delta: { content: "hi" }, finish_reason: "stop" }], usage: { prompt_tokens: 5, completion_tokens: 3 } }) });

        expect(acc.getUsage()?.prompt_tokens).toBe(5);
        expect(acc.getUsage()?.completion_tokens).toBe(3);
    });

    it("reset clears all state", () => {
        const acc = new chatAccumulator.OpenAIChatAccumulator("openai");
        acc.addEvent({ data: JSON.stringify({ choices: [{ delta: { content: "hi" } }] }) });
        acc.addEvent({ data: "[DONE]" });
        acc.reset();

        expect(acc.isCompleted()).toBe(false);
        expect(acc.isOutputStarted()).toBe(false);
        expect(acc.isErrored()).toBe(false);
        expect(acc.getError()).toBeNull();
        expect(acc.getResponse().choices[0].message.content).toBe("");
    });
});
