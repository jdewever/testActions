import { basename, join } from 'node:path';
import { IFunction, IResult } from '../interfaces';
import { ServoyObject } from '../servoy/servoyParser';
import { Cache } from '../useCache';

const _typings = 'globis_typings';
const _jsons = 'globis_json';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const parseGlobisDocNew = async(workspaceFolder: string) => {
    const cache = Cache.getInstance();

    const uniqueFunctions = new Map<string, { func: IFunction, moduleName: string }[]>();
    const tempGlobalObj: ServoyObject = {
        constants: [],
        description: '',
        functions: [],
        name: '',
        properties: []
    };

    const jsonFolder = join(_typings, _jsons);
    const jsonFiles = await cache.listCacheFolder(jsonFolder, true, (file => file.endsWith('.json')));

    try {
        for (const file of jsonFiles) {
            const moduleName = basename(file, '.json');
            const extractedData = await cache.load<IResult>(file);

            if (!extractedData) continue;

            for (const func of extractedData.functions ?? []) {
                if (!uniqueFunctions.has(func.name)) {
                    uniqueFunctions.set(func.name, [{func, moduleName}]);
                } else {
                    const existing = uniqueFunctions.get(func.name)!;
                    if (!existing.map(e => areIdenticalFuncs(e.func, func)).some(Boolean)) {
                        console.warn(`Duplicate but NOT identical functions ${func.name} found. Merging...`);
                        uniqueFunctions.get(func.name)!.push({func, moduleName});
                    }
                }
            }
            for (const variable of extractedData.variables ?? []) {
                // TODO unique vars??
                // TODO constant vs property
                tempGlobalObj.properties.push(variable);
            }
        }
    } catch (e) {
        console.error(e);
    }

    for (const key of uniqueFunctions.keys()) {
        const funcAndModules = uniqueFunctions.get(key)!;
        const funcs = funcAndModules?.map(fm => fm.func).filter(Boolean);
        tempGlobalObj.functions.push(...funcs);
    }

    return tempGlobalObj;
};
const areIdenticalFuncs = (func1: IFunction, func2: IFunction): boolean => {
    return (
        func1.name === func2.name &&
		JSON.stringify(func1.params) === JSON.stringify(func2.params) &&
		func1.returns === func2.returns
    );
};