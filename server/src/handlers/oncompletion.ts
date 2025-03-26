import { CompletionItem, CompletionItemKind, CompletionList, CompletionParams, CompletionTriggerKind, InsertTextFormat } from 'vscode-languageserver/node';
import { connection, documents } from '../server';
import { IntelliStore } from '../IntelliStore';
import { getChain } from '../util/tokenizer';
import { formatFunctionDetail, formatFunctionDocs, formatSnippet } from '../util/format';
import { ScopeManager } from '../globis/ScopeManager';
import { URI } from 'vscode-uri';

export const oncomplete = (
    params: CompletionParams
): CompletionList | undefined => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return CompletionList.create([], true);

    const store = IntelliStore.getInstance();
    const scopeManager = ScopeManager.getInstance();

    const text = document.getText();
    const offset = document.offsetAt(params.position);

    const prevChar = text[offset - 2];
    const currChar = text[offset - 1];

    const shouldRefresh = prevChar === '.' && /[a-zA-Z0-9_$]/.test(currChar);

    const chain = getChain(text, offset);
    if (!chain) return CompletionList.create([], false);

    const forceSuggestions = () => {
        setTimeout(() => {
            void connection.sendNotification('globis-lsp/forceCompletionRefresh', {
                textDocument: params.textDocument,
                position: params.position
            }).then(() => console.log('sent')).catch(err => console.dir(err)) ;
        }, 50);
    };

    if (!chain.includes('.')) {
        // first part of a chain
        // return servoy objects and 'scopes'
        const items: CompletionItem[] = [...store.objectNames, 'scopes'].map(name => ({
            sortText: `!${name}`,
            label: name,
            kind: CompletionItemKind.Module,
            detail: 'Servoy Global Object'
        }));

        return CompletionList.create(items, true);
    }

    const parts = chain.split('.');

    if (parts[0] === 'scopes' && parts.length === 2) {
        const solution = scopeManager.getSolutionForPath(URI.parse(params.textDocument.uri).fsPath);
        if (!solution) return CompletionList.create([], false);

        const modules = scopeManager.getModuleNamesAndOrigin(solution.name);
        const names = scopeManager.getModuleNames(solution.name);
        const partial = parts[1];
        const filtered = partial === '' ? names : IntelliStore.filterByDistance(names, partial);

        const items: CompletionItem[] = filtered.map(name => ({
            sortText: `!${name}`,
            label: name,
            kind: CompletionItemKind.Module,
            detail: `Scope<${modules.find(m => m.name === name)?.origin}/${name}>`
        }));

        if (params.context?.triggerKind === CompletionTriggerKind.TriggerForIncompleteCompletions && shouldRefresh) {
            forceSuggestions();
        }

        return CompletionList.create(items, true);
    }

    if (parts.length === 2) {
        // a two part chain
        // aka databaseManager.acquireLock()
        const obj = store.getServoyObject(parts[0]);
        if (!obj) return CompletionList.create([], false);
        const partial = parts[1];

        const objFunctions = [...new Set(obj.functions.map(f => f.name)).values()];
        const filtered = partial === '' ? objFunctions : IntelliStore.filterByDistance(objFunctions, partial);

        const items: CompletionItem[] = filtered.map(name => ({
            label: `${name}`,
            preselect: true,
            filterText: name,
            sortText: `0000_${name}`,
            kind: CompletionItemKind.Method,
            detail: formatFunctionDetail(...obj.functions.filter(f => f.name === name)),
            documentation: {
                kind: 'markdown',
                value: formatFunctionDocs(...obj.functions.filter(f => f.name === name))
            },
            commitCharacters: ['.', '('],
            insertText: formatSnippet(obj.functions.find(f => f.name === name)!),
            insertTextFormat : InsertTextFormat.Snippet,
            command: {
                command: 'editor.action.triggerParameterHints',
                title: 'Trigger Parameter Hints'
            }
        }));

        if (params.context?.triggerKind === CompletionTriggerKind.TriggerForIncompleteCompletions && shouldRefresh) {
            forceSuggestions();
        }

        return CompletionList.create(items, true);
    }

    return CompletionList.create([], true);
};