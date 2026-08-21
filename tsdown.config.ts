import type { UserConfig } from 'tsdown'

const packageId = 'dsh-photowall-skin'
const clientExternals = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-runtime/client',
  '@deepseek-ai/dsh-client-ui-slots',
] as const

const nodeConfig: UserConfig = {
  name: packageId,
  entry: {
    index: 'src/index.ts',
    assets: 'src/assets.ts',
    settings: 'src/settings.ts',
    styles: 'src/client/styles.ts',
  },
  outDir: 'lib',
  format: 'esm',
  platform: 'node',
  target: 'node22',
  fixedExtension: false,
  clean: false,
  dts: false,
  deps: {
    neverBundle: [/^@deepseek-ai\//],
  },
}

const clientConfig: UserConfig = {
  name: `${packageId}/client`,
  entry: { client: 'src/client/index.tsx' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  clean: false,
  dts: false,
  sourcemap: true,
  deps: {
    neverBundle: [...clientExternals],
    alwaysBundle: (id: string) => clientExternals.includes(id as typeof clientExternals[number]) ? undefined : true,
  },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(packageId)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default [nodeConfig, clientConfig]
