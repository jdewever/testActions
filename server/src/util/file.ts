import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const noFilter = (file:string) => true;
export const findFiles = async(dir: string, filter = noFilter): Promise<string[]> => {
    let results:string[] = [];
    const list = await readdir(dir);

    for (const file of list) {
        const fpath = join(dir, file);
        const fstat = await stat(fpath);

        if (fstat.isDirectory()) {
            results = results.concat(await findFiles(fpath, filter));
        } else if (filter(file)) {
            results.push(fpath);
        }
    }

    return results;
};