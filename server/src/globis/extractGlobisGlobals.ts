import { basename, dirname, join } from 'path';
import { Cache } from '../useCache';
import { findFiles } from '../util/file';
import { extractFromGlobis } from './globisExtractor';

export const extractGlobisGlobals = async(workspaceDir: string) => {
    const files = await findFiles(workspaceDir, (file => basename(file) === 'globals.js'));
    const outputDir = join('globis_typings', 'globis_json');
    const cache = Cache.getInstance();

    for (const fpath of files) {
        const moduleName = basename(dirname(fpath));
        const parsedData = await extractFromGlobis(fpath, workspaceDir);
        if (!parsedData) continue;
        const outputPath = join(outputDir, `${moduleName}.json`);

        await cache.save(outputPath, JSON.stringify(parsedData, null, 2));
    }
};