import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { IFunction, IVariable } from '../interfaces';
import { ServoyDoc } from '../servoyDocInterfaces';
import { mapJavaToJsType, stringifyType, TypeInfo } from '../util/types';

export interface ServoyObject {
    name: string
    functions: IFunction[]
    constants: IVariable[]
    properties: IVariable[]
    description: string
}

export async function parseServoyDoc(): Promise<ServoyObject[]> {
    try {
        const filePath = join(__dirname, '..', '..', '..', 'docs', 'servoydoc.json');
        const rawData = await readFile(filePath, 'utf-8');
        const jsonData = JSON.parse(rawData) as ServoyDoc;

        const typecodeToScriptingName = new Map<string, string>();

        for (const obj of jsonData.servoydoc.runtime.object) {
            if (obj._qualifiedName && obj._scriptingName) {
                typecodeToScriptingName.set(obj._qualifiedName, obj._scriptingName);
            }
        }

        const safeMapType = (typeCode?:string): TypeInfo => mapJavaToJsType(typeCode ?? 'any', typecodeToScriptingName);

        const servoyObjects: ServoyObject[] = [];

        if (!jsonData.servoydoc?.runtime) {
            console.error('Invalid Servoy documentation format.');
            return [];
        }

        for (const obj of jsonData.servoydoc.runtime.object) {
            if (!obj._scriptingName) continue; // skip obj that are not viable global candidates
            const objectName: string = obj._scriptingName;
            const qualifiedName: string = obj._qualifiedName ?? '';
            const extendsComponent: string | null = obj._extendsComponent ?? null;

            if (qualifiedName.startsWith('I')) {
                // This is an interface (hopefully)
                // i mean probably can also just be an object whose name starts with an I
                // hmmmm
                // TODO
            } else if (extendsComponent) {
                // extends something
                // TODO
            } else if (objectName === 'Globals') {
                // we do this already
                // TODO still need to not show this as any
                continue;
            } else if (qualifiedName.startsWith('JS')) {
                // we think this is a type
                // TODO check if this is right
            } else {
                const functions: IFunction[] = [];
                const constants: IVariable[] = [];
                const properties: IVariable[] = [];

                if (obj.functions?.function) {
                    const functionList = Array.isArray(obj.functions.function)
                        ? obj.functions.function
                        : [obj.functions.function];

                    for (const func of functionList) {
                        const params = func.parameters?.parameter
                            ? Array.isArray(func.parameters.parameter)
                                ? func.parameters.parameter.map((param) => {
                                    const typeInfo = safeMapType(param._typecode);
                                    return {
                                        name: param._name,
                                        type: stringifyType(typeInfo),
                                        typeInfo,
                                        description: param.description ?? ''
                                    };
                                })
                                : [
                                    {
                                        name: func.parameters.parameter._name,
                                        type: stringifyType(safeMapType(func.parameters.parameter._typecode)),
                                        typeInfo: safeMapType(func.parameters.parameter._typecode),
                                        description: func.parameters.parameter.description ?? ''
                                    }
                                ]
                            : [];

                        const returnTypeInfo = safeMapType(func.return?._typecode);
                        functions.push({
                            name: func._name,
                            params,
                            returns: stringifyType(returnTypeInfo),
                            typeInfo: returnTypeInfo,
                            description: func.descriptions?.description?.__cdata ?? ''
                        });
                    }
                }

                if (obj.constants?.constant) {
                    const constantList = Array.isArray(obj.constants.constant)
                        ? obj.constants.constant
                        : [obj.constants.constant];
                    for (const constant of constantList) {
                        const typeInfo = safeMapType(constant.return?._typecode);
                        constants.push({
                            name: constant._name,
                            type: stringifyType(typeInfo),
                            typeInfo,
                            description: constant.descriptions?.description?.__cdata ?? '',
                            deprecated: constant._deprecated
                                ? constant.deprecated ?? 'Deprecated'
                                : undefined
                        });
                    }
                }

                if (obj.properties?.property) {
                    const propertyList = Array.isArray(obj.properties.property)
                        ? obj.properties.property
                        : [obj.properties.property];
                    for (const property of propertyList) {
                        const typeInfo = safeMapType(property.return?._typecode);
                        properties.push({
                            name: property._name,
                            type: stringifyType(typeInfo),
                            typeInfo,
                            description: property.descriptions?.description?.__cdata ?? ''
                        });
                    }
                }

                servoyObjects.push({
                    name: objectName,
                    functions,
                    constants,
                    properties,
                    description: obj.description ?? 'no description'
                });
            }
        }

        return servoyObjects;
    } catch (error) {
        console.error('Error reading Servoy Documentation', error);
        return [];
    }
}