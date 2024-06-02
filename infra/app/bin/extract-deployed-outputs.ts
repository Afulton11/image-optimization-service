import * as os from 'os'
import * as fs from 'fs'

/**
 * Extracts outputs from the AWS stack after performing a deployment with `yarn deploy`.
 * See https://github.com/jgoux/preview-environments-per-pull-request-using-aws-cdk-and-github-actions/blob/main/README.md
 */
const cdkOutput = require('../cdk.out.json') as Record<string, any>

console.log('🏗 Extracting Deployed Outputs from cdk.out.json...')
if (!cdkOutput) {
  console.warn('⚠️ No cdk.out.json file found. Skipping outputs.')
}

const stage = process.env.STAGE || 'Devo'
const stackKey = Object.keys(cdkOutput).find((key) => key.startsWith(stage))

if (!stackKey) {
  console.warn(`⚠️ No key for the ${stage} stack was found in cdk.out.json file. Skipping outputs.`)
}

const stackOutputs = Object.keys(cdkOutput[stackKey!])

if (!stackOutputs) {
  console.warn(`⚠️ No outputs found for the stack ${stackKey} were found. Skipping outputs.`)
}

const githubOutputFile = process.env['GITHUB_OUTPUT']
console.log(`Using output file: ${githubOutputFile}`)

const setGithubOutput = (key: string, value: string) => {
  if (githubOutputFile) {
    const outputData = `${key}=${value}`
    console.log(`Applying output: ${outputData}`)
    fs.appendFileSync(githubOutputFile, `${outputData}${os.EOL}`)
  }
  // else, not running in github workflow.
}

stackOutputs.forEach((outputKey) => {
  const value = cdkOutput[stackKey!][outputKey]

  console.log(`Found key: ${outputKey}`)
  if (outputKey.includes('ImageDeliveryDomain')) {
    setGithubOutput('ImageDeliveryDomain', value)
  } else if (outputKey.includes('AppUserSecretKey')) {
    setGithubOutput('AppUserSecretKey', value)
  } else if (outputKey.includes('AppUserAccessKeyId')) {
    setGithubOutput('AppUserAccessKeyId', value)
  }
})
