export const getChain = (text:string, position: number): string => {
    let i = position - 1;
    const parts: string[] = [];
    let current = '';
    let lastWasDot = false;

    const isIdentifierChar = (ch: string) => /[a-zA-Z0-9_$]/.test(ch);
    const isSkippable = (ch: string) => ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';

    while (i >= 0) {
        const char = text[i];

        if (isIdentifierChar(char)) {
            current = char + current;
            lastWasDot = false;
        } else if (char === '.') {
            parts.unshift(current);
            current = '';
            lastWasDot = true;
        } else if (isSkippable(char)) {
            // skip
        } else {
            break;
        }

        i--;
    }

    if (current || lastWasDot) {
        parts.unshift(current);
    }

    return parts.join('.');
};