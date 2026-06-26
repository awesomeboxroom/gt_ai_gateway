export const ClientName = {
    CLAUDE_CODE: 'claude-code',
    CODEX: 'codex',
} as const;

export type ClientName = typeof ClientName[keyof typeof ClientName];

export type ClientConnectionMode = 'gateway' | 'vendor';
export type ClientProtocol = 'anthropic' | 'responses';

export interface ClientConfigStatus {
    client: ClientName;
    displayName: string;
    installed: boolean;
    configured: boolean;
    backupExists: boolean;
    backupCount: number;
    backups: ClientConfigBackupInfo[];
    activeBackupId?: number;
    activeConfigModified: boolean;
    currentConfig: CurrentClientConfig | null;
    defaultGatewaySuffix: string;
    configPath: string;
    configPaths: string[];
    message?: string;
}

export interface CurrentClientConfig {
    configPath: string;
    connectionMode: ClientConnectionMode;
    backendUrl: string;
    token: string;
    model: string;
    protocol: ClientProtocol;
    gatewayUser: GatewayUserInfo | null;
    effortLevel?: string;
}

export interface GatewayUserInfo {
    id: number;
    name: string;
    type: string;
    status: string;
}

export interface ClientConfigBackupInfo {
    id: number;
    client: ClientName;
    name: string;
    fileCount: number;
    createdAt: string;
    enabled: boolean;
    config: CurrentClientConfig | null;
}

export interface ClientConfigStatusResponse {
    available: boolean;
    reason?: string;
    clients: ClientConfigStatus[];
}

export interface CreateClientConfigRequest {
    client: ClientName;
    connectionMode?: ClientConnectionMode;
    protocol?: ClientProtocol;
    gatewayUrl: string;
    apiKey: string;
    model: string;
    effortLevel?: string;
}

export interface CreateClientConfigBackupRequest {
    client: ClientName;
    name?: string;
    enabled?: boolean;
}

export interface RenameClientConfigBackupRequest {
    client: ClientName;
    backupId: number;
    name: string;
}

export interface DeleteClientConfigBackupRequest {
    client: ClientName;
    backupId: number;
}

export interface UpdateClientConfigBackupRequest extends CreateClientConfigRequest {
    backupId: number;
}

export interface ApplyClientConfigRequest {
    client: ClientName;
    backupId: number;
}
