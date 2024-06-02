const getRequired = (key: string) => {
  const value = process.env[key]
  if (!value) {
    console.error(`Failed to find environment variable ${key}.`)
  }
  return value!!
}

export const env = {
  originalImageBucket: getRequired('originalImageBucketName'),
  imageVariantBucket: getRequired('imageVariantBucketName'),
  originSecretKey: getRequired('originSecretKey'),
} as const
