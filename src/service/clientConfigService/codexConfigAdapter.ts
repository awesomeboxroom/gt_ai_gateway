import type { ClientConfigStatus, CreateClientConfigParams, CurrentClientConfig, FileSystemApi, PathApi } from "./types";
import BaseConfigAdapter from "./baseConfigAdapter";
import configAdapterUtils from "./configAdapterUtils";
import tomlUtil from "../../util/tomlUtil";
import { ClientName } from "../../constants";


class CodexConfigAdapter extends BaseConfigAdapter {
    readonly authPath: string;
    readonly defaultGatewaySuffix = "/llm/v1";

    constructor(fs: FileSystemApi, path: PathApi, homeDir: string) {
        const codexHome = process.env.CODEX_HOME || path.join(homeDir, ".codex");
        super(
            fs,
            path,
            ClientName.CODEX,
            "Codex",
            path.join(codexHome, "config.toml"),
            [path.join(codexHome, "config.toml"), path.join(codexHome, "auth.json")],
        );
        this.authPath = this.configPaths[1];
    }

    private buildBaseUrl(params: CreateClientConfigParams): string {
        const url = params.gatewayUrl.replace(/\/+$/, "");
        if ((params.connectionMode || "gateway") === "vendor") {
            return url
                .replace(/\/responses\/?$/, "")
                .replace(/\/chat\/completions\/?$/, "");
        }
        return params.gatewayUrl;
    }


    async parseConfigContent(configContent: Record<string, string>): Promise<CurrentClientConfig | null> {
        const content = configContent[this.configPath] || "";
        if (!content) {
            return null;
        }

        const provider = tomlUtil.getTomlValue(content, "model_provider") || "";
        const providerTable = provider ? `model_providers.${provider}` : "";
        const backendUrl = providerTable ? tomlUtil.getTomlTableValue(content, providerTable, "base_url") || "" : "";
        const token = providerTable ? tomlUtil.getTomlTableValue(content, providerTable, "experimental_bearer_token") || "" : "";
        if (!provider || !backendUrl || !token) {
            return null;
        }

        return {
            configPath: this.configPath,
            connectionMode: backendUrl?.includes(this.defaultGatewaySuffix) ? "gateway" : "vendor",
            backendUrl,
            token,
            model: tomlUtil.getTomlValue(content, "model") || "",
            protocol: "responses",
        };
    }


    async getStatus(): Promise<ClientConfigStatus> {
        return await configAdapterUtils.buildClientStatus(this, this.fs);
    }


    async buildConfigContent(params: CreateClientConfigParams): Promise<Record<string, string>> {
        if (!(await this.isInstalled())) {
            throw new Error("Codex config directory not found");
        }

        let content = await this.readConfigFile();
        content = tomlUtil.upsertRootTomlValue(content, "model_provider", tomlUtil.buildTomlString("gt_ai_gateway"));

        if (params.model.trim()) {
            content = tomlUtil.upsertRootTomlValue(content, "model", tomlUtil.buildTomlString(params.model.trim()));
        }

        content = tomlUtil.upsertTomlTable(content, "model_providers.gt_ai_gateway", {
            name: tomlUtil.buildTomlString("GT AI Gateway"),
            base_url: tomlUtil.buildTomlString(this.buildBaseUrl(params)),
            wire_api: tomlUtil.buildTomlString("responses"),
            experimental_bearer_token: tomlUtil.buildTomlString(params.apiKey),
        });

        return {
            [this.configPath]: `${content.trim()}\n`,
        };
    }
}


export default CodexConfigAdapter;
