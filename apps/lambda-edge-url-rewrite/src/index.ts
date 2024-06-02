/// <reference types="@types/aws-cloudfront-function" />
import { QUERY_KEY_HANDLER_MAP } from './query-keys'
import { IMAGE_OPERATIONS } from './query-keys/format'

// For event structure from CloudFront, see:
// https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/functions-event-structure.html
// We also shouldn't export the handler. See: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/example-function-add-cache-control-header.html
export function handler({ request }: AWSCloudFrontFunction.Event): AWSCloudFrontFunction.Request {
  try {
    // NOTE: operation is the same as a query key in this context.
    const normalizedOperations = {} as Record<
      (typeof IMAGE_OPERATIONS)[keyof typeof IMAGE_OPERATIONS],
      string
    >
    const originalImagePath = request.uri

    // normalize each query key / operation.
    if (request.querystring) {
      Object.keys(request.querystring).forEach((queryKey) => {
        const value = request.querystring[queryKey]?.value ?? ''
        // normalize query key by forcing lowercase. Normalizing helps ensure cache hits for same requests.
        const lowercaseQueryKey = queryKey?.toLowerCase() // don't use a locale.
        const handler = QUERY_KEY_HANDLER_MAP[lowercaseQueryKey]

        if (handler) {
          normalizedOperations[lowercaseQueryKey] = handler({
            request,
            queryKeyValue: value,
          })
          // remove query strings used for formatting. We don't need these anymore as these were added to the uri.
          delete request.querystring[queryKey]
        }
      })
    }

    if (Object.keys(normalizedOperations).length > 0) {
      const operationsUriSuffix = Object.entries(normalizedOperations)
        .reduce((operations, [operation, value]) => {
          if (operation) {
            operations.push(`${operation}=${value}`)
          }
          return operations
        }, [] as string[])
        .sort((a, b) => (a[0]! > b[0]! ? 1 : -1))
        .join(',')
      request.uri = originalImagePath + '/' + operationsUriSuffix
    } else {
      // If something happens e.g. bad code change...
      // Last resort, revert to using the original image.
      request.uri = originalImagePath
    }
  } catch (error) {
    console.log('Failed to perform url-rewrite: ' + error)
  }

  return request
}
