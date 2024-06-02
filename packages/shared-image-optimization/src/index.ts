export enum STRICTLY_SUPPORTED_IMAGE_FORMATS {
  WEBP = 'webp',
  JPEG = 'jpeg',
  PNG = 'png',
}

export enum IMAGE_OPERATIONS {
  HEIGHT = 'height',
  WIDTH = 'width',
  QUALITY = 'quality',
  FORMAT = 'format',
}

/**
 * Signing Query params are copied to the normalized request.
 */
export const SIGNING_QUERY_PARAMS = ['Expires', 'Signature', 'Key-Pair-Id']
