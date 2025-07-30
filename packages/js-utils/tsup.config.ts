import { pnpPlugin } from '@yarnpkg/esbuild-plugin-pnp'
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['./src/Got/kyWrap/index.ts'],
  format: ['cjs', 'esm'],
  target: 'node16',
  outDir: './src/Got/ky',
  dts: {
    resolve: true,
    entry: './src/Got/kyWrap/index.ts'
  },
  external: [], // Ensure no modules are externalized
  clean: true,
  esbuildPlugins: [nodePlugin(), pnpPlugin()],
  minify: true
})

function nodePlugin() {
  return {
    name: 'resolveNode',
    setup(build) {
      build.onResolve({ filter: /^node:/ }, args => {
        // node: 를 없앤다
        return { external: true, path: args.path.slice('node:'.length) }
      })
    }
  }
}
