import type { QueryKeyHandler } from './_types'
import { IMAGE_OPERATIONS } from './format'

const MAX_WIDTH = 1024
const END_CHAR_INDEX_FOR_WIDTH = `${MAX_WIDTH}`.length + 1
const MIN_WIDTH = 16

/**
 * Normalizes the value for the 'width' query key. The 'width' operation should be
 * a number less. It's automatically limited to a maximum of {@link MAX_WIDTH} and
 * a minimum of {@link MIN_WIDTH}.
 */
export const widthKeyHandler: QueryKeyHandler = {
  key: IMAGE_OPERATIONS.WIDTH,
  handle: ({ queryKeyValue }) => {
    // limit the length so that we don't attempt to parse extremely large numbers.
    const lengthLimitedKeyValue = queryKeyValue?.substring?.(0, END_CHAR_INDEX_FOR_WIDTH) ?? ''
    let width = parseInt(lengthLimitedKeyValue)

    if (isNaN(width)) {
      return MIN_WIDTH
    }

    // Limit width to be within MIN_WIDTH and MAX_WITH
    return Math.max(MIN_WIDTH, Math.min(width, MAX_WIDTH))
  },
}
