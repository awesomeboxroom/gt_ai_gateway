/**
 * Anthropic -> OpenAI 协议转换单元测试
 */

import { describe, it, expect, beforeEach } from "vitest";
import { AnthropicToOpenAIConverter } from "../../../src/util/protocolConverter/AnthropicToOpenAIConverter";
import { ConverterFactory } from "../../../src/util/protocolConverter/ConverterFactory";
import { ApiFormat } from "../../../src/constants";
import type { AnthropicRequest, AnthropicResponse, OpenAIRequest, ProtocolStreamEvent } from "../../../src/util/protocolConverter/protocolTypes";

function parseStreamEventData(events: ProtocolStreamEvent[], index: number = 0): any {
    return JSON.parse(events[index].data);
}

describe("AnthropicToOpenAIConverter - convertRequest", () => {
    let converter: AnthropicToOpenAIConverter;

    beforeEach(() => {
        converter = ConverterFactory.create(ApiFormat.ANTHROPIC, ApiFormat.OPENAI) as AnthropicToOpenAIConverter;
    });

    it("should convert a simple text message", () => {
        const anthropicReq: AnthropicRequest = {
            model: "claude-3-sonnet-20240229",
            max_tokens: 1024,
            messages: [
                { role: "user", content: "Hello, how are you?" },
            ],
        };

        const result = converter.convertRequest(anthropicReq) as OpenAIRequest;

        expect(result.model).toBe("claude-3-sonnet-20240229");
        expect(result.messages).toHaveLength(1);
        expect(result.messages[0].role).toBe("user");
        expect(result.messages[0].content).toBe("Hello, how are you?");
        expect(result.max_tokens).toBe(1024);
    });

    it("should convert system prompt from string to system message", () => {
        const anthropicReq: AnthropicRequest = {
            model: "claude-3-sonnet-20240229",
            max_tokens: 1024,
            system: "You are a helpful assistant.",
            messages: [
                { role: "user", content: "Hello" },
            ],
        };

        const result = converter.convertRequest(anthropicReq);

        expect(result.messages[0]).toEqual({
            role: "system",
            content: "You are a helpful assistant.",
        });
        expect(result.messages[1].role).toBe("user");
    });

    it("should convert system prompt from array to system message", () => {
        const anthropicReq: AnthropicRequest = {
            model: "claude-3-sonnet-20240229",
            max_tokens: 1024,
            system: [
                { type: "text", text: "You are a helpful assistant." },
                { type: "text", text: "Be concise." },
            ],
            messages: [
                { role: "user", content: "Hello" },
            ],
        };

        const result = converter.convertRequest(anthropicReq);

        expect(result.messages[0].role).toBe("system");
        expect(result.messages[0].content).toBe("You are a helpful assistant.\n\nBe concise.");
    });

    it("should convert Anthropic tools to OpenAI function calling format", () => {
        const anthropicReq: AnthropicRequest = {
            model: "claude-3-sonnet-20240229",
            max_tokens: 1024,
            messages: [{ role: "user", content: "What's the weather?" }],
            tools: [
                {
                    name: "get_weather",
                    description: "Get weather for a location",
                    input_schema: {
                        type: "object",
                        properties: {
                            location: { type: "string" },
                        },
                        required: ["location"],
                    },
                },
            ],
        };

        const result = converter.convertRequest(anthropicReq);

        expect(result.tools).toHaveLength(1);
        expect(result.tools![0]).toEqual({
            type: "function",
            function: {
                name: "get_weather",
                description: "Get weather for a location",
                parameters: {
                    type: "object",
                    properties: { location: { type: "string" } },
                    required: ["location"],
                },
            },
        });
    });

    it("should convert Anthropic tool_choice to OpenAI format", () => {
        const anthropicReq: AnthropicRequest = {
            model: "claude-3-sonnet-20240229",
            max_tokens: 1024,
            messages: [{ role: "user", content: "Hello" }],
            tool_choice: { type: "any" },
        };

        const result = converter.convertRequest(anthropicReq);
        expect(result.tool_choice).toBe("required");
    });

    it("should convert named Anthropic tool_choice to OpenAI function choice", () => {
        const anthropicReq: AnthropicRequest = {
            model: "claude-3-sonnet-20240229",
            max_tokens: 1024,
            messages: [{ role: "user", content: "Hello" }],
            tool_choice: { type: "tool", name: "get_weather" },
        };

        const result = converter.convertRequest(anthropicReq);
        expect(result.tool_choice).toEqual({
            type: "function",
            function: { name: "get_weather" },
        });
    });

    it("should include thinking blocks in assistant content", () => {
        const anthropicReq: AnthropicRequest = {
            model: "claude-3-sonnet-20240229",
            max_tokens: 1024,
            messages: [
                {
                    role: "assistant",
                    content: [
                        { type: "thinking", thinking: "reasoning" },
                        { type: "text", text: "answer" },
                    ],
                },
            ],
        };

        const result = converter.convertRequest(anthropicReq);
        expect(result.messages[0].content).toBe("<thinking>\nreasoning\n</thinking>\nanswer");
    });

    it("should convert assistant message with tool_use to OpenAI tool_calls", () => {
        const anthropicReq: AnthropicRequest = {
            model: "claude-3-sonnet-20240229",
            max_tokens: 1024,
            messages: [
                { role: "user", content: "What's the weather?" },
                {
                    role: "assistant",
                    content: [
                        { type: "text", text: "Let me check the weather." },
                        { type: "tool_use", id: "toolu_123", name: "get_weather", input: { location: "Tokyo" } },
                    ],
                },
            ],
        };

        const result = converter.convertRequest(anthropicReq);

        const assistantMsg = result.messages.find((m: any) => m.role === "assistant")!;
        expect(assistantMsg.content).toBe("Let me check the weather.");
        expect(assistantMsg.tool_calls).toHaveLength(1);
        expect(assistantMsg.tool_calls![0].id).toBe("toolu_123");
        expect(assistantMsg.tool_calls![0].function.name).toBe("get_weather");
        expect(assistantMsg.tool_calls![0].function.arguments).toBe('{"location":"Tokyo"}');
    });

    it("should convert tool_result content blocks to tool messages", () => {
        const anthropicReq: AnthropicRequest = {
            model: "claude-3-sonnet-20240229",
            max_tokens: 1024,
            messages: [
                { role: "user", content: "What's the weather?" },
                {
                    role: "assistant",
                    content: [
                        { type: "tool_use", id: "toolu_123", name: "get_weather", input: { location: "Tokyo" } },
                    ],
                },
                {
                    role: "user",
                    content: [
                        { type: "tool_result", tool_use_id: "toolu_123", content: "Sunny, 25°C" },
                    ],
                },
            ],
        };

        const result = converter.convertRequest(anthropicReq);

        const toolMsg = result.messages.find((m: any) => m.role === "tool")!;
        expect(toolMsg.content).toBe("Sunny, 25°C");
        expect(toolMsg.tool_call_id).toBe("toolu_123");
    });

    it("should convert stop_sequences to stop", () => {
        const anthropicReq: AnthropicRequest = {
            model: "claude-3-sonnet-20240229",
            max_tokens: 1024,
            messages: [{ role: "user", content: "Hello" }],
            stop_sequences: ["END", "STOP"],
        };

        const result = converter.convertRequest(anthropicReq);
        expect(result.stop).toEqual(["END", "STOP"]);
    });
});

