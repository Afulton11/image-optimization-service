import { APIGatewayEventRequestContextV2, APIGatewayProxyEventHeaders } from 'aws-lambda'
import { env } from './env'

const HEADER_ORIGIN_SECRET_KEY = 'x-origin-secret-header'

export const isRequestFromCloudFront = (headers: APIGatewayProxyEventHeaders) => {
  const originSecret = headers[HEADER_ORIGIN_SECRET_KEY]
  return originSecret && originSecret === env.originSecretKey
}

export const isGetRequest = (context?: APIGatewayEventRequestContextV2) =>
  context?.http?.method === 'GET'
