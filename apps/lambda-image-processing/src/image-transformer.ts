import { S3Client, GetObjectCommand, GetObjectCommandOutput } from '@aws-sdk/client-s3'
import { env } from './env'
// @ts-ignore Unable to find sharp. Sharp is installed on lambda.
import sharp, { FormatEnum } from 'sharp'
import { IMAGE_OPERATIONS, STRICTLY_SUPPORTED_IMAGE_FORMATS } from '@my/shared-image-optimization'
import { PassThrough, Writable } from 'stream'
import { Upload } from '@aws-sdk/lib-storage'

const s3Client = new S3Client({
  // Use Xhr implementation to enable upload progress.
  // See https://github.com/aws/aws-sdk-js-v3/issues/3101
  // requestHandler: new XhrHttpHandler(),
})

type TaskResult<R = any> = SuccessfulTaskResult<R> | FailedTaskResult

export type SuccessfulTaskResult<R = any> = {
  didError?: false
  result: R
}

type FailedTaskResult = {
  didError: true
  error: any
}

export const downloadOriginalImage = async (
  orginalImagePath: string
): Promise<TaskResult<GetObjectCommandOutput>> => {
  console.time('downloadOriginal')
  try {
    const originalImage = await s3Client.send(
      new GetObjectCommand({
        Bucket: env.originalImageBucket,
        Key: orginalImagePath,
      })
    )

    return { result: originalImage }
  } catch (error) {
    return { didError: true, error }
  } finally {
    console.timeEnd('downloadOriginal')
  }
}

type UploadTransformedImageArgs = {
  /**
   * The path of the original image
   * @example "images/riot/1.jpeg"
   */
  originalImagePath: string
  /**
   * The string formatted in the url of all the operations performed on the image.
   * @example "format=auto,width=100,height=50"
   */
  allOperationsString: string
  /**
   * The type of content for the uploaded image.
   * @example "image/jpeg" | "image/png" | "image/webp"
   */
  contentType: string
}

export const getUploadTransformedImageStream = ({
  originalImagePath,
  allOperationsString,
  contentType,
}: UploadTransformedImageArgs): Writable => {
  const uploadImageStream = new PassThrough()
  // We must use Upload to upload a stream, unless it's from the local file system.
  // see https://stackoverflow.com/a/69842966
  const uploadImage = new Upload({
    client: s3Client,
    params: {
      Body: uploadImageStream,
      Bucket: env.imageVariantBucket,
      Key: originalImagePath + '/' + allOperationsString,
      ContentType: contentType,
    },
  })

  uploadImage.once('httpUploadProgress', (progress) => {
    console.time('uploadTransformed')
  })
  uploadImage.on('httpUploadProgress', (progress) => {
    console.log('Progress %i, part %i', progress.loaded, progress.part)
  })

  uploadImage
    .done()
    .catch((error) => {
      console.error('Failed to upload transformed image', {
        originalImagePath,
        allOperationsString,
        contentType,
      })
    })
    .finally(() => console.timeEnd('uploadTransformed'))

  return uploadImageStream
}

type GetTransformationPipelineArgs = {
  operations: Record<IMAGE_OPERATIONS, string>
  isNewContentTypeLossy?: boolean
}

export const getTransformedImageStream = async ({
  operations,
  isNewContentTypeLossy,
}: GetTransformationPipelineArgs): Promise<TaskResult<sharp.Sharp>> => {
  console.time('buildPipeline')
  try {
    const transformationPipeline = sharp({ failOn: 'none', animated: true })

    // Apply resize options to the image transformation pipeline
    const resizeOptions: { width?: number; height?: number } = {}
    if (operations[IMAGE_OPERATIONS.WIDTH])
      resizeOptions.width = parseInt(operations[IMAGE_OPERATIONS.WIDTH])
    if (operations[IMAGE_OPERATIONS.HEIGHT])
      resizeOptions.height = parseInt(operations[IMAGE_OPERATIONS.HEIGHT])
    if (resizeOptions.width || resizeOptions.height) transformationPipeline.resize(resizeOptions)

    // Apply format, with optional quality to image transformation pipeline
    if (operations[IMAGE_OPERATIONS.FORMAT]) {
      if (isNewContentTypeLossy && operations[IMAGE_OPERATIONS.QUALITY]) {
        transformationPipeline.toFormat(operations[IMAGE_OPERATIONS.FORMAT] as keyof FormatEnum, {
          quality: parseInt(operations[IMAGE_OPERATIONS.QUALITY]),
        })
      } else {
        transformationPipeline.toFormat(operations[IMAGE_OPERATIONS.FORMAT] as keyof FormatEnum)
      }
    }

    return {
      result: transformationPipeline,
    }
  } catch (error) {
    return {
      didError: true,
      error,
    }
  } finally {
    console.timeEnd('buildPipeline')
  }
}

export const getContentTypeFromOperations = (operations: Record<IMAGE_OPERATIONS, string>) => {
  if (!operations[IMAGE_OPERATIONS.FORMAT]) {
    operations[IMAGE_OPERATIONS.FORMAT] = STRICTLY_SUPPORTED_IMAGE_FORMATS.JPEG
  }

  let isLossy = false,
    contentType
  switch (operations[IMAGE_OPERATIONS.FORMAT]) {
    case STRICTLY_SUPPORTED_IMAGE_FORMATS.JPEG:
      contentType = `image/${STRICTLY_SUPPORTED_IMAGE_FORMATS.JPEG}`
      isLossy = true
      break
    case STRICTLY_SUPPORTED_IMAGE_FORMATS.WEBP:
      contentType = `image/${STRICTLY_SUPPORTED_IMAGE_FORMATS.WEBP}`
      isLossy = true
      break
    case STRICTLY_SUPPORTED_IMAGE_FORMATS.PNG:
      contentType = `image/${STRICTLY_SUPPORTED_IMAGE_FORMATS.PNG}`
      break
  }

  return {
    contentType: contentType!,
    isContentTypeLossy: isLossy,
  }
}