// ============================================================
// 请求转换：OpenAI → Anthropic
// ============================================================

describe("AnthropicToOpenAIConverter - convertResponse", () => {
    let converter: AnthropicToOpenAIConverter;

    beforeEach(() => {
        converter = ConverterFactory.create(ApiFormat.ANTHROPIC, ApiFormat.OPENAI) as AnthropicToOpenAIConverter;
    });

    it("should convert a simple text response", () => {
        const anthropicRes: AnthropicResponse = {
            id: "msg_123",
            type: "message",
            role: "assistant",
            content: [{ type: "text", text: "Hello! How can I help you?" }],
            model: "claude-3-sonnet-20240229",
            stop_reason: "end_turn",
            usage: { input_tokens: 10, output_tokens: 20 },
        };

        const result = converter.convertResponse(anthropicRes);

        expect(result.object).toBe("chat.completion");
        expect(result.choices[0].message.content).toBe("Hello! How can I help you?");
        expect(result.choices[0].message.role).toBe("assistant");
        expect(result.choices[0].finish_reason).toBe("stop");
        expect(result.usage.prompt_tokens).toBe(10);
        expect(result.usage.completion_tokens).toBe(20);
        expect(result.usage.total_tokens).toBe(30);
    });

    it("should convert tool_use response", () => {
        const anthropicRes: AnthropicResponse = {
            id: "msg_123",
            type: "message",
            role: "assistant",
            content: [
                { type: "text", text: "Let me check." },
                { type: "tool_use", id: "toolu_123", name: "get_weather", input: { location: "Tokyo" } },
            ],
            model: "claude-3-sonnet-20240229",
            stop_reason: "tool_use",
            usage: { input_tokens: 10, output_tokens: 20 },
        };

        const result = converter.convertResponse(anthropicRes);

        expect(result.choices[0].message.content).toBe("Let me check.");
        expect(result.choices[0].message.tool_calls).toHaveLength(1);
        expect(result.choices[0].message.tool_calls![0].id).toBe("toolu_123");
        expect(result.choices[0].message.tool_calls![0].function.name).toBe("get_weather");
        expect(result.choices[0].finish_reason).toBe("tool_calls");
    });

    it("should map stop reasons correctly", () => {
        const testCases = [
            { stop_reason: "end_turn", expected: "stop" },
            { stop_reason: "max_tokens", expected: "length" },
            { stop_reason: "tool_use", expected: "tool_calls" },
        ] as const;

        for (const { stop_reason, expected } of testCases) {
            const res: AnthropicResponse = {
                id: "msg_123",
                type: "message",
                role: "assistant",
                content: [{ type: "text", text: "test" }],
                model: "claude-3-sonnet-20240229",
                stop_reason: stop_reason,
                usage: { input_tokens: 0, output_tokens: 0 },
            };
            const result = converter.convertResponse(res);
            expect(result.choices[0].finish_reason).toBe(expected);
        }
    });

    it("should handle thinking blocks as reasoning_content", () => {
        const anthropicRes: AnthropicResponse = {
            id: "msg_123",
            type: "message",
            role: "assistant",
            content: [
                { type: "thinking", thinking: "Let me think about this..." },
                { type: "text", text: "Here's my answer." },
            ],
            model: "claude-3-sonnet-20240229",
            stop_reason: "end_turn",
            usage: { input_tokens: 10, output_tokens: 20 },
        };

        const result = converter.convertResponse(anthropicRes);
        expect(result.choices[0].message.reasoning_content).toBe("Let me think about this...");
        expect(result.choices[0].message.content).toBe("Here's my answer.");
    });

    it("should use provided request id when converting response", () => {
        const anthropicRes: AnthropicResponse = {
            id: "msg_original",
            type: "message",
            role: "assistant",
            content: [{ type: "text", text: "Hello" }],
            model: "claude-3-sonnet-20240229",
            stop_reason: "end_turn",
            usage: { input_tokens: 1, output_tokens: 2 },
        };

        const result = converter.convertResponse(anthropicRes, "custom-id");
        expect(result.id).toBe("chatcmpl-custom-id");
    });

    it("should return null content for tool-only response", () => {
        const anthropicRes: AnthropicResponse = {
            id: "msg_123",
            type: "message",
            role: "assistant",
            content: [
                { type: "tool_use", id: "toolu_123", name: "get_weather", input: { location: "Tokyo" } },
            ],
            model: "claude-3-sonnet-20240229",
            stop_reason: "tool_use",
            usage: { input_tokens: 10, output_tokens: 20 },
        };

        const result = converter.convertResponse(anthropicRes);
        expect(result.choices[0].message.content).toBeNull();
        expect(result.choices[0].message.tool_calls).toHaveLength(1);
    });
});

