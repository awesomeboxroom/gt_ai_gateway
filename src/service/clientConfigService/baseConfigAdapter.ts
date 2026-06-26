import type {
    ClientConfigContent,
    ClientConfigStatus,
    ClientName,
    ConfigAdapter,
    FileSystemApi,
    PathApi,
} from "./types";
import configAdapterUtils from "./configAdapterUtils";


abstract class BaseConfigAdapter implements ConfigAdapter {
    // 注入 fs 和 path 的目的是为了跨环境兼容（例如在 Node.js 和 Tauri 前端直连时可能采用不同的 API实现）
    protected fs: FileSystemApi;
    protected path: PathApi;
    readonly client: ClientName;
    readonly displayName: string;
    abstract readonly defaultGatewaySuffix: string;
    readonly configPath: string;
    readonly configPaths: string[];

    constructor(
        fs: FileSystemApi,
        path: PathApi,
        client: ClientName,
        displayName: string,
        configPath: string,
        configPaths?: string[],
    ) {
        this.fs = fs;
        this.path = path;
        this.client = client;
        this.displayName = displayName;
        this.configPath = configPath;
        this.configPaths = configPaths || [configPath];
    }


    async isInstalled(): Promise<boolean> {
        return await configAdapterUtils.pathExists(this.fs, this.path.dirname(this.configPath));
    }


    protected async readConfigFile(): Promise<string> {
        if (!(await configAdapterUtils.pathExists(this.fs, this.configPath))) {
            return "";
        }

        return await this.fs.readFile(this.configPath, "utf-8");
    }


    protected async writeConfigFile(content: string): Promise<void> {
        await this.fs.mkdir(this.path.dirname(this.configPath), { recursive: true });
        await this.fs.writeFile(this.configPath, content, "utf-8");
    }


    async readConfigFiles(): Promise<ClientConfigContent> {
        const configContent: ClientConfigContent = {};

        for (const filePath of this.configPaths) {
            if (await configAdapterUtils.pathExists(this.fs, filePath)) {
                configContent[filePath] = await this.fs.readFile(filePath, "utf-8");
            }
        }

        return configContent;
    }


    abstract getStatus(): Promise<ClientConfigStatus>;


    async restore(configContent: ClientConfigContent): Promise<ClientConfigStatus> {
        for (const [filePath, content] of Object.entries(configContent)) {
            if (!this.configPaths.includes(filePath)) {
                throw new Error(`Unsupported config file path: ${filePath}`);
            }

            await this.fs.mkdir(this.path.dirname(filePath), { recursive: true });
            await this.fs.writeFile(filePath, content, "utf-8");
        }

        for (const filePath of this.configPaths) {
            if (!(filePath in configContent)) {
                if (await configAdapterUtils.pathExists(this.fs, filePath)) {
                    await this.fs.unlink(filePath);
                }
            }
        }

        return await this.getStatus();
    }
}


export default BaseConfigAdapter;
