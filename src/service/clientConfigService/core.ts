import ormService from "../ormService";
import SgClientConfigBackup from "../../model/sgClientConfigBackup";
import type {
    ApplyClientConfigParams,
    ClientConfigBackupInfo,
    ClientConfigStatus,
    ClientConfigStatusResponse,
    ClientName,
    ConfigAdapter,
    CreateClientConfigBackupParams,
    CreateClientConfigParams,
    DeleteClientConfigBackupParams,
    FileSystemApi,
    PathApi,
    RenameClientConfigBackupParams,
    CurrentClientConfig,
} from "./types";
import ClaudeCodeConfigAdapter from "./claudeCodeConfigAdapter";
import CodexConfigAdapter from "./codexConfigAdapter";
import configAdapterUtils from "./configAdapterUtils";


function getHomeDir(): string {
    return process.env.HOME || process.env.USERPROFILE || "";
}


async function loadNodeApis(): Promise<{ fs: FileSystemApi; path: PathApi }> {
    const fs = await import("fs/promises");
    const path = await import("path");
    return { fs, path };
}


async function getAdapters(): Promise<ConfigAdapter[]> {
    const homeDir = getHomeDir();
    if (!homeDir) {
        throw new Error("Cannot determine user home directory");
    }

    const { fs, path } = await loadNodeApis();
    return [
        new ClaudeCodeConfigAdapter(fs, path, homeDir),
        new CodexConfigAdapter(fs, path, homeDir),
    ];
}


async function getAdapter(client: ClientName): Promise<ConfigAdapter> {
    const adapters = await getAdapters();
    const adapter = adapters.find(item => item.client === client);
    if (!adapter) {
        throw new Error(`Unsupported client: ${client}`);
    }

    return adapter;
}


async function formatUniqueBackupName(client: ClientName, baseName: string): Promise<string> {
    const records = await SgClientConfigBackup.query()
        .where("client", client)
        .get();
    const existingNames = new Set(normalizeBackupRecords(records).map(record => String(record.name)));
    if (!existingNames.has(baseName)) {
        return baseName;
    }

    let index = 1;
    while (existingNames.has(`${baseName}${index}`)) {
        index += 1;
    }

    return `${baseName}${index}`;
}


function serializeConfigContent(configContent: Record<string, string> | null | undefined): string {
    const normalized: Record<string, string> = {};
    for (const key of Object.keys(configContent || {}).sort()) {
        normalized[key] = String(configContent?.[key] ?? "");
    }

    return JSON.stringify(normalized);
}


function isEnabled(value: unknown): boolean {
    return value === true || value === 1 || value === "1";
}


async function toBackupInfo(record: any, adapter: ConfigAdapter): Promise<ClientConfigBackupInfo> {
    const parsedConfig = await adapter.parseConfigContent(record.configContent || {});
    return {
        id: Number(record.id),
        client: record.client as ClientName,
        name: record.name,
        fileCount: Object.keys(record.configContent || {}).length,
        createdAt: String(record.created_at || record.createdAt || ""),
        enabled: isEnabled(record.enabled),
        config: await configAdapterUtils.enrichGatewayUser(parsedConfig),
        configContent: typeof record.configContent === "string" ? JSON.parse(record.configContent) : record.configContent || {},
    };
}


function normalizeBackupRecords(records: any): any[] {
    if (Array.isArray(records)) {
        return records;
    }

    if (Array.isArray(records?.items)) {
        return records.items;
    }

    if (typeof records?.toData === "function") {
        const data = records.toData();
        return Array.isArray(data) ? data : [];
    }

    return [];
}


async function getBackups(client: ClientName, adapter: ConfigAdapter): Promise<ClientConfigBackupInfo[]> {
    const records = await SgClientConfigBackup.query()
        .where("client", client)
        .orderBy("id", "desc")
        .get();

    return await Promise.all(normalizeBackupRecords(records).map(record => toBackupInfo(record, adapter)));
}


async function enrichStatus(status: ClientConfigStatus, adapter: ConfigAdapter): Promise<ClientConfigStatus> {
    const records = await SgClientConfigBackup.query()
        .where("client", status.client)
        .orderBy("id", "desc")
        .get();

    const backupRecords = normalizeBackupRecords(records);
    const backups = await Promise.all(backupRecords.map(record => toBackupInfo(record, adapter)));
    const activeRecord = backupRecords.find(record => isEnabled(record.enabled));
    const activeBackupId = activeRecord ? Number(activeRecord.id) : undefined;

    let activeConfigModified = false;
    if (activeRecord) {
        const currentContent = await adapter.readConfigFiles();
        const activeConfig = await adapter.parseConfigContent(activeRecord.configContent);
        const currentConfig = await adapter.parseConfigContent(currentContent);

        if (activeConfig && currentConfig) {
            const serializeRelevant = (c: CurrentClientConfig) => JSON.stringify({
                connectionMode: c.connectionMode,
                backendUrl: c.backendUrl,
                token: c.token,
                model: c.model,
                protocol: c.protocol,
            });
            activeConfigModified = serializeRelevant(activeConfig) !== serializeRelevant(currentConfig);
        } else {
            activeConfigModified = serializeConfigContent(activeRecord.configContent) !== serializeConfigContent(currentContent);
        }
    }

    return {
        ...status,
        backupExists: backups.length > 0,
        backupCount: backups.length,
        backups,
        activeBackupId,
        activeConfigModified,
    };
}


async function getStatus(): Promise<ClientConfigStatusResponse> {
    if (ormService.isWorker) {
        return {
            available: false,
            reason: "客户端管理需要读写本机配置文件，请本地安装后使用。",
            clients: [],
        };
    }

    const adapters = await getAdapters();
    const clients = await Promise.all(adapters.map(async (adapter) => {
        return await enrichStatus(await adapter.getStatus(), adapter);
    }));
    return {
        available: true,
        clients,
    };
}


