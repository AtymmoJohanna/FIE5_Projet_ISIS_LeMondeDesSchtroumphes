import { CodegenConfig } from '@graphql-codegen/cli';
const config: CodegenConfig = {
    schema: [
        './src/app/graphql/schema.graphql',
        {
            './src/app/**/*.state.ts': {
                noRequire: true,
            },
        },
    ],
    config: {
        importSchemaTypesFrom: './src/app/graphql/types.ts',
        useTypeImports: true,
        operationResultSuffix: 'Data',
        dedupeOperationSuffix: true,
        inlineFragmentTypes: 'combine',
        avoidOptionals: {
            field: true,
        },
    },
    generates: {
        './src/app/graphql/types.ts': {
            plugins: [
                {
                    add: {
                        content: '/* eslint-disable */',
                    },
                },
                'typescript',
            ],
        },
        './src/app/graphql/operations.ts': {
            documents: ['./src/app/graphql/**/*.graphql', '!./src/app/graphql/schema.graphql'],
            plugins: [
                {
                    add: {
                        content: '/* eslint-disable */',
                    },
                },
                'typescript-operations',
                '@apollo-orbit/codegen',
            ],
        },
    },
};
export default config;