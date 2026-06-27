import type { ClientConfigFileContent, ClientConfigContent, FileSystemApi, PathApi } from "./types";
import BaseConfigAdapter from "./baseConfigAdapter";
import tomlUtil from "../../util/tomlUtil";
import { ClientName, ConnectionMode, ApiFormat } from "../../constants";


class CodexConfigAdapter extends BaseConfigAdapter {
    readonly authPath: string;
    readonly protocol: ApiFormat = ApiFormat.RESPONSES;
    readonly defaultGatewaySuffix = "/llm/v1";

    constructor(fs: FileSystemApi, path: PathApi, homeDir: string) {
        const codexHome = process.env.CODEX_HOME || path.join(homeDir, ".codex");
        super(
            fs,
            path,
            ClientName.CODEX,
            "Codex",
            [path.join(codexHome, "config.toml"), path.join(codexHome, "auth.json")]
        );
        this.authPath = this.configPaths[1];
    }

    private buildBaseUrl(fields: ClientConfigContent): string {
        const url = fields.gatewayUrl.replace(/\/+$/, "");
        if ((fields.connectionMode || ConnectionMode.GATEWAY) === ConnectionMode.VENDOR) {
            return url
                .replace(/\/responses\/?$/, "")
                .replace(/\/chat\/completions\/?$/, "");
        }
        if (url.endsWith(this.defaultGatewaySuffix)) {
            return url;
        }
        return `${url}${this.defaultGatewaySuffix}`;
    }

    parseConfigContent(configContent: ClientConfigFileContent): ClientConfigContent | null {
        const content = configContent[this.configPaths[0]] || "";
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
            connectionMode: this.isGatewayUrl(backendUrl) ? ConnectionMode.GATEWAY : ConnectionMode.VENDOR,
            gatewayUrl: backendUrl,
            apiKey: token,
            model: tomlUtil.getTomlValue(content, "model") || "",
        };
    }

    patchConfigContent(configContent: ClientConfigFileContent, fields: ClientConfigContent): ClientConfigFileContent {
        let content = configContent[this.configPaths[0]] || "";
        content = tomlUtil.upsertRootTomlValue(content, "model_provider", tomlUtil.buildTomlString("gt_ai_gateway"));

        if (fields.model.trim()) {
            content = tomlUtil.upsertRootTomlValue(content, "model", tomlUtil.buildTomlString(fields.model.trim()));
        }

        content = tomlUtil.upsertTomlTable(content, "model_providers.gt_ai_gateway", {
            name: tomlUtil.buildTomlString("GT AI Gateway"),
            base_url: tomlUtil.buildTomlString(this.buildBaseUrl(fields)),
            wire_api: tomlUtil.buildTomlString("responses"),
            experimental_bearer_token: tomlUtil.buildTomlString(fields.apiKey),
        });

        return {
            ...configContent,
            [this.configPaths[0]]: `${content.trim()}\n`,
        };
    }
}


export default CodexConfigAdapter;
