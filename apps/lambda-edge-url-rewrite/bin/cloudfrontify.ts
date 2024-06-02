#!/usr/bin/env node
import * as fs from 'fs'
import * as path from 'path'

const target = process.argv[2]!
const targetPath = path.resolve(target)

console.log(
  'Adding module var to beginning of file & handler function to end of file. Removing "use strict"; heading.'
)
const fileContents = fs.readFileSync(targetPath, { encoding: 'utf-8' })
fs.writeFileSync(
  targetPath,
  'var module={};' +
    fileContents.replace('"use strict";', '') +
    'function handler(event){return module.exports.handler(event)}'
)
console.log('Cloudfront-ify completed for ', targetPath)
