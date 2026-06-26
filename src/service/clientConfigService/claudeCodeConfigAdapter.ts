import type { ClientConfigStatus, CreateClientConfigParams, CurrentClientConfig, FileSystemApi, PathApi } from "./types";
import BaseConfigAdapter from "./baseConfigAdapter";
import configAdapterUtils from "./configAdapterUtils";
import { ClientName } from "../../constants";


class ClaudeCodeConfigAdapter extends BaseConfigAdapter {
    readonly defaultGatewaySuffix = "/llm";

    constructor(fs: FileSystemApi, path: PathApi, homeDir: string) {
        super(fs, path, ClientName.CLAUDE_CODE, "Claude Code", path.join(homeDir, ".claude", "settings.json"));
    }

    private buildBaseUrl(params: CreateClientConfigParams): string {
        const url = params.gatewayUrl.replace(/\/+$/, "");
        if ((params.connectionMode || "gateway") === "vendor") {
            return url
                .replace(/\/v1\/messages\/?$/, "")
                .replace(/\/v1\/?$/, "");
        }
        return params.gatewayUrl;
    }


    async parseConfigContent(configContent: Record<string, string>): Promise<CurrentClientConfig | null> {
        const content = configContent[this.configPath] || "";
        if (!content) {
            return null;
        }

        const config = configAdapterUtils.parseJsonConfig(content);
        const backendUrl = config.env?.ANTHROPIC_BASE_URL || "";
        const token = config.env?.ANTHROPIC_AUTH_TOKEN || config.env?.ANTHROPIC_API_KEY || "";
        if (!backendUrl || !token) {
            return null;
        }

        return {
            configPath: this.configPath,
            connectionMode: config.env?.ANTHROPIC_BASE_URL?.includes(this.defaultGatewaySuffix) ? "gateway" : "vendor", // Approximate deduction
            backendUrl,
            token,
            model: config.env?.ANTHROPIC_MODEL || config.env?.CLAUDE_CODE_SUBAGENT_MODEL || config.model || "",
            protocol: "anthropic",
        };
    }


    async getStatus(): Promise<ClientConfigStatus> {
        return await configAdapterUtils.buildClientStatus(this, this.fs);
    }


    async buildConfigContent(params: CreateClientConfigParams): Promise<Record<string, string>> {
        if (!(await this.isInstalled())) {
            throw new Error("Claude Code config directory not found");
        }

        const config = configAdapterUtils.parseJsonConfig(await this.readConfigFile());
        config.env = {
            ...(config.env || {}),
            ANTHROPIC_BASE_URL: this.buildBaseUrl(params),
            ANTHROPIC_AUTH_TOKEN: params.apiKey,
        };
        
        // Remove old deprecated configs
        delete config.model;
        delete config.env.CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY;

        if (params.model.trim()) {
            const model = params.model.trim();
            config.env.ANTHROPIC_MODEL = model;
            config.env.ANTHROPIC_DEFAULT_OPUS_MODEL = model;
            config.env.ANTHROPIC_DEFAULT_SONNET_MODEL = model;
            config.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = model;
            config.env.CLAUDE_CODE_SUBAGENT_MODEL = model;
        }

        if (params.effortLevel?.trim()) {
            config.env.CLAUDE_CODE_EFFORT_LEVEL = params.effortLevel.trim();
        }

        return {
            [this.configPath]: `${JSON.stringify(config, null, 4)}\n`,
        };
    }
}


export default ClaudeCodeConfigAdapter;
