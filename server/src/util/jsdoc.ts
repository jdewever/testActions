import { Comment } from 'acorn';
import { Options, parse } from 'doctrine';
import { IVariable } from '../interfaces';
import { parseJSDocType, stringifyType } from './types';

const doctrineOpts: Options = {
    unwrap: true,
    sloppy: true,
    lineNumbers: true,
    recoverable: true
};

export const parseVarJSDoc = (comment: Comment): Omit<IVariable, 'name'> | undefined => {
    try {
        const safeJSDoc = comment.value.replace(/db:\/[\w_]+\/[\w_]+/g, (match) => `"${match}"`);
        const parsed = parse(safeJSDoc, doctrineOpts);
        const doc: Omit<IVariable, 'name'> = {
            description: 'No description provided for this variable',
            type: 'unknown'
        };

        if (parsed.description?.trim()) {
            doc.description = parsed.description.trim();
        }

        const typeTag = parsed.tags.find(t => t.title === 'type');
        if (comment.value.includes('relation_contact')) {
            console.dir(doc);
        }
        if (typeTag?.type) {
            const typeInfo = parseJSDocType(typeTag.type);
            doc.typeInfo = typeInfo;
            doc.type = stringifyType(typeInfo);
        }

        return doc;
    } catch (err) {
        console.error(err);
    }
};