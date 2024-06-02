import { formatKeyHandler } from '../../src/query-keys/format'
import { getFakeRequest } from '../testUtils'

test('Should set format to default value of "webp"', async () => {
  const actualFormatValue = await formatKeyHandler.handle({
    request: getFakeRequest(),
  })

  expect(actualFormatValue).toEqual('webp')
})

describe('Test Query Key Value', () => {
  test.each([['jpeg'], ['webp'], ['png'], ['PnG'], ['JPEG'], ['WeBP']])(
    'Should set format to equal query key value "%s"',
    async (formatType) => {
      const actualFormatValue = await formatKeyHandler.handle({
        request: {
          method: 'GET',
          cookies: {},
          headers: {},
          querystring: {
            format: {
              value: formatType,
            },
          },
          uri: '',
        },
        queryKeyValue: formatType,
      })

      expect(actualFormatValue).toEqual(formatType.toLowerCase())
    }
  )

  test('Should set format to equal long-form "jpeg"', async () => {
    const actualFormatValue = await formatKeyHandler.handle({
      request: {
        method: 'GET',
        cookies: {},
        headers: {},
        querystring: {},
        uri: '',
      },
      queryKeyValue: 'jPg',
    })

    expect(actualFormatValue).toEqual('jpeg')
  })

  test.each([['auto'], ['WebPs'], ['pds'], ['+!@#']])(
    'Should NOT set format to equal accept header "%s"',
    async (formatType) => {
      const actualFormatValue = await formatKeyHandler.handle({
        request: {
          method: 'GET',
          cookies: {},
          headers: {},
          querystring: {
            format: {
              value: formatType,
            },
          },
          uri: '',
        },
        queryKeyValue: formatType,
      })

      // expect to be equal to default value as if no format was specified.
      expect(actualFormatValue).toEqual('webp')
    }
  )
})

describe('Test Accept Header', () => {
  test.each([['jpeg'], ['webp'], ['png'], ['PnG'], ['JPEG'], ['WeBP']])(
    'Should set format to equal accept header "%s" of supported value',
    async (formatType) => {
      const actualFormatValue = await formatKeyHandler.handle({
        request: {
          method: 'GET',
          cookies: {},
          headers: {
            accept: {
              value: formatType,
            },
          },
          querystring: {},
          uri: '',
        },
        queryKeyValue: 'auto',
      })

      expect(actualFormatValue).toEqual(formatType.toLowerCase())
    }
  )

  test('Should set format to equal long-form "jpeg" from header', async () => {
    const actualFormatValue = await formatKeyHandler.handle({
      request: {
        method: 'GET',
        cookies: {},
        headers: {
          accept: {
            value: 'jpg',
          },
        },
        querystring: {},
        uri: '',
      },
      queryKeyValue: 'auto',
    })

    expect(actualFormatValue).toEqual('jpeg')
  })

  test.each([['auto'], ['WebPs'], ['pds'], ['+!@#']])(
    'Should NOT set format to equal accept header "%s"',
    async (formatType) => {
      const actualFormatValue = await formatKeyHandler.handle({
        request: {
          method: 'GET',
          cookies: {},
          headers: {
            accept: {
              value: formatType,
            },
          },
          querystring: {},
          uri: '',
        },
        queryKeyValue: 'auto',
      })

      // expect to be equal to default value as if no format was specified.
      expect(actualFormatValue).toEqual('webp')
    }
  )
})
