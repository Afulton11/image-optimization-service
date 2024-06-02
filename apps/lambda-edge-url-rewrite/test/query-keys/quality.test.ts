import { qualityKeyHandler } from '../../src/query-keys/quality'
import { getFakeRequest } from '../testUtils'

describe('Test quality operation', () => {
  const MIN_QUALITY = 1,
    MAX_QUALITY = 100
  test.each([
    ['0', MIN_QUALITY],
    ['-1', MIN_QUALITY],
    ['', MIN_QUALITY],
    [NaN.toString(), MIN_QUALITY],
    [Number.MIN_SAFE_INTEGER.toString(), MIN_QUALITY],
    ['1025', MAX_QUALITY],
    [
      '89162458762378945698723645609762345678567898264757623457826345972634576827364587269457897824569872634501',
      MAX_QUALITY,
    ],
    [Infinity.toString(), MIN_QUALITY],
    ['75ab123', 75], // parseInt parses up until the first non-numeric character.
    ['25', 25],
    ['99', 99],
    ['100', 100],
    ['1', 1],
  ])('When given %s in query, quality should become %d', async (inputQuality, expectedQuality) => {
    const actualQuality = await qualityKeyHandler.handle({
      request: getFakeRequest({
        querystring: {
          quality: {
            value: inputQuality,
          },
        },
      }),
      queryKeyValue: inputQuality,
    })

    expect(actualQuality).toEqual(expectedQuality)
  })
})
