import { ClientName } from "../../constants";
import type { ClientConfigContent, ClientConfigFields, ConnectionMode, ClientProtocol } from "../../model/sgClientConfigBackup";

interface CreateClientConfigParams extends ClientConfigFields {
    client: ClientName;
}

interface ApplyClientConfigParams {
    client: ClientName;
    backupId: number;
}

interface DeleteClientConfigBackupParams {
    client: ClientName;
    backupId: number;
}

interface UpdateClientConfigBackupParams extends CreateClientConfigParams {
    backupId: number;
}

interface RenameClientConfigBackupParams {
    client: ClientName;
    backupId: number;
    name: string;
}

interface CreateClientConfigBackupParams {
    client: ClientName;
    name?: string;
    enabled?: boolean;
}

interface ClientConfigStatusResponse {
    available: boolean;
    reason?: string;
    clients: ClientConfigStatus[];
}

interface AdapterConfigStatus {
    client: ClientName;
    displayName: string;
    protocol: ClientProtocol;
    installed: boolean;
    configured: boolean;
    currentConfig: ClientConfigFields | null;
    defaultGatewaySuffix: string;
    configPath: string;
    configPaths: string[];
    message?: string;
}

interface ClientConfigStatus extends AdapterConfigStatus {
    backupExists: boolean;
    backupCount: number;
    backups: ClientConfigBackupInfo[];
    activeBackupId?: number;
    activeConfigModified: boolean;
    currentConfig: CurrentClientConfigWithUser | null;
}

interface CurrentClientConfig extends ClientConfigFields {
    configPath: string;
}

interface CurrentClientConfigWithUser extends CurrentClientConfig {
    gatewayUser: GatewayUserInfo | null;
}

interface GatewayUserInfo {
    id: number;
    name: string;
    type: string;
    status: string;
}

interface ClientConfigBackupInfo {
    id: number;
    client: ClientName;
    name: string;
    fileCount: number;
    createdAt: string;
    enabled: boolean;
    config: CurrentClientConfig | null;
}

interface FileSystemApi {
    access(path: string): Promise<void>;
    mkdir(path: string, options: { recursive: boolean }): Promise<string | undefined>;
    readFile(path: string, encoding: "utf-8"): Promise<string>;
    writeFile(path: string, content: string, encoding: "utf-8"): Promise<void>;
    unlink(path: string): Promise<void>;
}

interface PathApi {
    dirname(path: string): string;
    join(...paths: string[]): string;
}

type ClientConfigFileSystemContent = Record<string, string>;

interface ConfigAdapter {
    readonly client: ClientName;
    readonly displayName: string;
    readonly protocol: ClientProtocol;
    readonly configPath: string;
    readonly configPaths: string[];
    readonly defaultGatewaySuffix: string;

    isInstalled(): Promise<boolean>;
    readConfig(): Promise<ClientConfigFileSystemContent>;
    writeConfig(content: ClientConfigFileSystemContent): Promise<void>;
    parseConfigContent(configContent: ClientConfigFileSystemContent): ClientConfigFields | null;
    patchConfigContent(content: ClientConfigFileSystemContent, fields: ClientConfigFields): ClientConfigFileSystemContent;
}

export type {
    AdapterConfigStatus,
    ApplyClientConfigParams,
    ClientConfigBackupInfo,
    ClientConfigContent,
    ClientConfigFields,
    ClientConfigStatus,
    ClientConfigStatusResponse,
    ClientConfigFileSystemContent,
    ClientProtocol,
    ConfigAdapter,
    ConnectionMode,
    CreateClientConfigBackupParams,
    CreateClientConfigParams,
    CurrentClientConfig,
    CurrentClientConfigWithUser,
    DeleteClientConfigBackupParams,
    FileSystemApi,
    GatewayUserInfo,
    PathApi,
    RenameClientConfigBackupParams,
    UpdateClientConfigBackupParams,
};

export { ClientName };
