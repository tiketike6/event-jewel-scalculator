module.exports = {
    extends: '@cybozu',
    rules: {
        indent: ['warn', 4, { SwitchCase: 1 }],
        'object-curly-spacing': ['warn', 'always'],
        'space-before-function-paren': [
            'warn',
            {
                anonymous: 'always',
                named: 'never',
                asyncArrow: 'always',
            },
        ],
    },
    env: {
        browser: true,
        jquery: true,
    },
    globals: {
        dayjs: 'readonly',
    },
};
