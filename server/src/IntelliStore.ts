import { parseGlobisDocNew } from './globis/globisParser';
import { IFunction } from './interfaces';
import { parseServoyDoc, ServoyObject } from './servoy/servoyParser';
import { levenshteinDistance } from './util/levenshteinDistance';

export interface Store {
    objects: Map<string, ServoyObject>
}

export class IntelliStore {
    private static _instance: IntelliStore;
    private _workspaceFolder: string;

    private _store: Store;

    private constructor(workspaceFolder: string) {
        this._workspaceFolder = workspaceFolder;
        this._store = {
            objects: new Map()
        };
    }

    private init = async() => {
        const servoyObjects = await parseServoyDoc();

        for (const obj of servoyObjects) {
            this._store.objects.set(obj.name, obj);
        }

        const globalObject = await parseGlobisDocNew(this._workspaceFolder);
        const oldGlobal = this._store.objects.get('globals')!;
        const newGlobal: ServoyObject = {...oldGlobal, functions: globalObject.functions, properties: globalObject.properties};

        this._store.objects.set('globals', newGlobal);
    };

    public get globals(): ServoyObject {
        return this.getServoyObject('globals')!;
    }

    public get objectNames(): string[] {
        return [...this._store.objects.keys()];
    }

    public getServoyObject = (name: string): ServoyObject | undefined => {
        return this._store.objects.get(name);
    };

    public searchObject = (partial: string): ServoyObject[] => {
        return IntelliStore
            .filterByDistance(this.objectNames, partial)
            .map(name => this.getServoyObject(name)!);
    };

    public static searchObjectFunctions = (obj: ServoyObject, partial: string): IFunction[] => {
        return IntelliStore
            .filterByDistance(obj.functions.map(f => f.name), partial)
            .map(name => obj.functions.find(f => f.name === name)!);
    };

    public static filterByDistance = (list: string[], partial: string): string[] => {
        partial = partial.toLowerCase();
        const tolerance = Math.max(2, Math.floor(partial.length / 3));

        const rawMatches = list.map(name => {
            const lower = name.toLowerCase();
            const dist = levenshteinDistance(partial, lower);
            const startMatch = lower.startsWith(partial) ? -1 : 0;

            return {name, dist, startMatch};
        });

        const filtered = rawMatches
            .filter(entry => entry.dist <= tolerance || entry.startMatch === -1)
            .sort((a, b) => a.startMatch - b.startMatch || a.dist - b.dist || a.name.length - b.name.length);

        return filtered.map(e => e.name);
    };

    public static initialize = async(workspaceFolder:string): Promise<IntelliStore> => {
        if (!IntelliStore._instance) {
            const iStore = new IntelliStore(workspaceFolder);
            IntelliStore._instance = iStore;

            await iStore.init();
        }

        return IntelliStore._instance;
    };

    public static getInstance = (): IntelliStore => {
        if (!IntelliStore._instance) {
            throw new Error('Intellistore not yet initialized');
        } else return IntelliStore._instance;
    };
}