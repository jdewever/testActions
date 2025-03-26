import { BlockStatement, CallExpression, Comment, VariableDeclaration } from 'acorn';
import { recursive, WalkerCallback } from 'acorn-walk';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { IntelliStore } from '../IntelliStore';
import { connection } from '../server';
import { generateASTWithComments, getJSDocForNode } from '../util/ast';
import { parseVarJSDoc } from '../util/jsdoc';
import { inferTypeFromValue, isAssignable, stringifyType, TypeInfo } from '../util/types';

const createCommentFromValue = (value: string): Comment => ({
    type: 'Block',
    value,
    start: 0,
    end: 0
});

export const onDidChangeContent = (document: TextDocument) => {
    const content = document.getText();
    const diagnostics: Diagnostic[] = [];
    const store = IntelliStore.getInstance();
    const scopeStack: Map<string, TypeInfo>[] = [new Map<string, TypeInfo>()];

    try {
        const {ast, comments} = generateASTWithComments(content);
        const processCallExpression = (node: CallExpression) => {
            if (node.callee.type !== 'MemberExpression' || node.callee.computed) return;
            if (node.callee.object.type !== 'Identifier' || node.callee.property.type !== 'Identifier') return;

            const objectName = node.callee.object.name;
            const methodName = node.callee.property.name;
            const fullName = `${objectName}.${methodName}`;

            const obj = store.getServoyObject(objectName);
            if (!obj) return;

            const overloads = obj.functions.filter(f => f.name === methodName);
            if (!overloads?.length) return;

            const args = node.arguments;
            let hasMatchingOverload = false;
            let bestMismatch: string[] = [];

            for (const func of overloads) {
                let isMatch = true;
                const mismatchDetails: string[] = [];

                for (let i = 0; i < args.length; i++) {
                    const expected = func.params[i];
                    const arg = args[i];
                    let actual: TypeInfo;

                    if (arg.type === 'Literal') {
                        const val = arg.value!;
                        actual = val === null ? {name: 'null'} : inferTypeFromValue(arg.value);
                    } else if (arg.type === 'Identifier') {
                        const varName = arg.name;
                        actual = {name: 'any'};

                        for (let j = scopeStack.length - 1; j >= 0; j--) {
                            const scoped = scopeStack[j].get(varName);
                            if (scoped) {
                                actual = scoped;
                                break;
                            }
                        }
                    } else {
                        actual = {name: 'any'};
                    }

                    if (!expected) {
                        mismatchDetails.push(`Argument ${i + 1}: unexpected`);
                        isMatch = false;
                        continue;
                    }

                    if (actual.name === 'null' && expected.optional) {
                        continue;
                    }

                    if (!isAssignable(actual, expected.typeInfo!)) {
                        mismatchDetails.push(`Argument ${i + 1} ('${expected.name}'): expected ${stringifyType(expected.typeInfo!)}, got ${stringifyType(actual)}`);
                        isMatch = false;
                    }

                };

                const requiredCount = func.params.filter(p => !p.optional).length;
                if (args.length < requiredCount || args.length > func.params.length) {
                    isMatch = false;
                    mismatchDetails.push(`Incorrect number of arguments: expected ${requiredCount}-${func.params.length}, got ${args.length}`);
                }

                if (isMatch) {
                    hasMatchingOverload = true;
                    break;
                } else if (!bestMismatch.length || mismatchDetails.length < bestMismatch.length) {
                    bestMismatch = mismatchDetails;
                }
            }

            if (!hasMatchingOverload) {
                const details = bestMismatch.join(';\n');
                diagnostics.push({
                    message: `No matching overload found for function '${fullName}'.\n${details}`,
                    range: {
                        start: document.positionAt(node.start),
                        end: document.positionAt(node.end)
                    },
                    severity: DiagnosticSeverity.Error
                });
            }

        };

        const processBlockStatement = (node: BlockStatement, state: object, c:WalkerCallback<object>) => {
            scopeStack.push(new Map(scopeStack[scopeStack.length - 1]));
            for (const statement of node.body) {
                c(statement, state);
            }
            scopeStack.pop();
        };
        const processVariableDeclaration = (node: VariableDeclaration) => {
            for (const decl of node.declarations) {
                if (decl.id.type !== 'Identifier' || !decl.init) continue;
                const name = decl.id.name;
                const value = content.substring(decl.init.start, decl.init.end).trim();
                let inferred: TypeInfo = decl.init.type === 'Literal' ? inferTypeFromValue(value) : {name: 'any'};

                const jsdoc = getJSDocForNode(node, comments);
                if (jsdoc) {
                    const parsed = parseVarJSDoc(createCommentFromValue(jsdoc));
                    if (parsed?.typeInfo) inferred = parsed.typeInfo;
                }

                scopeStack[scopeStack.length - 1].set(name, inferred);
            }
        };
        recursive(ast, {}, {
            CallExpression: processCallExpression,
            BlockStatement: processBlockStatement,
            VariableDeclaration: processVariableDeclaration
        });
        void connection.sendDiagnostics({uri: document.uri, diagnostics});
    } catch (err) {
        console.error((err as Error).message);
    }
};