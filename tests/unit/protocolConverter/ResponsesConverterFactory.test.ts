/**
 * Responses API ↔ Anthropic 协议转换单元测试
 *
 * 覆盖：
 * - ResponsesToAnthropicConverter: 请求转换、非流式响应转换、流式事件转换
 * - AnthropicToResponsesConverter: 请求转换、非流式响应转换、流式事件转换
 * - ConverterFactory: Responses ↔ Anthropic 路由
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ResponsesToAnthropicConverter } from "../../../src/util/protocolConverter/ResponsesToAnthropicConverter";
import { AnthropicToResponsesConverter } from "../../../src/util/protocolConverter/AnthropicToResponsesConverter";
import { ConverterFactory } from "../../../src/util/protocolConverter/ConverterFactory";
import { ReasoningEffort } from "../../../src/util/protocolConverter/thinkingConfig";
import { ApiFormat } from "../../../src/constants";
import type {
    AnthropicRequest,
    AnthropicResponse,
    AnthropicContentBlock,
    ProtocolStreamEvent,
} from "../../../src/util/protocolConverter/protocolTypes";
import type {
    ResponsesRequest,
    ResponsesNonStreamResponse,
    ResponsesInputItem,
} from "../../../src/util/protocolConverter/responsesTypes";

function parseStreamEventData(events: ProtocolStreamEvent[], index: number = 0): any {
    return JSON.parse(events[index].data);
}

// ============================================================
// ============================================================

describe("ConverterFactory - Responses ↔ Anthropic routing", () => {
    it("should create ResponsesToAnthropicConverter for RESPONSES → ANTHROPIC", () => {
        const converter = ConverterFactory.create(ApiFormat.RESPONSES, ApiFormat.ANTHROPIC);
        expect(converter).toBeInstanceOf(ResponsesToAnthropicConverter);
    });

    it("should create AnthropicToResponsesConverter for ANTHROPIC → RESPONSES", () => {
        const converter = ConverterFactory.create(ApiFormat.ANTHROPIC, ApiFormat.RESPONSES);
        expect(converter).toBeInstanceOf(AnthropicToResponsesConverter);
    });

    it("should return null for same format", () => {
        expect(ConverterFactory.create(ApiFormat.RESPONSES, ApiFormat.RESPONSES)).toBeNull();
    });

    it("should create pair converter for RESPONSES ↔ ANTHROPIC", () => {
        const pair = ConverterFactory.createPair(ApiFormat.RESPONSES, ApiFormat.ANTHROPIC);
        expect(pair).not.toBeNull();
    });

    it("should convert Anthropic client requests and Responses upstream responses through pair converter", () => {
        const pair = ConverterFactory.createPair(ApiFormat.ANTHROPIC, ApiFormat.RESPONSES);
        expect(pair).not.toBeNull();

        const upstreamReq = pair!.convertRequest({
            model: "gpt-5.5",
            max_tokens: 1024,
            messages: [{ role: "user", content: "你好" }],
        });
        expect(upstreamReq.input[0].content[0].type).toBe("input_text");

        const clientRes = pair!.convertResponse({
            id: "resp_123",
            object: "response",
            created_at: 1677652288,
            status: "completed",
            model: "ppio/pa/gpt-5.5",
            output: [
                {
                    type: "message",
                    id: "msg_0",
                    role: "assistant",
                    status: "completed",
                    content: [{ type: "output_text", text: "你好！" }],
                },
            ],
            usage: {
                input_tokens: 10,
                input_tokens_details: { cached_tokens: 4 },
                output_tokens: 2,
                total_tokens: 12,
            },
        });

        expect(clientRes.type).toBe("message");
        expect(clientRes.content[0]).toEqual({ type: "text", text: "你好！" });
        expect(clientRes.usage).toEqual({ input_tokens: 6, output_tokens: 2, cache_read_input_tokens: 4 });
    });

    it("should convert Responses client requests and Anthropic upstream responses through pair converter", () => {
        const pair = ConverterFactory.createPair(ApiFormat.RESPONSES, ApiFormat.ANTHROPIC);
        expect(pair).not.toBeNull();

        const upstreamReq = pair!.convertRequest({
            model: "claude-3-sonnet-20240229",
            input: [
                {
                    type: "message",
                    role: "user",
                    content: [{ type: "input_text", text: "hello" }],
                },
            ],
        });
        expect(upstreamReq.messages[0].content[0]).toEqual({ type: "text", text: "hello" });

        const clientRes = pair!.convertResponse({
            id: "msg_123",
            type: "message",
            role: "assistant",
            content: [{ type: "text", text: "Hello!" }],
            model: "claude-3-sonnet-20240229",
            stop_reason: "end_turn",
            usage: { input_tokens: 10, output_tokens: 2 },
        });

        expect(clientRes.object).toBe("response");
        expect(clientRes.output[0].type).toBe("message");
        expect((clientRes.output[0] as any).content[0].text).toBe("Hello!");
    });

    it("should still create Anthropic ↔ OpenAI converters", () => {
        const a2o = ConverterFactory.create(ApiFormat.ANTHROPIC, ApiFormat.OPENAI);
        const o2a = ConverterFactory.create(ApiFormat.OPENAI, ApiFormat.ANTHROPIC);
        expect(a2o).not.toBeNull();
        expect(o2a).not.toBeNull();
    });
});
