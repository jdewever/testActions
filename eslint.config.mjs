// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    {
        ignores: ['eslint.config.mjs', '**/out/*']
    },
    {
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                project: './tsconfig.eslint.json'
            }
        },
        plugins: {
            '@stylistic': stylistic
        },


        rules: {
            // Disables no null assertion
            '@typescript-eslint/no-non-null-assertion': 'off',
            // Disables rule that namespaces cannot be used
            '@typescript-eslint/no-namespace': 'off',
            // Prefer template literals (`I am ${name}`) instead of the '+' operator ('I am' + name)
            'prefer-template': 'error',
            // Enforce === and !== instead of == and !==
            eqeqeq: 'error',
            // Enforce template literal expressions to be of string type.
            '@typescript-eslint/restrict-template-expressions': [
                'error',
                {
                    allowNumber: true
                }
            ],

            /// The following rules are used for formatting, which is sometimes inadvisable for linters.
            /// Instead, a formatter can be used to replace these rules: https://prettier.io/ (a bit faster)
            /// One day maybe  Biome.js https://biomejs.dev/

            // Disallow spaces inside of brackets
            '@stylistic/array-bracket-spacing': 'error',
            // Enforce normalized arrow function style
            '@stylistic/arrow-spacing': [
                'error',
                {
                    before: true,
                    after: true
                }
            ],
            // Enforce that files do not contain newlines at beginning or end and a maximum of two newlines at other locations
            '@stylistic/no-multiple-empty-lines': [
                'error',
                {
                    max: 2,
                    maxEOF: 0,
                    maxBOF: 0
                }
            ],
            // Enforce one true brace style
            '@stylistic/brace-style': 'error',
            // Enforce that lines end with a semicolon
            '@stylistic/semi': ['error', 'always'],
            // Enforce single quotes on strings that are not template literals
            '@stylistic/quotes': ['error', 'single'],
            // Enforce spaces around operators (e.g. 1 + 2 instead of 1+2)
            '@stylistic/space-infix-ops': 'error',
            // Enforce space after comma
            '@stylistic/comma-spacing': 'error',
            // Enforce spacing before
            '@stylistic/space-before-blocks': ['error', 'always'],
            // Disallow trailing commas
            '@stylistic/comma-dangle': ['error', 'never'],
            // Enforce space inside of code blocks
            '@stylistic/block-spacing': ['error', 'always'],
            // Disallow spaces after opening and before closing parentheses
            '@stylistic/space-in-parens': ['error', 'never'],
            // Disallow spaces before function parentheses
            '@stylistic/space-before-function-paren': ['error', 'never'],
            // Disallow multiple spaces
            '@stylistic/no-multi-spaces': 'error',
            // Enforce spaces after unary operator that is a word (e.g. delete), but disallow space when the operator is not a word (e.g. ++)
            '@stylistic/space-unary-ops': [
                'error',
                {
                    words: true,
                    nonwords: false
                }
            ],
            // Enforce space before and after keywords (e.g. if () {} else {})
            '@stylistic/keyword-spacing': [
                'error',
                {
                    before: true,
                    after: true
                }
            ],
            // Allow the Ternary option
            '@typescript-eslint/no-unused-expressions': [
                'error',
                {
                    allowShortCircuit: true,
                    allowTernary: true
                }
            ],
            // Enforce correct indentation of 4 spaces.
            '@stylistic/indent': ['error', 4],
            // Disallow trailing spaces at the end of lines
            '@stylistic/no-trailing-spaces': 'error',
            // Enforce that files never end with a newline
            '@stylistic/eol-last': ['error', 'never']
        }
    }
);