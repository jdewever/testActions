import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const base_cacheFolder = 'globis-lsp-cache';

export class Cache {
    private static _instance: Cache;

    private _workspace: string;
    private _cachePath: string;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private _defaultFilter = (_file: string) => true;

    private constructor(workspaceFolder: string) {
        this._workspace = workspaceFolder;

        this._cachePath = this.generateCachePath(workspaceFolder);
        this.ensureCacheFolder();

        console.log(`Cache initialized at '${this._cachePath}'`);
    }

    public getCachePath = () => {
        return this._cachePath;
    };

    public save = async(relPath: string, data: string) => {
        const fpath = this.resolveCachePath(relPath);
        await writeFile(fpath, data, 'utf-8');
    };

    public load = async <T>(relPath: string): Promise<T | null> => {
        const fpath = this.resolveCachePath(relPath);
        try {
            const content = await readFile(fpath, 'utf-8');
            return JSON.parse(content) as T;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
            console.warn(`Failed to read cache at: '${fpath}'`);
            return null;
        }
    };

    public listCacheFolder = async(relPath: string, outputRelative = true, filter: ((file:string)=> boolean) = this._defaultFilter) => {
        try {
            const folderPath = this.resolveCachePath(relPath);

            let results: string[] = [];
            const list = await readdir(folderPath);

            for (const file of list) {
                const fpath = join(folderPath, file);
                const fstat = await stat(fpath);

                if (fstat.isDirectory()) {
                    results = results.concat(await this.listCacheFolder(join(relPath, file), outputRelative, filter));
                } else if (filter(file)) {
                    results.push(outputRelative ? join(relPath, file) : fpath);
                }
            }

            return results;
        } catch (err) {
            console.error(err);
            return [];
        }
    };

    private resolveCachePath = (relPath: string): string => {
        const fpath = join(this._cachePath, relPath);
        this.ensureCacheFolder(dirname(fpath));
        return fpath;
    };

    private generateCachePath = (workspaceFolder: string):string => {
        const encodedPath = createHash('sha1').update(workspaceFolder).digest('hex');
        const platformCacheFolder = process.platform === 'win32' ?
            join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'))
            : join(homedir(), '.config');
        return join(platformCacheFolder, base_cacheFolder, encodedPath);
    };

    private ensureCacheFolder = (folderPath: string = this._cachePath) => {
        if (!existsSync(folderPath)) {
            mkdirSync(folderPath, {recursive: true});
        }
    };

    public static initialize = (workspace: string): Cache => {
        if (Cache._instance) {
            console.warn('Cache already initialized!');
        } else {
            Cache._instance = new Cache(workspace);
        }
        return Cache.getInstance();
    };

    public static getInstance = ():Cache => {
        if (!Cache._instance) {
            console.error('Cache not initialized!');
        }
        return Cache._instance;
    };
}