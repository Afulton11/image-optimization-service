import { mockClient } from 'aws-sdk-client-mock'
import { GetObjectCommand, GetObjectCommandOutput, S3Client } from '@aws-sdk/client-s3'

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

const s3MockClient = mockClient(S3Client)

jest.mock('../src/env', () => ({
  env: {
    originSecretKey: '123_secret_key',
    originalImageBucket: 'test-original-images',
    imageVariantBucket: 'test-image-variants',
  },
}))

import * as fs from 'fs'
import {
  APIGatewayEventRequestContextV2,
  APIGatewayProxyCallbackV2,
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  Context,
} from 'aws-lambda'
import { StatusCodes } from 'http-status-codes'
import { sdkStreamMixin } from '@aws-sdk/util-stream-node'
import { PassThrough } from 'stream'
import { Upload } from '@aws-sdk/lib-storage'
import { handler } from '../src'

const callHandler = (event: Partial<APIGatewayProxyEventV2>) =>
  handler(
    event as APIGatewayProxyEventV2,
    undefined as unknown as Context,
    undefined as unknown as APIGatewayProxyCallbackV2
  ) as Promise<APIGatewayProxyStructuredResultV2>

describe('Test lambda-image-processor-handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    s3MockClient.reset()
  })

  describe('Test only allow cloudfront requests.', () => {
    it.each([
      [null],
      [undefined],
      [''],
      ['not-a-secret'],
      ['1234'],
      ['123_secret_key_not'],
      ['bad_secreet'],
    ])('Should send UNAUTHORIZED code for requests with wrong secret=%s', async (badSecret) => {
      const result = await callHandler({
        headers: {
          ...(badSecret ? { 'x-origin-secret-header': badSecret } : {}),
        },
      })

      expect(result).toEqual({
        statusCode: StatusCodes.UNAUTHORIZED,
        body: expect.anything(),
      } as APIGatewayProxyStructuredResultV2)
    })

    it('Should not send UNAUTHORIZED code for requests with correct secret', async () => {
      const result = await callHandler({
        headers: {
          'x-origin-secret-header': '123_secret_key',
        },
      })

      expect(result).not.toEqual(
        expect.objectContaining({
          statusCode: StatusCodes.UNAUTHORIZED,
        } as APIGatewayProxyStructuredResultV2)
      )
    })
  })

  it.each([['PUT'], ['POST'], ['HEAD'], ['DELETE'], ['CONNECT'], ['PATCH']])(
    'Should send METHOD_NOT_ALLOWED code for request method=%s',
    async (method) => {
      const result = await callHandler({
        headers: {
          'x-origin-secret-header': '123_secret_key', // correct header to get past cloudfront check
        },
        requestContext: {
          http: {
            method,
          },
        } as unknown as APIGatewayEventRequestContextV2,
      })

      expect(result).toEqual(
        expect.objectContaining({
          statusCode: StatusCodes.METHOD_NOT_ALLOWED,
          body: expect.anything(),
        } as APIGatewayProxyStructuredResultV2)
      )
    }
  )

  // testing the entire lambda together, only mocking dependencies like S3.
  it('Should process image', async () => {
    const actualTestImagePath = __dirname + '/data/image-variants/pets/Bernie-result.jpeg'

    const writeStreamForUpload = fs.createWriteStream(actualTestImagePath)
    const mockedPassThrough = jest.mocked(PassThrough)
    mockedPassThrough.mockImplementationOnce(() => writeStreamForUpload as unknown as PassThrough)

    // stub / mock
    const originalImageReadStream = sdkStreamMixin(
      fs.createReadStream(__dirname + '/data/original-images/pets/Bernie.png')
    )
    s3MockClient.on(GetObjectCommand).resolves({
      ContentType: 'image/png',
      Body: originalImageReadStream,
    } as GetObjectCommandOutput)

    // act
    const result = await callHandler({
      headers: {
        'x-origin-secret-header': '123_secret_key', // correct header to get past cloudfront check
      },
      requestContext: {
        http: {
          path: '/pets/Bernie.png/format=jpeg,width=50,height=50',
          method: 'GET',
        },
      } as unknown as APIGatewayEventRequestContextV2,
    })

    expect(Upload).toHaveBeenCalledWith({
      client: expect.any(S3Client),
      params: {
        Body: writeStreamForUpload,
        Bucket: 'test-image-variants',
        Key: 'pets/Bernie.png/format=jpeg,width=50,height=50',
        ContentType: 'image/jpeg',
      },
    })

    const actualImage = fs.readFileSync(actualTestImagePath)
    expect(result).toEqual({
      statusCode: StatusCodes.OK,
      body: actualImage.toString('base64'),
      isBase64Encoded: true,
      headers: {
        'Content-Type': 'image/jpeg',
      },
    } as APIGatewayProxyStructuredResultV2)

    // ensure the generated image is equal to the expected image.
    const expectedImage = fs.readFileSync(
      __dirname + '/data/image-variants/pets/Bernie-result-(expected).jpeg'
    )
    expect(expectedImage).toEqual(actualImage)
  })
})
