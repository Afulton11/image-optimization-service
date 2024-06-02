#!/usr/bin/env node
import { RSAKeyPairOptions, generateKeyPairSync } from 'crypto'

export const generateKeyPair = () =>
  generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  } as RSAKeyPairOptions<'pem', 'pem'>)

const { privateKey, publicKey } = generateKeyPair()
console.log('publicKey: ', publicKey)
console.log('privateKey: ', privateKey)
