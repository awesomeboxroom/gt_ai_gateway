import { Model } from "sutando";
import { inspect, InspectOptions } from "util";
import { ClientName, ConnectionMode, ApiFormat } from "../constants";

interface ClientConfigFields {
    connectionMode?: ConnectionMode;
    gatewayUrl: string;
    apiKey: string;
    model: string;
    effortLevel?: string;
}

type ClientConfigContent = ClientConfigFields | Record<string, string>;


class SgClientConfig extends Model {
    table = "client_config_backup";

    id!: number;
    client!: ClientName;
    name!: string;
    configContent!: ClientConfigContent;
    enabled!: boolean;

    casts = {
        configContent: "json",
    };

    created_at!: Date;
    updated_at!: Date;


    [inspect.custom](depth: number, options: InspectOptions) {
        return JSON.stringify(this.toData(), null, 2);
    }
}


export default SgClientConfig;
export type { ClientConfigContent, ClientConfigFields, ConnectionMode, ApiFormat };
