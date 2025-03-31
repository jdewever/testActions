import { basename, dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { findFiles } from '../util/file';
import { readFile } from 'node:fs/promises';
import { ServoyObject } from '../servoy/servoyParser';
import { extractFromGlobis } from './globisExtractor';

interface SolutionInfo {
    path: string
    settingsPath: string
    name: string
    references: string[]
    uuid: string
}

// key -> solution; value -> referenced solutions (aka those in scope)
type ScopeDependencyGraph = Map<string, Set<string>>;

export class ScopeManager {
    private static _instance: ScopeManager;

    private _workspaceFolder: string;
    private _solutions: SolutionInfo[];
    private _depGraph: ScopeDependencyGraph;
    private _filesPerSolution: Map<string, string[]>;

    private _folder: string;

    private constructor(workspaceFolder:string) {
        this._workspaceFolder = workspaceFolder;
        this._solutions = [];
        this._depGraph = new Map();
        this._filesPerSolution = new Map();
        this._folder = 'globis_solutions';
    }

    private init = async(): Promise<void> => {
        const solutionSettingsFiles = await findFiles(this._workspaceFolder, (file) => file === 'solution_settings.obj');
        this._solutions = (await Promise.all(solutionSettingsFiles.map(parseSolutionSettings))).filter(s => s !== null);
        this._depGraph = buildDependencyGraph(this._solutions);

        for (const sol of this._solutions) {
            const files = await getFilesInSolution(sol);
            this._filesPerSolution.set(sol.name, files);
        }

        const allSolutionFiles: string[] = [];
        this._filesPerSolution.forEach(files => {
            files.forEach(file => allSolutionFiles.push(file));
        });

        await Promise.allSettled(allSolutionFiles.map(file => extractFromGlobis(file, this._workspaceFolder, this._folder, true)));
    };

    public getSolutionByName = (name:string): SolutionInfo | undefined => {
        return this._solutions.find(sol => sol.name === name);
    };

    public getSolutionForPath = (currentPath :string): SolutionInfo | undefined => {
        const absolute = isAbsolute(currentPath) ? currentPath : resolve(currentPath);

        for (const solution of this._solutions) {
            const relPath = relative(solution.path, absolute);

            if (!relPath.startsWith('..') && !relPath.includes('node_modules')) {
                return solution;
            }
        }
        return undefined;
    };

    public getReferencesForSolution = (solutionName: string): Set<string> => {
        return this._depGraph.get(solutionName) ?? new Set();
    };

    public getModuleNames = (solName: string): string[] => {
        const namesandorigin = this.getModuleNamesAndOrigin(solName);
        return namesandorigin.map(fpr => fpr.name);
    };

    public getModuleNamesAndOrigin = (solName: string): { name:string, origin:string }[] => {
        const refs = [...this.getReferencesForSolution(solName)];
        const filesPerRef = refs.flatMap(ref => {
            const files = this._filesPerSolution.get(ref);
            if (!files || files.length === 0) return [];
            return files.map(file => ({origin: ref, name: basename(file, '.js')}));
        });
        return filesPerRef;
    };

    // eslint-disable-next-line @typescript-eslint/require-await
    public parseScope = async(): Promise<Map<string, ServoyObject>> => {
        // TODO parse a scope (or solution)
        // and possible lazily cache them?


        return new Map();
    };

    public static initialize = async(workspaceFolder:string): Promise<ScopeManager> => {
        if (!ScopeManager._instance) {
            const smanager = new ScopeManager(workspaceFolder);
            ScopeManager._instance = smanager;

            await smanager.init();
        }

        return ScopeManager._instance;
    };

    public static getInstance = (): ScopeManager => {
        if (!ScopeManager._instance) {
            throw new Error('ScopeManager not yet initialized');
        } else return ScopeManager._instance;
    };
}

const buildDependencyGraph = (solutions: SolutionInfo[]): ScopeDependencyGraph => {
    const graph: ScopeDependencyGraph = new Map();

    for (const solution of solutions) {
        // Change out for deeply if needed
        graph.set(solution.name, resolveModulesDirect(solution));
    }

    return graph;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const resolveModulesDeeply = (graph: ScopeDependencyGraph, entry: string): Set<string> => {
    const visited = new Set<string>();
    const stack = [entry];

    while (stack.length > 0) {
        const current = stack.pop()!;
        if (!visited.has(current)) {
            visited.add(current);

            const refs = graph.get(current);
            if (refs) {
                for (const ref of refs) {
                    if (!visited.has(ref)) {
                        stack.push(ref);
                    }
                }
            }
        }
    }

    visited.delete(entry);
    return visited;
};

const resolveModulesDirect = (solution: SolutionInfo): Set<string> => {
    const refs = new Set(solution.references);
    refs.add(solution.name);
    return refs;
};

const parseSolutionSettings = async(settingsPath: string): Promise<SolutionInfo | null> => {
    try {
        const content = await readFile(settingsPath, 'utf-8');
        const lines = content.split(/\r?\n/);
        const config: Record<string, string> = {};

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            const match = /^([a-zA-Z0-9_]+)\s*:\s*"(.*?)",?$/.exec(trimmed);
            if (match) {
                const [, key, value] = match;
                config[key] = value;
            }
        }

        if (!config.uuid) return null;

        const path = dirname(settingsPath);
        const name = basename(path);

        const references = config.modulesNames?.split(',').map(r => r.trim()) ?? [];

        return {path, settingsPath, name, references, uuid: config.uuid} as SolutionInfo;
    } catch (err) {
        console.error(`Failed to parse ${settingsPath}`, err);
        return null;
    }
};

const getFilesInSolution = async(solution: SolutionInfo): Promise<string[]> => {
    const jsNoGlobalsFilter = (file: string) => extname(file) === '.js' && file !== 'globals.js';

    return await findFiles(solution.path, jsNoGlobalsFilter);
};