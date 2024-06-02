import type { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { StatusCodes, getReasonPhrase } from 'http-status-codes'
import { isGetRequest, isRequestFromCloudFront } from './validation'
import {
  downloadOriginalImage,
  getContentTypeFromOperations,
  getTransformedImageStream as getTransformImagePipeline,
  getUploadTransformedImageStream,
} from './image-transformer'
import { Readable } from 'stream'
import { finished } from 'stream/promises'

// For event structure from CloudFront, see:
// https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/functions-event-structure.html
export const handler: APIGatewayProxyHandlerV2 = async (
  event,
  context
): Promise<APIGatewayProxyResultV2> => {
  const { headers, requestContext } = event
  // First validate if the request is coming from CloudFront
  if (!isRequestFromCloudFront(headers)) {
    return sendClientError({
      statusCode: StatusCodes.UNAUTHORIZED,
      error: event,
    })
  }

  // Validate the request is a GET request
  if (!isGetRequest(requestContext)) {
    return sendClientError({
      statusCode: StatusCodes.METHOD_NOT_ALLOWED,
      error: event,
    })
  }

  /**
   * An example of expected path is:
   *   * /images/rio/1.jpeg/format=auto,width=100
   *   * /images/rio/1.jpeg/original
   * where /images/rio/1.jpeg is the path of the original image
   */
  const pathParts = requestContext.http.path.split('/')
  const allOperations = pathParts.pop()! // operations are always @ end of pathParts.

  // Now, get the path without the first slash; images/riot/1.jpeg
  pathParts.shift()
  const originalImagePath = pathParts.join('/')

  console.log('downloading image: ', {
    requestPath: requestContext.http.path,
    originalImagePath,
    allOperations,
  })

  // Download the original image from the S3 bucket.
  const downloadOriginalImageResult = await downloadOriginalImage(originalImagePath)
  if (downloadOriginalImageResult.didError) {
    return sendClientError({
      statusCode: StatusCodes.NOT_FOUND,
      body: 'The requested image was not found.',
      error: downloadOriginalImageResult.error,
    })
  }

  // Setup transformation of the image & pipe the transformed image to S3.
  const originalImage = downloadOriginalImageResult.result
  const operations = Object.fromEntries(
    allOperations?.split(',').map((operation) => operation.split('='))
  )
  const { contentType, isContentTypeLossy } = getContentTypeFromOperations(operations)

  console.log('transforming image: ', {
    operations,
    contentType,
    isContentTypeLossy,
  })
  const getTransformedPipelineResult = await getTransformImagePipeline({
    operations,
    isNewContentTypeLossy: isContentTypeLossy,
  })
  if (getTransformedPipelineResult.didError) {
    return sendClientError({
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
      body: 'We failed to transform the image.',
      error: getTransformedPipelineResult.error,
    })
  }
  const transformImagePipeline = getTransformedPipelineResult.result
  const readOriginalImageStream = originalImage.Body as Readable
  const uploadTransformedImageStream = getUploadTransformedImageStream({
    originalImagePath,
    allOperationsString: allOperations,
    contentType,
  })

  // Pipe the original image through the transformation and to the S3 upload stream.
  console.time('Pipeline')

  // Read the original image into the sharp pipeline
  readOriginalImageStream.pipe(transformImagePipeline)
  // upload transformed image to S3
  transformImagePipeline.pipe(uploadTransformedImageStream)
  // in parallel, convert the transformed image to a buffer.
  const transformedImageBufferQuery = transformImagePipeline.toBuffer()

  // wait for the image to finish uploading
  await finished(uploadTransformedImageStream)
  // wait for the image to be transformed to a buffer
  const transformedImageBuffer = await transformedImageBufferQuery

  console.timeEnd('Pipeline')

  // TODO: Use a StatusCodes.MOVED_TEMPORARILY to redirect to the new image location once react images support redirects.
  return {
    statusCode: StatusCodes.OK,
    body: transformedImageBuffer.toString('base64'),
    isBase64Encoded: true,
    headers: {
      'Content-Type': contentType,
    },
  }
}

type SendErrorArgs = {
  statusCode: StatusCodes
  body?: string
  error: any
}
const sendClientError = ({ statusCode, body, error }: SendErrorArgs): APIGatewayProxyResultV2 => {
  const actualBody = body ?? getReasonPhrase(statusCode)
  console.log('APPLICATION ERROR', actualBody, error)
  return {
    statusCode,
    body: actualBody,
  }
}
