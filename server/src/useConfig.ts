const defaultConfig: ExtensionConfig = {
    typeComparison: {
        allowUnknownActuals: false
    }
};

export class Config {
    private static _instance: Config;
    private _conf: ExtensionConfig;

    private constructor(conf: ExtensionConfig) {
        this._conf = conf;
        console.log('Config initialized');
        console.dir(this._conf);
    }

    getConf = (): ExtensionConfig => {
        return this._conf;
    };

    public static initialize = (conf: ExtensionConfig = defaultConfig): Config => {
        if (Config._instance) {
            console.warn('Config already initialized!');
        } else {
            Config._instance = new Config(conf);
        }
        return Config.getInstance();
    };

    public static getInstance = (): Config => {
        if (!Config._instance) {
            console.error('Config not initialized!');
        }
        return Config._instance;
    };
}

export interface ExtensionConfig {
    typeComparison: {
        allowUnknownActuals: boolean
    }
}