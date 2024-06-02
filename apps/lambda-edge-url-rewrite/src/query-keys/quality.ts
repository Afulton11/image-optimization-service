import type { QueryKeyHandler } from './_types'
import { IMAGE_OPERATIONS } from './format'

const MAX_QUALITY = 100
const END_CHAR_INDEX_FOR_WIDTH = `${MAX_QUALITY}`.length + 1
const MIN_QUALITY = 1

/**
 * Normalizes the value for the 'quality' query key. The 'quality' operation should be
 * a number. It's automatically limited to a maximum of 100 and minimum of 0 as it represents
 * a percentage.
 */
export const qualityKeyHandler: QueryKeyHandler = {
  key: IMAGE_OPERATIONS.QUALITY,
  handle: ({ queryKeyValue }) => {
    // limit the length so that we don't attempt to parse extremely large numbers.
    const lengthLimitedKeyValue = queryKeyValue?.substring?.(0, END_CHAR_INDEX_FOR_WIDTH) ?? ''
    let quality = parseInt(lengthLimitedKeyValue)

    if (isNaN(quality)) {
      return MIN_QUALITY
    }

    // Limit quality to be within MIN_QUALITY and MAX_QUALITY
    return Math.max(MIN_QUALITY, Math.min(quality, MAX_QUALITY))
  },
}
