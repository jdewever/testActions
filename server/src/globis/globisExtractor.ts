import { AnonymousFunctionDeclaration, Comment, FunctionDeclaration, Node, Statement, VariableDeclarator } from 'acorn';
import { ancestor } from 'acorn-walk';
import { parse as docParse } from 'doctrine';
import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { IClass, IFunction, IParam, IResult, IVariable } from '../interfaces';
import { Cache } from '../useCache';
import { generateASTWithComments } from '../util/ast';
import { parseJSDocType, stringifyType } from '../util/types';

const emptyVarDoc = () => ({description: 'No description provided for this variable', type: 'unknown'} as Omit<IVariable, 'name'>);
const emptyFuncDoc = () => ({description: 'No description provided for this function / method', params: [], returns: 'void'} as Omit<IFunction, 'name'>);
const emptyClassDoc = () => ({description: 'No description provided for this class', methods: [], variables: [], params: []} as Omit<IClass, 'name'>);
const returnTagTitles = ['return', 'returns'];

export const extractFromGlobis = async(fpath: string, workspaceFolder: string, savePath?: string, doSave = false) => {
    const cache = Cache.getInstance();

    try {
        const parsed = await parseFile(fpath);
        let rel = relative(workspaceFolder, fpath);
        rel = `${rel.substring(0, rel.lastIndexOf('.'))}.json`;
        if (doSave && savePath) await cache.save(join(savePath, rel), JSON.stringify(parsed, null, 2));
        return parsed;
    } catch (err) {
        console.error(err);
    }
};

const parseFile = async(fpath:string) => {
    const content = await readFile(fpath, 'utf-8');

    const {ast, comments: commentsByLineEnd} = generateASTWithComments(content);

    const processVariableDeclarator = (node: VariableDeclarator, parents: Node[]) => {
        const isTop = !parents.some(p => p.type === 'FunctionDeclaration');

        if (node.id.type === 'Identifier' && isTop) {
            const comment = commentsByLineEnd[node.loc!.start.line];
            const parsedDoc: Omit<IVariable, 'name'> = comment ? parseVarJSDoc(comment) ?? emptyVarDoc() : emptyVarDoc();

            result.variables.push({
                ...parsedDoc,
                name: node.id.name,
                filePath: fpath,
                position: node.loc!.start
            });
        }
    };

    const processClassNode = (node: Statement, className: string): IClass | undefined => {
        if (!(node.type === 'ExpressionStatement' &&
            node.expression.type === 'AssignmentExpression' &&
            node.expression.left.type === 'MemberExpression' &&
            node.expression.left.object.type === 'ThisExpression' &&
            node.expression.left.property.type === 'Identifier'
        )) return;

        const comment = commentsByLineEnd[node.loc!.start.line];
        const name = node.expression.left.property.name;
        let cm = classMap.get(className);
        if (!cm) cm = {...emptyClassDoc(), name: className};

        if (node.expression.right.type === 'FunctionExpression' || node.expression.right.type === 'ArrowFunctionExpression') {
            // class method
            const doc: Omit<IFunction, 'name'> = comment ? parseFunctionJSDoc(comment) : emptyFuncDoc();
            const params: IParam[] = node.expression.right.params
                .map(p => {
                    if (p.type === 'Identifier') {
                        return {
                            name: p.name,
                            type: 'unknown',
                            description: 'No description provided for this parameter'
                        } as IParam;
                    }
                }).filter(p => p !== undefined);

            cm.methods.push({
                name,
                params: mergeParams(doc.params, params),
                description: doc.description,
                returns: doc.returns,
                filePath: fpath,
                position: node.loc!.start
            });
        } else if (node.expression.right.type === 'Literal') {
            const doc: Omit<IVariable, 'name'> = comment ? parseVarJSDoc(comment) ?? emptyVarDoc() : emptyVarDoc();

            cm.variables.push({
                name,
                type: doc.type,
                description: doc.description,
                filePath: fpath,
                position: node.loc!.start,
                deprecated: doc.deprecated
            });
        }

        classMap.set(className, cm);
    };

    const processFunctionDeclaration = (node: FunctionDeclaration | AnonymousFunctionDeclaration) => {
        if (!node.id) return;

        const name = node.id.name;
        const comment = commentsByLineEnd[node.loc!.start.line];

        if (!isClass(node)) {
            const parsedDoc: Omit<IFunction, 'name'> = comment ? parseFunctionJSDoc(comment) : emptyFuncDoc();
            result.functions.push({
                ...parsedDoc,
                name,
                filePath: fpath,
                position: node.loc!.start
            });
        } else {
            const parsedDoc: Omit<IClass, 'name'> = comment ? parseClassJSDoc(comment) : emptyClassDoc();
            node.body.body.forEach(cnode => processClassNode(cnode, name));

            let cm = classMap.get(name);
            if (!cm) cm = {...emptyClassDoc(), name};

            result.classes.push({
                ...parsedDoc,
                name,
                filePath: fpath,
                position: node.loc?.start
            });
        }
    };

    const result: IResult = {functions: [], variables: [], classes: []};
    const classMap = new Map<string, IClass>;

    ancestor(ast, {
        VariableDeclarator(node, state, parents) {
            processVariableDeclarator(node, parents);
        },
        FunctionDeclaration(node) {
            processFunctionDeclaration(node);
        }
    });
    return result;
};

