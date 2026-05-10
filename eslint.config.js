const pluginBoundaries = require('eslint-plugin-boundaries')

// Round 0: 7 domain boundaries
// mode: 'full' → patterns are matched against the full relative file path from project root
const ELEMENTS = [
  { type: 'clawsupport', pattern: 'src/clawsupport/**/*', mode: 'full' },
  { type: 'tanasupport', pattern: 'src/tanasupport/**/*', mode: 'full' },
  { type: 'admin',       pattern: 'src/admin/**/*',       mode: 'full' },
  { type: 'launcher',    pattern: 'src/launcher/**/*',    mode: 'full' },
  { type: 'auth',        pattern: 'src/auth/**/*',        mode: 'full' },
  { type: 'services',    pattern: 'src/services/**/*',    mode: 'full' },
  { type: 'shared',      pattern: 'src/shared/**/*',      mode: 'full' },
]

// Stub plugin: existing files have react-hooks/exhaustive-deps in inline
// eslint-disable comments. ESLint v10 flat config requires the plugin to be
// registered or it treats the disable directive as an unknown-rule error.
const reactHooksStub = {
  rules: {
    'exhaustive-deps': { meta: { type: 'suggestion', schema: [] }, create: () => ({}) },
    'rules-of-hooks':  { meta: { type: 'problem',    schema: [] }, create: () => ({}) },
  },
}

const domainModules = ['clawsupport', 'tanasupport', 'admin', 'launcher', 'auth']

module.exports = [
  // Ignore generated TypeScript declaration files (no parser configured for .d.ts)
  { ignores: ['src/types/**/*.d.ts'] },
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    plugins: {
      boundaries:    pluginBoundaries,
      'react-hooks': reactHooksStub,
    },
    settings: {
      'boundaries/elements': ELEMENTS,
    },
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    linterOptions: {
      // Existing files have eslint-disable comments for rules not active in this
      // config (react-hooks, no-undef). Suppress "unused disable directive" warnings
      // so --max-warnings 0 passes.
      reportUnusedDisableDirectives: 'off',
    },
    rules: {
      // Domain modules may import from themselves + services + shared.
      // services may import from itself + shared.
      // shared may only import from itself.
      'boundaries/dependencies': ['error', {
        default: 'disallow',
        rules: [
          ...domainModules.map(mod => ({
            from: { type: mod },
            allow: { to: { type: [mod, 'services', 'shared'] } },
          })),
          // admin is a superuser view of patrol data; reuses clawsupport UI components
          { from: { type: 'admin' }, allow: { to: { type: ['clawsupport'] } } },
          { from: { type: 'services' }, allow: { to: { type: ['services', 'shared'] } } },
          { from: { type: 'shared' },   allow: { to: { type: ['shared'] } } },
        ],
      }],
    },
  },
]
