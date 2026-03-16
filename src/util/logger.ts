import { existsSync, mkdirSync, writeFileSync, appendFileSync } from "fs";
import { join } from "path";

type LogLevel = "info" | "warn" | "error" | "debug";

// 保存原始 console 方法，避免被重写导致无限递归
const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    debug: console.debug,
};

class Logger {
    private logDir: string;
    private logFilePath: string;
    private enabled: boolean;

    constructor(logDir: string, enabled: boolean = true) {
        this.logDir = logDir;
        this.enabled = enabled;

        if (enabled) {
            this.ensureLogDir();
            this.logFilePath = this.getLogFilePath();
        }
    }

    private ensureLogDir(): void {
        if (!existsSync(this.logDir)) {
            mkdirSync(this.logDir, { recursive: true });
        }
    }

    private getLogFilePath(): string {
        const now = new Date();
        const dateStr = now.toISOString().split("T")[0];
        return join(this.logDir, `app-${dateStr}.log`);
    }

    private formatTimestamp(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const hours = String(now.getHours()).padStart(2, "0");
        const minutes = String(now.getMinutes()).padStart(2, "0");
        const seconds = String(now.getSeconds()).padStart(2, "0");
        const milliseconds = String(now.getMilliseconds()).padStart(3, "0");

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
    }

    private write(level: LogLevel, message: string, ...args: unknown[]): void {
        if (!this.enabled) {
            return;
        }

        const timestamp = this.formatTimestamp();
        const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

        const formattedArgs = args.map((arg) => {
            if (typeof arg === "object") {
                return JSON.stringify(arg, null, 2);
            }
            return String(arg);
        });

        const logLine = `${prefix} ${message}${formattedArgs.length > 0 ? " " + formattedArgs.join(" ") : ""}\n`;

        appendFileSync(this.logFilePath, logLine);
    }

    info(message: string, ...args: unknown[]): void {
        this.write("info", message, ...args);
        originalConsole.log(`[INFO] ${message}`, ...args);
    }

    warn(message: string, ...args: unknown[]): void {
        this.write("warn", message, ...args);
        originalConsole.warn(`[WARN] ${message}`, ...args);
    }

    error(message: string, ...args: unknown[]): void {
        this.write("error", message, ...args);
        originalConsole.error(`[ERROR] ${message}`, ...args);
    }

    debug(message: string, ...args: unknown[]): void {
        this.write("debug", message, ...args);
        originalConsole.debug(`[DEBUG] ${message}`, ...args);
    }
}

let loggerInstance: Logger | null = null;

function initLogger(rootDirOrEnabled?: string | boolean, enabled?: boolean): Logger {
    if (!loggerInstance) {
        let logDir: string;
        let isLoggerEnabled: boolean = true;

        // 支持两种调用方式：
        // 1. initLogger(enabled: boolean)
        // 2. initLogger(rootDir: string, enabled: boolean)
        if (typeof rootDirOrEnabled === "string") {
            logDir = rootDirOrEnabled;
            isLoggerEnabled = enabled ?? true;
        } else {
            logDir = getLogDir();
            isLoggerEnabled = rootDirOrEnabled ?? true;
        }

        loggerInstance = new Logger(logDir, isLoggerEnabled);
    }
    return loggerInstance;
}

function getLogger(): Logger | null {
    return loggerInstance;
}

function resetLogger(): void {
    loggerInstance = null;
}

/**
 * 获取日志目录路径
 * 优先使用环境变量 LOG_DIR，否则使用项目根目录下的 log
 * @returns 日志目录路径
 */
function getLogDir(): string {
    return process.env.LOG_DIR || join(process.cwd(), "log");
}

export default initLogger;
export { getLogger, Logger, resetLogger, getLogDir };