async function createConfig(params: CreateClientConfigParams): Promise<ClientConfigStatus> {
    if (ormService.isWorker) {
        throw new Error("客户端管理需要读写本机配置文件，请本地安装后使用。");
    }

    if (!params.gatewayUrl?.trim()) {
        throw new Error("Gateway URL is required");
    }

    if (!params.apiKey?.trim()) {
        throw new Error("API key is required");
    }

    const adapter = await getAdapter(params.client);
    const configContent = await adapter.buildConfigContent({
        ...params,
        connectionMode: params.connectionMode || "gateway",
        protocol: params.protocol,
        gatewayUrl: params.gatewayUrl.trim(),
        apiKey: params.apiKey.trim(),
        model: params.model?.trim() || "",
        effortLevel: params.effortLevel?.trim(),
    });
    await SgClientConfigBackup.query().create({
        client: params.client,
        name: await formatUniqueBackupName(params.client, "未命名配置"),
        configContent,
        enabled: false,
    });

    return await enrichStatus(await adapter.getStatus(), adapter);
}


async function createBackup(params: CreateClientConfigBackupParams): Promise<ClientConfigBackupInfo> {
    if (ormService.isWorker) {
        throw new Error("客户端管理需要读写本机配置文件，请本地安装后使用。");
    }

    const adapter = await getAdapter(params.client);
    const configContent = await adapter.readConfigFiles();
    const record = await SgClientConfigBackup.query().create({
        client: params.client,
        name: params.name?.trim() || await formatUniqueBackupName(params.client, "未命名配置"),
        configContent,
        enabled: false,
    });

    if (params.enabled) {
        await enableBackup(params.client, record);
    }

    return await toBackupInfo(record, adapter);
}


async function renameBackup(params: RenameClientConfigBackupParams): Promise<ClientConfigBackupInfo> {
    if (ormService.isWorker) {
        throw new Error("客户端管理需要读写本机配置文件，请本地安装后使用。");
    }

    const name = params.name?.trim();
    if (!name) {
        throw new Error("Backup name is required");
    }

    const backup = await SgClientConfigBackup.query()
        .where("id", params.backupId)
        .where("client", params.client)
        .first();

    if (!backup) {
        throw new Error("Backup not found");
    }

    await backup.update({ name });
    backup.name = name;
    return await toBackupInfo(backup, await getAdapter(params.client));
}


async function updateBackupConfig(params: UpdateClientConfigBackupParams): Promise<ClientConfigStatus> {
    if (ormService.isWorker) {
        throw new Error("客户端管理需要读写本机配置文件，请本地安装后使用。");
    }

    if (!params.gatewayUrl?.trim()) {
        throw new Error("Gateway URL is required");
    }

    if (!params.apiKey?.trim()) {
        throw new Error("API key is required");
    }

    const adapter = await getAdapter(params.client);
    const backup = await SgClientConfigBackup.query()
        .where("id", params.backupId)
        .where("client", params.client)
        .first();

    if (!backup) {
        throw new Error("Backup not found");
    }

    const configContent = await adapter.buildConfigContent({
        ...params,
        connectionMode: params.connectionMode || "gateway",
        protocol: params.protocol,
        gatewayUrl: params.gatewayUrl.trim(),
        apiKey: params.apiKey.trim(),
        model: params.model?.trim() || "",
        effortLevel: params.effortLevel?.trim(),
    });

    await backup.update({ configContent });
    backup.configContent = configContent;

    if (backup.enabled) {
        // If the backup being updated is currently enabled, apply changes to local config immediately
        await adapter.restore(backup.configContent);
    }

    return await enrichStatus(await adapter.getStatus(), adapter);
}


async function deleteBackup(params: DeleteClientConfigBackupParams): Promise<ClientConfigStatus> {
    if (ormService.isWorker) {
        throw new Error("客户端管理需要读写本机配置文件，请本地安装后使用。");
    }

    const adapter = await getAdapter(params.client);
    const backup = await SgClientConfigBackup.query()
        .where("id", params.backupId)
        .where("client", params.client)
        .first();

    if (!backup) {
        throw new Error("Backup not found");
    }

    await backup.delete();
    return await enrichStatus(await adapter.getStatus(), adapter);
}


async function enableBackup(client: ClientName, backup: SgClientConfigBackup): Promise<void> {
    await SgClientConfigBackup.query()
        .where("client", client)
        .update({ enabled: false });
    await backup.update({ enabled: true });
    backup.enabled = true;
}


async function applyConfig(params: ApplyClientConfigParams): Promise<ClientConfigStatus> {
    if (ormService.isWorker) {
        throw new Error("客户端管理需要读写本机配置文件，请本地安装后使用。");
    }

    const adapter = await getAdapter(params.client);
    const backup = await SgClientConfigBackup.query()
        .where("id", params.backupId)
        .where("client", params.client)
        .first();

    if (!backup) {
        throw new Error("Backup not found");
    }

    const status = await adapter.restore(backup.configContent);
    await enableBackup(params.client, backup);
    return await enrichStatus(status, adapter);
}


export default {
    createBackup,
    createConfig,
    deleteBackup,
    getStatus,
    applyConfig,
    renameBackup,
    updateBackupConfig,
};

export type {
    ApplyClientConfigParams,
    ClientConfigBackupInfo,
    ClientConfigStatus,
    ClientConfigStatusResponse,
    DeleteClientConfigBackupParams,
    CreateClientConfigParams,
};
