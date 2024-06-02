import { defineConfig } from 'tsup'

export default defineConfig((options) => {
  // Cloudfront functions have many limitations on javascript AND on the size. Must be less than 10KB.
  // https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-limits.html
  // Therefore, we need to make sure the code is as small as possible
  // AND is compatible with ES5
  // AND doesn't use const/let/of
  // https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/functions-javascript-runtime-10.html
  return {
    name: 'url-rewrite-tsup',
    entry: ['src/index.ts'],
    minify: true,
    // we need the handler function to be "handler", otherwise cloudfront wont find the function to run
    // We add a footer at the bottom called "handler" which attaches itself to the handler exported from src/index.ts
    minifyIdentifiers: false,
    minifyWhitespace: true,
    minifySyntax: true,
    skipNodeModulesBundle: true,
    format: 'cjs',
    dts: false,
    clean: true,
    treeshake: false,
    cjsInterop: false,
    keepNames: true,
    splitting: false,
  }
})
