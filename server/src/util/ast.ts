import { parse, Comment, Program, Token, Options, defaultOptions, Position, Node } from 'acorn';

export const generateASTWithComments = (content: string): { ast: Program, comments: Record<number, Comment> } => {
    let accumulatedComments: Comment[] = [];
    const commentsByLineEnd: Record<number, Comment> = {};
    const onToken = (token: Token) => {
        const eventualComment = accumulatedComments.find(c => c.loc!.end.line + 1 === token.loc!.start.line);
        if (eventualComment) {
            commentsByLineEnd[eventualComment.loc!.end.line + 1] = eventualComment!;
        }
        accumulatedComments = [];
    };
    const onComment = (isBlock:boolean, value:string, start:number, end:number, startLoc: Position | undefined, endLoc: Position | undefined) => {
        accumulatedComments.push({
            type: isBlock ? 'Block' : 'Line',
            value,
            start,
            end,
            loc: startLoc && endLoc ? {start: startLoc, end: endLoc} : undefined,
            range: [start, end]
        });
    };
    const acornOptions: Options = {...defaultOptions, ecmaVersion: 2020, locations: true, onToken, onComment};

    const ast = parse(content, acornOptions);

    return {ast, comments: commentsByLineEnd};
};

export const getJSDocForNode = (node: Node, comments: Record<number, Comment>): string | undefined => {
    const line = node.loc!.start.line;
    const commentsOnly = Object.values(comments);
    return commentsOnly.find(c =>
        c.type === 'Block' &&
        c.loc &&
        c.loc.end.line + 1 === line &&
        c.value.startsWith('*')
    )?.value;
};