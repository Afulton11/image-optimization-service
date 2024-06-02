type QueryKeyHandlerArgs = {
  request: AWSCloudFrontFunction.Request
  queryKeyValue?: string
}

export type QueryKeyHandler = {
  key: string
  handle: (args: QueryKeyHandlerArgs) => any
}
