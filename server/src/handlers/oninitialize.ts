import {
    InitializeResult,
    TextDocumentSyncKind
} from 'vscode-languageserver/node';

export const onInit = (): InitializeResult => {
    return {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            completionProvider: { triggerCharacters: ['.'] },
            hoverProvider: true,
            signatureHelpProvider: { triggerCharacters: ['(', ','] },
            definitionProvider: true
        }
    };
};