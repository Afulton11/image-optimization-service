import { QueryKeyHandler } from './_types'
import { formatKeyHandler } from './format'
import { heightKeyHandler } from './height'
import { qualityKeyHandler } from './quality'
import { widthKeyHandler } from './width'

type Handle = QueryKeyHandler['handle']
export const QUERY_KEY_HANDLER_MAP: Record<string, Handle> = {
  [formatKeyHandler.key]: formatKeyHandler.handle,
  [widthKeyHandler.key]: widthKeyHandler.handle,
  [heightKeyHandler.key]: heightKeyHandler.handle,
  [qualityKeyHandler.key]: qualityKeyHandler.handle,
}
