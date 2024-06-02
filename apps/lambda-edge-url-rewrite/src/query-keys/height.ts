import type { QueryKeyHandler } from './_types'
import { IMAGE_OPERATIONS } from './format'

const MAX_HEIGHT = 1024
const END_CHAR_INDEX_FOR_HEIGHT = `${MAX_HEIGHT}`.length + 1
const MIN_HEIGHT = 16

/**
 * Normalizes the value for the 'height' query key. The 'height' operation should be
 * a number less. It's automatically limited to a maximum of {@link MAX_HEIGHT} and
 * a minimum of {@link MIN_HEIGHT}.
 */
export const heightKeyHandler: QueryKeyHandler = {
  key: IMAGE_OPERATIONS.HEIGHT,
  handle: ({ queryKeyValue }) => {
    // limit the length so that we don't attempt to parse extremely large numbers.
    const lengthLimitedKeyValue = queryKeyValue?.substring?.(0, END_CHAR_INDEX_FOR_HEIGHT) ?? ''
    let height = parseInt(lengthLimitedKeyValue)

    if (isNaN(height)) {
      return MIN_HEIGHT
    }

    // Limit width to be within MIN_HEIGHT and MAX_HEIGHT
    return Math.max(MIN_HEIGHT, Math.min(height, MAX_HEIGHT))
  },
}
