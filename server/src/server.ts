import {
    createConnection,
    ProposedFeatures,
    TextDocuments
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import { extractGlobisGlobals } from './globis/extractGlobisGlobals';
import { ScopeManager } from './globis/ScopeManager';
import { oncomplete } from './handlers/oncompletion';
import { ondefinition } from './handlers/ondefinition';
import { onhover } from './handlers/onhover';
import { onInit } from './handlers/oninitialize';
import { onsignaturehelp } from './handlers/onsignaturehelp';
import { IntelliStore } from './IntelliStore';
import { Cache } from './useCache';
import { Config, ExtensionConfig } from './useConfig';
import { onDidChangeContent } from './handlers/ondidchangecontent';

export const connection = createConnection(ProposedFeatures.all);
export const documents = new TextDocuments(TextDocument);

connection.onInitialize(async params => {
    const workspaceFolder = params.workspaceFolders?.[0].uri ? URI.parse(params.workspaceFolders?.[0].uri).fsPath : process.cwd();
    console.log(`Workspace folder: ${workspaceFolder}`);

    Cache.initialize(workspaceFolder);
    Config.initialize((params.initializationOptions as ExtensionConfig) ?? null);
    await IntelliStore.initialize(workspaceFolder);
    await ScopeManager.initialize(workspaceFolder);

    await extractGlobisGlobals(workspaceFolder); // extract globis intellisense data

    connection.window.showInformationMessage('Loaded Servoy and Globis docs successfully!');

    return onInit();
});
connection.onCompletion(oncomplete);
connection.onHover(onhover);
connection.onSignatureHelp(onsignaturehelp);
connection.onDefinition(ondefinition);

documents.onDidChangeContent(change => onDidChangeContent(change.document));

const main = () => {
    documents.listen(connection);
    connection.listen();
};

main();