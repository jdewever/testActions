import {
    Hover,
    MarkupKind,
    TextDocumentPositionParams
} from 'vscode-languageserver/node';
import { IntelliStore } from '../IntelliStore';
import { IFunction } from '../interfaces';
import { documents } from '../server';
import { ServoyObject } from '../servoy/servoyParser';

export const onhover = (params: TextDocumentPositionParams): Hover | null => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return null;

    const store = IntelliStore.getInstance();

    const text = document.getText();
    const offset = document.offsetAt(params.position);

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

    // Extract the full function reference (e.g., "databaseManager.getFoundSet")
    const functionName = text.substring(start, end);

    // Ensure it includes a dot (to confirm it's "object.function" and not just a single word)
    // if (!functionName.includes('.')) return null;

    const fparts = functionName.split('.');
    const servoyObj = store.getServoyObject(fparts[0]);
    if (servoyObj) {
        const funcs = servoyObj.functions.filter(f => f.name === fparts[1]);
        if (funcs.length > 0) {
            return {
                contents: {
                    kind: MarkupKind.Markdown,
                    value: formatFunctionHover(funcs)
                }
            };
        }
        return {
            contents: {
                kind: MarkupKind.Markdown,
                value: formatObjectHover(servoyObj)
            }
        };
    }
    return null;
};

function formatFunctionHover(funcs: IFunction[]): string {
    return funcs
        .map(func => {
            const params = func.params
                .map(
                    p =>
                        `- \`${p.name}${p.optional ? '?' : ''}: ${p.type}\` — ${
                            p.description
                        }`
                )
                .join('\n');

            const returnType =
				func.returns && func.returns.trim() !== '' ? func.returns : 'void';

            // 🔥 Preserve newlines but ensure each paragraph is italicized
            const formattedDescription = func.description
                ? func.description
                    .trim()
                    .split(/\n{2,}/) // Split at double newlines to keep paragraphs
                    .map(para => `_${para.trim()}_`) // Wrap each paragraph in italics
                    .join('\n\n') // Join paragraphs with newlines
                : '';

            return [
                `### \`${func.name}(${func.params
                    .map(p => `${p.name}${p.optional ? '?' : ''}: ${p.type}`)
                    .join(', ')}) : ${returnType}\``,
                formattedDescription, // 🔥 Properly formatted multi-paragraph description
                params ? `**Parameters:**\n${params}` : ''
            ]
                .filter(part => part.trim() !== '')
                .join('\n\n');
        })
        .join('\n\n---\n\n');
}

function formatObjectHover(obj: ServoyObject): string {
    return obj.description ? `_${obj.description}_` : '';
}