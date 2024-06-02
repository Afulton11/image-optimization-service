type GetFakeRequestArgs = Partial<AWSCloudFrontFunction.Request>

export const getFakeRequest = (requestOverrides: GetFakeRequestArgs = {}) =>
  ({
    method: 'GET',
    cookies: {},
    headers: {},
    querystring: {},
    uri: '',
    ...requestOverrides,
  } as AWSCloudFrontFunction.Request)
