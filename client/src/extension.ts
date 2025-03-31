import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { commands, ExtensionContext, window, workspace } from 'vscode';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

const startLanguageServer = async(context: ExtensionContext) => {
    if (!isGlobisRepo()) {
        // TODO Do we want this?
        console.warn('Not in a globis-online repository; not activating Globis LSP');
        return;
    } else {
        console.log('Globis repo found, activating Globis LSP!');
    }

    const serverModule = context.asAbsolutePath(
        join('server', 'out', 'server.js')
    );

    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: { module: serverModule, transport: TransportKind.ipc }
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'javascript' }],
        synchronize: {
            fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
        },
        initializationOptions: workspace.getConfiguration('globis-lsp')
    };

    client = new LanguageClient(
        'globis-lsp',
        'Globis Language Server',
        serverOptions,
        clientOptions
    );

    await client.start();

    client.onNotification('globis-lsp/forceCompletionRefresh', () => {
        commands.executeCommand('hideSuggestWidget').then(() => {
            setTimeout(() => {
                commands.executeCommand('editor.action.triggerSuggest').then(() => console.log('Refreshed'));
            }, 50);
        });
    });
};

export const activate = async(context: ExtensionContext) => {

    await startLanguageServer(context);

    const restartCommand = commands.registerCommand('globis-lsp.restart', async() => {
        if (client) {
            await client.stop();
            window.showInformationMessage('Restarting Globis LSP...');
        }

        await startLanguageServer(context);
    });

    workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('globis-lsp')) {
            commands.executeCommand('globis-lsp.restart');
        }
    });

    context.subscriptions.push(restartCommand);

};

export const deactivate = (): Thenable<void> | undefined => {
    if (!client) return undefined;
    return client.stop();
};

const isGlobisRepo = (): boolean => {
    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders || !(workspaceFolders.length > 0)) {
        return false;
    }
    for (const folder of workspaceFolders) {
        const folderPath = folder.uri.fsPath;

        try {
            const gitRemoteURL = execSync('git remote get-url origin', {cwd: folderPath, encoding: 'utf-8'}).trim();
            if (gitRemoteURL.includes('globis-online.git')) {
                return true;
            }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
            // console.warn('Not in a globis-online repository');
        }

    }
    return false;
};