const parseVarJSDoc = (comment: Comment): Omit<IVariable, 'name'> | undefined => {
    try {
        const parsed = docParse(comment.value, {unwrap: true, sloppy: true, lineNumbers: true, recoverable: true});
        const doc = emptyVarDoc();

        if (parsed.description.trim() !== '') {
            doc.description = parsed.description.trim();
        }
        const typeTag = parsed.tags?.find(t => t.title === 'type');
        if (typeTag) {
            const typeinfo = parseJSDocType(typeTag?.type);
            doc.typeInfo = typeinfo;
            doc.type = stringifyType(typeinfo);
        }


        return doc;
    } catch (err) {
        console.error(err);
    }
};

const parseFunctionJSDoc = (comment: Comment): Omit<IFunction, 'name'> => {
    const parsed = docParse(comment.value, {unwrap: true, sloppy: true, lineNumbers: true, recoverable: true});
    const doc = emptyFuncDoc();

    if (parsed.description.trim() !== '') {
        doc.description = parsed.description.trim();
    }
    const returnTag = parsed.tags.find(t => returnTagTitles.includes(t.title.toLowerCase()));
    if (returnTag) {
        const returnTypeInfo = parseJSDocType(returnTag.type);
        if (returnTypeInfo) {
            doc.returns = stringifyType(returnTypeInfo);
            doc.typeInfo = returnTypeInfo;
        }
    } else {
        // no return tag => void return
        doc.returns = 'void';
        doc.typeInfo = {name: 'void'};
    }


    const pTags = parsed.tags?.filter(t => t.title === 'param' && t.name);
    pTags.map(tag => {
        const pTypeInfo = parseJSDocType(tag.type);

        doc.params.push({
            name: tag.name!,
            typeInfo: pTypeInfo,
            type: stringifyType(pTypeInfo),
            description: tag.description?.trim() ?? 'No description provided for this parameter',
            optional: pTypeInfo.optional ?? false
        });
    });

    return doc;
};

const parseClassJSDoc = (comment: Comment): Omit<IClass, 'name'> => {
    const parsed = docParse(comment.value, {unwrap: true, sloppy: true, lineNumbers: true, recoverable: true});
    const doc = emptyClassDoc();

    if (parsed.description !== '') doc.description = parsed.description.trim();

    const pTags = parsed.tags.filter(t => t.title === 'param' && t.name);
    pTags.forEach(tag => {
        const pTypeInfo = parseJSDocType(tag.type);

        doc.params.push({
            name: tag.name!,
            typeInfo: pTypeInfo,
            type: stringifyType(pTypeInfo),
            description: tag.description?.trim() ?? 'No description provided for this parameter',
            optional: pTypeInfo.optional ?? false
        });
    });

    const ext = parsed.tags.find(t => t.title === 'extends');
    if (ext && ext.type?.type === 'NameExpression') {
        doc.extends = ext.type.name;
    }

    return doc;
};

const isClass = (node: FunctionDeclaration) => (node.body.body.some(n =>
    n.type === 'ExpressionStatement' &&
      n.expression.type === 'AssignmentExpression' &&
      n.expression.left.type === 'MemberExpression' &&
      n.expression.left.object.type === 'ThisExpression' &&
      n.expression.left.property.type === 'Identifier'
));

const mergeParams = (docParams: IParam[], astParams: IParam[]): IParam[] => {
    const docMap = new Map(docParams.map((p) => [p.name, p]));

    const merged: IParam[] = astParams.map((astParam) => {
        const docParam = docMap.get(astParam.name);
        docMap.delete(astParam.name);

        return {
            name: astParam.name,
            type: docParam?.type ?? astParam.type,
            typeInfo: docParam?.typeInfo ?? astParam.typeInfo,
            description: docParam?.description ?? astParam.description,
            optional: docParam?.optional ?? astParam?.optional ?? false
        };
    });

    for (const docParam of docParams) {
    // params specified in jsdoc but not seen in AST
        if (!merged.find(p => p.name === docParam.name)) {
            merged.push(docParam);
        }
    }

    return merged;
};