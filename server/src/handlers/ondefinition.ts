import { DefinitionParams, Location, Position, Range } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { IntelliStore } from '../IntelliStore';
import { documents } from '../server';

export const ondefinition = (
    params: DefinitionParams
): Location[] | null => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return null;

    const text = document.getText();
    const offset = document.offsetAt(params.position);

    const store = IntelliStore.getInstance();

    // Expand backwards to find the start of the full function reference (object.function)
    let start = offset;
    while (start > 0 && /[\w.]/.test(text[start - 1])) {
        start--;
    }

    // Expand forwards to find the end of the function name
    let end = offset;
    while (end < text.length && /[\w]/.test(text[end])) {
        end++;
    }

    const functionName = text.substring(start, end);

    const fparts = functionName.split('.');
    const servoyObj = store.getServoyObject(fparts[0]);
    if (!servoyObj) return null;

    const funcs = servoyObj.functions.filter(f => f.name === fparts[1]);
    if (!funcs || funcs.length === 0) return null;

    return funcs
        .filter(f => (f.filePath && f.position))
        .map(func => ({
            uri: URI.file(func.filePath!).toString(),
            range: Range.create(
                Position.create(func.position!.line, func.position!.column),
                Position.create(func.position!.line, func.position!.column + functionName.length)
            )}
        ));
};