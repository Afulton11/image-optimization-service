import { widthKeyHandler } from '../../src/query-keys/width'
import { getFakeRequest } from '../testUtils'

describe('Test width operation', () => {
  const MIN_WIDTH = 16,
    MAX_WIDTH = 1024
  test.each([
    ['16', MIN_WIDTH],
    ['-1', MIN_WIDTH],
    ['', MIN_WIDTH],
    [NaN.toString(), MIN_WIDTH],
    [Number.MIN_SAFE_INTEGER.toString(), MIN_WIDTH],
    ['1025', MAX_WIDTH],
    [
      '89162458762378945698723645609762345678567898264757623457826345972634576827364587269457897824569872634501',
      MAX_WIDTH,
    ],
    [Infinity.toString(), MIN_WIDTH],
    ['198a123', 198], // parseInt parses up until the first non-numeric character.
    ['512', 512],
    ['256', 256],
  ])('When given %s in query, width should become %d', async (inputWidth, expectedWidth) => {
    const actualWidth = await widthKeyHandler.handle({
      request: getFakeRequest({
        querystring: {
          width: {
            value: inputWidth,
          },
        },
      }),
      queryKeyValue: inputWidth,
    })

    expect(actualWidth).toEqual(expectedWidth)
  })
})
