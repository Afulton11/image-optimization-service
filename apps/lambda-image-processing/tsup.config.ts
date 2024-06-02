import { defineConfig } from 'tsup'

// custom tsup config to bundle all minify & bundle all dependencies into the dist folder.
// and we can point our CDK package to dist.
export default defineConfig((options) => {
  const nodeEnv = options.env?.['NODE_ENV']
  const isProduction = nodeEnv === 'production'

  return {
    platform: 'node',

    entry: ['src/index.ts'],
    minify: isProduction,
    minifyIdentifiers: isProduction,
    minifySyntax: isProduction,
    minifyWhitespace: isProduction,
    skipNodeModulesBundle: false,
    // https://sharp.pixelplumbing.com/install#aws-lambda
    external: ['sharp'],
    noExternal: [
      '@aws-sdk/client-s3',
      '@aws-sdk/lib-storage',
      '@aws-sdk/xhr-http-handler',
      '@my/shared-image-optimization',
      'http-status-codes',
    ],
    format: 'cjs',
    dts: true,
    sourcemap: true,
    clean: true,
  }
})
