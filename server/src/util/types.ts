import { Type } from 'doctrine';

export interface TypeInfo {
    name: string
    optional?: boolean
    isArray?: boolean
    arrayDepth?: number
    genericArgs?: TypeInfo[]
    dbTableRef?: string
}

export const javaTypeMap: Record<string, string> = {
    // Primitives
    'java.lang.String': 'string',
    'java.lang.Integer': 'number',
    'java.lang.Double': 'number',
    'java.lang.Float': 'number',
    'java.lang.Long': 'number',
    'java.lang.Boolean': 'boolean',
    'java.util.Date': 'Date',
    'java.util.List': 'Array<any>',
    'java.util.Map': 'Record<string, any>',
    'java.lang.Object': 'any',
    'java.lang.Number': 'number',
    'java.util.data': 'any',

    // short primitives
    'int': 'number',
    'boolean': 'boolean',
    'void': 'void',
    'any': 'any',
    'double': 'number',
    'float': 'number',
    'char': 'string',
    'long': 'number',

    // servoy
    'com.servoy.j2db.scripting.JSLogger': 'JSLogger',
    'com.servoy.j2db.util.UUID': 'UUID',
    'com.servoy.j2db.scripting.JSMap': 'JSMap',
    'com.servoy.j2db.scripting.JSBloblLoaderBuilder': 'JSBlobLoaderBuilder',
    'com.servoy.j2db.dataprocessing.JSDataSet': 'JSDataSet',
    'com.servoy.j2db.scripting.JSWindow': 'JSWindow',

    // JS
    'org.mozilla.javascript.Function': 'Function',
    'org.mozilla.javascript.NativeArray': 'Array<any>',
    'org.mozilla.javascript.NativeObject': 'object'
};

const primitiveTypeMap: Record<string, string> = {
    'I': 'number',
    'Z': 'boolean',
    'B': 'byte',
    'D': 'number', // double
    'F': 'number', // float
    'J': 'number', // long
    'S': 'number', // short
    'C': 'string' // char
};

export const mapJavaToJsType = (typeCode: string, typeMap?: Map<string, string>): TypeInfo => {
    // Multidim
    const arrayMatch = /^(\[+)(L?)([^;[]+)[;]?$/.exec(typeCode);
    if (arrayMatch) {
        const brackets = arrayMatch[1];
        const isObject = arrayMatch[2] === 'L';
        const baseType = arrayMatch[3];

        const depth = brackets.length;
        let inner: TypeInfo;

        if (isObject) {
            inner = mapJavaToJsType(baseType, typeMap);
        } else {
            const mappedPrimitive = primitiveTypeMap[baseType];
            if (!mappedPrimitive) {
                console.warn('Unknown primitive array base type: ', baseType);
                inner = {name: baseType};
            } else {
                inner = parseTypeFromString(mappedPrimitive);
            }
        }

        return {
            ...inner,
            isArray: true,
            arrayDepth: depth + (inner.arrayDepth ?? 0)
        };
    }

    const mapped = javaTypeMap[typeCode];
    if (mapped) {
        return parseTypeFromString(mapped);
    }

    if (typeMap) {
        for (const [qualifiedName, scriptingName] of typeMap.entries()) {
            if (typeCode.endsWith(qualifiedName)) {
                return {name: scriptingName};
            }
        }
    }

    console.warn(`Unknown Java type: ${typeCode}`);
    return {name: typeCode};
};

export const parseTypeFromString = (str: string): TypeInfo => {
    const genericRegex = /^(\w+)<(.+)>$/;
    const genericMatch = genericRegex.exec(str);
    if (genericMatch) {
        const base = genericMatch[1]; // outside type
        const gen = genericMatch[2]; // inside type
        const db = gen.startsWith('db:/') ? gen.slice(4) : undefined; // if theres a ref to a table
        return {
            name: base,
            genericArgs: [parseTypeFromString(gen)],
            dbTableRef: db
        };
    }

    if (str.endsWith('[]')) {
        const inner = str.slice(0, -2);
        return {...parseTypeFromString(inner), isArray: true};
    }

    return {name: str};
};

export const inferTypeFromValue = (value: unknown): TypeInfo => {
    if (typeof value === 'string') return {name: 'string'};
    if (typeof value === 'number') return {name: 'number'};
    if (typeof value === 'boolean') return {name: 'boolean'};
    if (Array.isArray(value)) {
        const elType = value.length > 0 ? inferTypeFromValue(value[0]) : {name: 'any'};
        return {...elType, isArray: true};
    }
    if (value instanceof Date) return {name: 'Date'};
    if (value && typeof value === 'object') return {name: 'object'};
    return {name: 'any'};

};

export const parseJSDocType = (type: Type | null | undefined): TypeInfo => {
    const allowedToLower = ['string', 'number', 'boolean', 'bigint', 'undefined', 'null', 'symbol'];

    if (!type) return {name: 'unknown'};

    switch (type.type) {
        case 'NameExpression': {
            const name = type.name.trim();
            if (name === 'Array') return {name: 'unknown', arrayDepth: 1, isArray: true};

            const lower = name.toLowerCase();
            return allowedToLower.includes(lower)
                ? {name: lower}
                : {name};
        }

        case 'OptionalType': {
            // todo
            const inner = parseJSDocType(type.expression);
            return {...inner, optional: true};
        }

        case 'UnionType': {
            // todo
            return {name: 'any'};
        }

        case 'ArrayType': {
            const elType = parseJSDocType(type.elements[0]);
            return {
                ...elType,
                arrayDepth: 1 + (elType.arrayDepth ?? 0)
            };
        }

        case 'TypeApplication': {
            if (type.expression.type !== 'NameExpression') return {name: 'unknown'};
            const base = type.expression.name;
            const args = Array.isArray(type.applications) ? type.applications : [type.applications];

            const genArgs = args.map(parseJSDocType);
            const dbArg = genArgs[0]?.name?.startsWith('db:/') ? genArgs[0].name.slice(4) : undefined;

            return {
                name: base,
                genericArgs: genArgs,
                dbTableRef: dbArg
            };
        }

        /* case 'RecordType': {

        } */

        default:
            if ('type' in type && (type.type as unknown) === 'StringLiteralType') {
                // because @types/doctrine does not have StringLiteralType
                return {name: (type as unknown as { value:string }).value.replace(/^"|"$/g, '')};
            }
            console.warn('Unknown doctrine type:', type);
            return {name: 'unknown'};
    }
};

export const isAssignable = (from: TypeInfo, to: TypeInfo): boolean => {
    if (to.name === 'any') return true;
    if (from.name === to.name) {
        if (!!from.isArray !== !!to.isArray) return false;
        return true;
    }
    return false;
};

export const stringifyType = (t: TypeInfo): string => {
    const base = t.name + (t.genericArgs?.length ? `<${t.genericArgs.map(stringifyType).join(', ')}>` : '');
    return t.isArray ? `${base}[]` : base;
};