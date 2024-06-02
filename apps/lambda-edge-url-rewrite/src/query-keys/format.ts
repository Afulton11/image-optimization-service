import type { QueryKeyHandler } from './_types'

export const STRICTLY_SUPPORTED_IMAGE_FORMATS = {
  WEBP: 'webp',
  JPEG: 'jpeg',
  PNG: 'png',
}

export const IMAGE_OPERATIONS = {
  HEIGHT: 'height',
  WIDTH: 'width',
  QUALITY: 'quality',
  FORMAT: 'format',
}

// auto = default to format defined by 'accept' header or to webp.
const AUTO_FORMAT = 'auto'
const DEFAULT_FORMAT = STRICTLY_SUPPORTED_IMAGE_FORMATS.WEBP
const JPEG_SHORT_FORM = 'jpg'
const JPEG_LONG_FORM = STRICTLY_SUPPORTED_IMAGE_FORMATS.JPEG

const STRICTLY_SUPPORTED_FORMATS = Object.values(STRICTLY_SUPPORTED_IMAGE_FORMATS)
const ALL_SUPPORTED_FORMATS = [...STRICTLY_SUPPORTED_FORMATS, JPEG_SHORT_FORM]

const END_CHAR_INDEX_FOR_FORMAT =
  1 +
  ALL_SUPPORTED_FORMATS.reduce(
    (longestFormatLength, currentFormatType) =>
      currentFormatType.length > longestFormatLength
        ? currentFormatType.length
        : longestFormatLength,
    JPEG_LONG_FORM.length
  )

const ACCEPT_HEADER = 'accept'

/**
 * Normalizes the value for the 'format' query key. The 'format' operation should be
 * a string matching to one of the {@link SUPPORTED_FORMATS}.
 */
export const formatKeyHandler: QueryKeyHandler = {
  key: IMAGE_OPERATIONS.FORMAT,
  handle: ({ request, queryKeyValue }) => {
    // limit the length so that we don't attempt to parse extremely long values.
    const lengthLimitedKeyValue = queryKeyValue?.substring?.(0, END_CHAR_INDEX_FOR_FORMAT) ?? ''
    let format = lengthLimitedKeyValue?.toLowerCase() ?? 'auto'

    if (format === 'auto') {
      format = getFormatFromHeader(request)
    }

    if (format === JPEG_SHORT_FORM) {
      // default to long-form jpeg.
      format = JPEG_LONG_FORM
    }

    // finally, default to the default format if we didn't find a strictly supported one.
    return STRICTLY_SUPPORTED_FORMATS.includes(format) ? format : DEFAULT_FORMAT
  },
}

/**
 * Automatically discover format from header or default to {@link DEFAULT_FORMAT}.
 * @param request the request to the lambda.
 */
export const getFormatFromHeader = (request: AWSCloudFrontFunction.Request) => {
  const normalizedAcceptHeader = request.headers?.[ACCEPT_HEADER]?.value?.toLowerCase() ?? ''
  const foundFormat = ALL_SUPPORTED_FORMATS.find((format) =>
    normalizedAcceptHeader.includes(format)
  )
  return foundFormat || DEFAULT_FORMAT
}
