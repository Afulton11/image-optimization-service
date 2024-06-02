import { handler } from '../src'

const realEvent = {
  version: '1.0',
  context: {
    distributionDomainName: 'd123.cloudfront.net',
    distributionId: 'E123',
    eventType: 'viewer-request',
    requestId: '4TyzHTaYWb1GX1qTfsHhEqV6HUDd_BzoBZnwfnvQc_1oF26ClkoUSEQ==',
  },
  viewer: { ip: '1.2.3.4' },
  request: { method: 'GET', uri: '/Bernie.png', querystring: {}, headers: {}, cookies: {} },
} as AWSCloudFrontFunction.Event

describe('Test handler', () => {
  it('should return the same request', async () => {
    const actualResult = await handler(realEvent)

    expect(actualResult).toBe(realEvent.request)
  })

  it('should return the same request, with querystring applied to uri.', async () => {
    const actualResult = await handler({
      ...realEvent,
      request: {
        ...realEvent.request,
        querystring: {
          format: {
            value: 'jpg',
          },
        },
      },
    })

    expect(actualResult).not.toBeNull()
    expect(actualResult).toEqual(
      expect.objectContaining({
        querystring: {},
        uri: '/Bernie.png/format=jpeg',
      } as Partial<AWSCloudFrontFunction.Request>)
    )
  })
})
