#!/usr/bin/env node

// From sharp/layer github https://github.com/pH200/sharp-layer/blob/master/.github/workflows/build.yml
// Builds a lambda layer for sharp.

const { exec } = require('child_process')
const { stderr } = require('process')

// expects `prebuild` to have been run

console.log('⏳ Preparing sharp/layer...')
const output = exec(
  `
  mkdir -p layer/nodejs/node_modules/sharp/lib && \\
  (mv dist/index.js layer/nodejs/node_modules/sharp/lib/ & \\
  mv node_modules/sharp/package.json layer/nodejs/node_modules/sharp/ & \\
  mv node_modules/sharp/LICENSE layer/nodejs/node_modules/sharp/ & \\
  mv node_modules/sharp/lib/index.d.ts layer/nodejs/node_modules/sharp/lib/ & \\
  mv node_modules/@img layer/nodejs/node_modules/)
`,
  (error, stdout, stderr) => {
    console.log(stdout)
    console.error(stderr)
    if (error) {
      console.error(error)
      return
    }

    console.log(`✅ Prepared sharp/layer. Available at ${__dirname + '/dist'}`)
  }
)
