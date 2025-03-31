import { SignatureHelp, SignatureHelpParams } from 'vscode-languageserver/node';
import { IFunction } from '../interfaces';
import { documents } from '../server';
import { IntelliStore } from '../IntelliStore';

export const onsignaturehelp = (
    params: SignatureHelpParams
): SignatureHelp | null => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return null;

    const store = IntelliStore.getInstance();

    const text = document.getText();
    const offset = document.offsetAt(params.position);

    const callMatch = /(\w+\.\w+)\s*\($/.exec(text.substring(0, offset));
    if (!callMatch) return null;

    const functionName = callMatch[1];

    const fparts = functionName.split('.');
    const servoyObj = store.getServoyObject(fparts[0]);
    if (!servoyObj) return null;

    const servoyFuncs = servoyObj.functions.filter(f => f.name === fparts[1]);
    if (!servoyFuncs || servoyFuncs.length === 0) return null;

    return {
        signatures: servoyFuncs.map(func => ({
            label: `${func.name}(${func.params
                .map(p => `${p.name}${p.optional ? '?' : ''}: ${p.type}`)
                .join(', ')})`,
            documentation: func.description,
            parameters: func.params.map(p => ({
                label: `${p.name}${p.optional ? '?' : ''}`,
                documentation: p.description
            }))
        })),
        activeParameter: determineActiveParam(text, offset, servoyFuncs[0]),
        activeSignature: 0
    };
};

const determineActiveParam = (
    text: string,
    offset: number,
    func: IFunction
): number => {
    const argsBefore =
		text.substring(0, offset).split('(').pop()?.split(',') ?? [];
    const argIndex = argsBefore.length - 1;
    const nonOptionalParams = func.params.filter(p => !p.optional);
    return Math.min(argIndex, nonOptionalParams.length - 1);
};