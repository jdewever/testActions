import { IFunction } from '../interfaces';

export const formatFunctionDetail = (...funcs: IFunction[]): string => {
    return funcs.map(func => {
        const params = func.params.map(p => `${p.name}${p.optional ? '?' : ''}: ${p.type}`).join(', ');
        return `(method) ${func.name}(${params}): ${func.returns}`;
    }).join('\n');
};

export const formatFunctionDocs = (...funcs: IFunction[]): string => {
    return funcs.map(func => {
        let doc = `**${func.name}**\n\n`;
        doc += `_${func.description}_\n\n`;
        func.params.forEach(p => {
            doc += `- **${p.name}** (${p.type})${p.optional ? '_(optional)_' : ''}: ${p.description}\n`;
        });
        return doc;
    }).join('\n---\n');
};

export const formatSnippet = (func: IFunction): string => {
    const paramSnip = func.params.map((p, index) =>
        p.optional ? `[\${${index + 1}:${p.name}}]` : `\${${index + 1}:${p.name}}`
    ).join(',');
    return `${func.name}(${paramSnip})`;
};