// ============================================================
// 非流式响应转换：OpenAI → Anthropic
// ============================================================

describe("AnthropicToOpenAIConverter - convertStreamEvent", () => {
    let converter: AnthropicToOpenAIConverter;

    beforeEach(() => {
        converter = ConverterFactory.create(ApiFormat.ANTHROPIC, ApiFormat.OPENAI, "claude-3-sonnet-20240229") as AnthropicToOpenAIConverter;
    });

    it("should convert message_start to initial chunk", () => {
        const events = converter.convertStreamEvent(JSON.stringify({
            type: "message_start",
            message: {
                id: "msg_123",
                type: "message",
                role: "assistant",
                content: [],
                model: "claude-3-sonnet-20240229",
                stop_reason: null,
                usage: { input_tokens: 10, output_tokens: 0 },
            },
        }));
        
        const chunk = parseStreamEventData(events);
        expect(chunk.choices[0].delta.role).toBe("assistant");
        expect(chunk.model).toBe("claude-3-sonnet-20240229");
    });

    it("should convert text_delta events", () => {
        // Start message
        converter.convertStreamEvent(JSON.stringify({
            type: "message_start",
            message: { id: "msg_123", role: "assistant", model: "claude-3-sonnet-20240229" },
        }));

        // content_block_start
        converter.convertStreamEvent(JSON.stringify({
            type: "content_block_start",
            index: 0,
            content_block: { type: "text", text: "" },
        }));

        // content_block_delta
        const events = converter.convertStreamEvent(JSON.stringify({
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "Hello" },
        }));
        const chunk = parseStreamEventData(events);

        expect(chunk.choices[0].delta.content).toBe("Hello");
    });

    it("should convert thinking_delta events to reasoning_content", () => {
        converter.convertStreamEvent(JSON.stringify({
            type: "message_start",
            message: { id: "msg_123", role: "assistant", model: "claude-3-sonnet-20240229" },
        }));

        const startEvents = converter.convertStreamEvent(JSON.stringify({
            type: "content_block_start",
            index: 0,
            content_block: { type: "thinking", thinking: "" },
        }));
        const deltaEvents = converter.convertStreamEvent(JSON.stringify({
            type: "content_block_delta",
            index: 0,
            delta: { type: "thinking_delta", thinking: "reasoning" },
        }));

        expect(parseStreamEventData(startEvents).choices[0].delta.reasoning_content).toBe("");
        expect(parseStreamEventData(deltaEvents).choices[0].delta.reasoning_content).toBe("reasoning");
    });

    it("should convert tool_use stream events to OpenAI tool call deltas", () => {
        converter.convertStreamEvent(JSON.stringify({
            type: "message_start",
            message: { id: "msg_123", role: "assistant", model: "claude-3-sonnet-20240229" },
        }));

        const startEvents = converter.convertStreamEvent(JSON.stringify({
            type: "content_block_start",
            index: 0,
            content_block: { type: "tool_use", id: "toolu_123", name: "get_weather", input: {} },
        }));
        const deltaEvents = converter.convertStreamEvent(JSON.stringify({
            type: "content_block_delta",
            index: 0,
            delta: { type: "input_json_delta", partial_json: "{\"location\"" },
        }));

        const toolStart = parseStreamEventData(startEvents).choices[0].delta.tool_calls[0];
        expect(toolStart).toMatchObject({
            index: 0,
            id: "toolu_123",
            type: "function",
            function: { name: "get_weather", arguments: "" },
        });

        const toolDelta = parseStreamEventData(deltaEvents).choices[0].delta.tool_calls[0];
        expect(toolDelta.index).toBe(0);
        expect(toolDelta.function.arguments).toBe("{\"location\"");
    });

    it("should convert message_delta finish_reason", () => {
        const events = converter.convertStreamEvent(JSON.stringify({
            type: "message_delta",
            delta: { stop_reason: "end_turn" },
            usage: { output_tokens: 50 },
        }));
        
        const finalChunk = parseStreamEventData(events);
        expect(finalChunk.choices[0].finish_reason).toBe("stop");
    });

    it("should convert message_stop to OpenAI DONE event", () => {
        const events = converter.convertStreamEvent(JSON.stringify({ type: "message_stop" }));

        expect(events).toEqual([{ data: "[DONE]" }]);
    });

    it("should return no events for unsupported Anthropic stream event", () => {
        const events = converter.convertStreamEvent(JSON.stringify({ type: "ping" }));

        expect(events).toEqual([]);
    });
});
