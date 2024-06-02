import { heightKeyHandler } from '../../src/query-keys/height'
import { getFakeRequest } from '../testUtils'

describe('Test height operation', () => {
  const MIN_HEIGHT = 16,
    MAX_HEIGHT = 1024
  test.each([
    ['16', MIN_HEIGHT],
    ['-1', MIN_HEIGHT],
    ['', MIN_HEIGHT],
    [NaN.toString(), MIN_HEIGHT],
    [Number.MIN_SAFE_INTEGER.toString(), MIN_HEIGHT],
    ['1025', MAX_HEIGHT],
    [
      '89162458762378945698723645609762345678567898264757623457826345972634576827364587269457897824569872634501',
      MAX_HEIGHT,
    ],
    [Infinity.toString(), MIN_HEIGHT],
    ['198a123', 198], // parseInt parses up until the first non-numeric character.
    ['512', 512],
    ['256', 256],
  ])('When given %s in query, height should become %d', async (inputHeight, expectedHeight) => {
    const actualHeight = await heightKeyHandler.handle({
      request: getFakeRequest({
        querystring: {
          height: {
            value: inputHeight,
          },
        },
      }),
      queryKeyValue: inputHeight,
    })

    expect(actualHeight).toEqual(expectedHeight)
  })
})
