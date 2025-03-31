export const javaTSypeMappings: Record<string, string> = {
    // todo append with more types as we need them, these are just basics
    'java.lang.String': 'string',
    'java.lang.Integer': 'number',
    'java.lang.Double': 'number',
    'java.lang.Float': 'number',
    'java.lang.Long': 'number',
    'java.lang.Boolean': 'boolean',
    'java.util.List': 'Array<any>',
    'java.util.Map': 'Record<string, any>',
    'java.util.Date': 'Date',
    'java.math.BigDecimal': 'number',
    'java.sql.Timestamp': 'Date',
    'java.sql.Time': 'Date',
    'java.sql.Date': 'Date',
    'java.lang.Object': 'any',
    'int': 'number'
};

export const mapJavaToTS = (jtype: string): string => {

    if (!jtype?.trim()) return 'unknown';

    const arrayRegex = /^\[L(.+);$/;
    const arrayMatch = arrayRegex.exec(jtype);
    if (arrayMatch) {
        return `${mapJavaToTS(arrayMatch[1])}[]`;
    }

    if (jtype.startsWith('java.util.List<')) {
        const innerRegex = /<(.+)>/;
        const innerType = innerRegex.exec(jtype)?.[1] ?? 'any';
        return `Array<${mapJavaToTS(innerType)}>`;
    }
    if (jtype.startsWith('java.util.Map<')) {
        const innerRegex = /<(.+),\s?(.+)>/;
        const innerTypes = innerRegex.exec(jtype);
        const keyType = innerTypes?.[1] ?? 'string';
        const valueType = innerTypes?.[2] ?? 'any';
        return `Record<${mapJavaToTS(keyType)}, ${mapJavaToTS(valueType)}>`;
    }
    return javaTSypeMappings[jtype] || 'unknown';
};