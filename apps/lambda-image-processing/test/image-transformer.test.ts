import { mockClient } from 'aws-sdk-client-mock'
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'

jest.mock('stream', () => ({
  ...jest.requireActual('stream'),
  PassThrough: jest.fn(),
}))
jest.mock('@aws-sdk/lib-storage', () => {
  return {
    Upload: jest.fn().mockReturnValue({
      done: jest.fn().mockReturnValue(Promise.resolve()),
      on: jest.fn(),
      once: jest.fn(),
    }),
  }
})
jest.mock('../src/env', () => ({
  __esModule: true,
  env: {
    originalImageBucket: 'test-original-images',
    imageVariantBucket: 'test-image-variants',
  },
}))

jest.mock('sharp')

const s3MockClient = mockClient(S3Client)

import {
  downloadOriginalImage,
  getContentTypeFromOperations,
  getTransformedImageStream,
  getUploadTransformedImageStream,
} from '../src/image-transformer'
import { Upload } from '@aws-sdk/lib-storage'
import { sdkStreamMixin } from '@aws-sdk/util-stream-node'
import { IMAGE_OPERATIONS } from '@my/shared-image-optimization'
import sharp from 'sharp'
import { PassThrough, Readable } from 'stream'

describe('image transformer tets', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    s3MockClient.reset()
  })

  describe('Test downloadOriginalImage', () => {
    it.each([['image'], ['image/jpg.jpeg'], ['image/household/123.webp']])(
      'Should send get object for %s',
      async (imagePath) => {
        const objectStream = new Readable()
        objectStream.push('SomeObject123')
        objectStream.push(null) // end of stream
        const sdkObjectStream = sdkStreamMixin(objectStream)

        s3MockClient
          .on(GetObjectCommand)
          .resolves({ Body: sdkObjectStream, ContentType: 'image/jpg' })

        const result = await downloadOriginalImage(imagePath)

        const actualInputToS3Send = s3MockClient.commandCalls(GetObjectCommand)[0]
          ?.firstArg as GetObjectCommand
        expect(actualInputToS3Send?.input).toMatchObject({
          Bucket: 'test-original-images',
          Key: imagePath,
        })
        expect(result.didError).toBeFalsy()
        if (result.didError === false) {
          expect(result.result?.ContentType).toBe('image/jpg')
          expect(await result.result?.Body?.transformToString()).toBe('SomeObject123')
        }
      }
    )
  })

  describe('Test getUploadTransformedImageStream', () => {
    it('should create write stream for upload to S3 Object', () => {
      const mockedPassThrough = jest.mocked(PassThrough)

      const result = getUploadTransformedImageStream({
        originalImagePath: 'images/household/avatar/123.webp',
        allOperationsString: 'format=jpg,width=20',
        contentType: 'images/jpeg',
      })

      expect(Upload).toHaveBeenCalledTimes(1)
      expect(Upload).toHaveBeenCalledWith({
        client: expect.any(S3Client),
        params: {
          Body: mockedPassThrough.mock.instances[0],
          Bucket: 'test-image-variants',
          Key: 'images/household/avatar/123.webp/format=jpg,width=20',
          ContentType: 'images/jpeg',
        },
      })

      const argumentsToConstructUpload = jest.mocked(Upload).mock.calls[0]![0]
      expect(result).toBe(argumentsToConstructUpload.params.Body)
    })
  })

  describe('Test getTransformedImageStream', () => {
    const createSharpMock = jest.mocked(sharp)
    const sharpMock = {
      toFormat: jest.fn(),
      resize: jest.fn(),
    } as unknown as sharp.Sharp

    beforeEach(() => {
      createSharpMock.mockReset()
      jest.mocked(sharpMock.toFormat).mockReset()
      jest.mocked(sharpMock.resize).mockReset()

      createSharpMock.mockReturnValue(sharpMock)
    })

    it('should initialize sharp image stream with expected config', async () => {
      const result = await getTransformedImageStream({
        operations: {
          [IMAGE_OPERATIONS.HEIGHT]: '',
          [IMAGE_OPERATIONS.WIDTH]: '',
          [IMAGE_OPERATIONS.QUALITY]: '',
          [IMAGE_OPERATIONS.FORMAT]: '',
        },
        isNewContentTypeLossy: false,
      })

      expect(createSharpMock).toHaveBeenCalledTimes(1)

      const sharpConfig = createSharpMock.mock.calls[0]![0]
      expect(sharpConfig).toEqual(
        expect.objectContaining({
          failOn: 'none',
          animated: true,
        })
      )
    })

    it('should create the transformed image stream with no operations', async () => {
      const result = await getTransformedImageStream({
        operations: {
          [IMAGE_OPERATIONS.HEIGHT]: '',
          [IMAGE_OPERATIONS.WIDTH]: '',
          [IMAGE_OPERATIONS.QUALITY]: '',
          [IMAGE_OPERATIONS.FORMAT]: '',
        },
        isNewContentTypeLossy: false,
      })

      // no operations should be performed on the pipeline.
      expect(sharpMock.toFormat).not.toHaveBeenCalled()
      expect(sharpMock.resize).not.toHaveBeenCalled()

      expect(result).toEqual({
        result: sharpMock,
      })
    })

    it.each([
      ['12', '12', 12, 12],
      ['50', '', 50, undefined],
      ['', '12', undefined, 12],
    ])(
      'should perform resize operation (w=%s,h=%)',
      async (height, width, expectedHeight, expectedWidth) => {
        const result = await getTransformedImageStream({
          operations: {
            [IMAGE_OPERATIONS.HEIGHT]: height!,
            [IMAGE_OPERATIONS.WIDTH]: width!,
            [IMAGE_OPERATIONS.QUALITY]: '',
            [IMAGE_OPERATIONS.FORMAT]: '',
          },
          isNewContentTypeLossy: false,
        })

        // no operations should be performed on the pipeline.
        expect(sharpMock.toFormat).not.toHaveBeenCalled()
        expect(sharpMock.resize).toHaveBeenCalledTimes(1)
        expect(sharpMock.resize).toHaveBeenCalledWith({
          ...(expectedWidth && { width: expectedWidth }),
          ...(expectedHeight && { height: expectedHeight }),
        })

        expect(result).toEqual({
          result: sharpMock,
        })
      }
    )

    it.each([
      ['jpeg', '1', 1],
      ['webp', '', undefined],
      ['png', '99', 99],
    ])('should perform format operation (f=%s,q=%s)', async (format, quality, expectedQuality) => {
      const result = await getTransformedImageStream({
        operations: {
          [IMAGE_OPERATIONS.HEIGHT]: '',
          [IMAGE_OPERATIONS.WIDTH]: '',
          [IMAGE_OPERATIONS.QUALITY]: quality!,
          [IMAGE_OPERATIONS.FORMAT]: format!,
        },
        isNewContentTypeLossy: !!quality,
      })

      expect(sharpMock.resize).not.toHaveBeenCalled()
      expect(sharpMock.toFormat).toHaveBeenCalledTimes(1)

      if (expectedQuality) {
        expect(sharpMock.toFormat).toHaveBeenCalledWith(format, {
          quality: expectedQuality,
        })
      } else {
        expect(sharpMock.toFormat).toHaveBeenCalledWith(format)
      }

      expect(result).toEqual({
        result: sharpMock,
      })
    })
  })

  describe('Test getContentTypeFromOperations', () => {
    it.each([
      ['jpeg', 'image/jpeg', true],
      ['webp', 'image/webp', true],
      ['png', 'image/png', false],
    ])(
      'format=%s, should return contentType=%s with isLossy=%s',
      (format, expectedContentType, expectedIsLossy) => {
        const { contentType, isContentTypeLossy } = getContentTypeFromOperations({
          format,
        } as Record<IMAGE_OPERATIONS, string>)

        expect(contentType).toEqual(expectedContentType)
        expect(isContentTypeLossy).toEqual(expectedIsLossy)
      }
    )
  })
})
