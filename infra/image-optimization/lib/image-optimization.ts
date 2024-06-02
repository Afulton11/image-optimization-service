// import * as cdk from 'aws-cdk-lib';
import { CfnOutput, Duration, RemovalPolicy, aws_logs, Fn } from 'aws-cdk-lib'
import * as cloudFront from 'aws-cdk-lib/aws-cloudfront'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import { Construct } from 'constructs'
import { createHash } from 'crypto'
import { DeploymentStages, getAllConfig } from './util'
import { ImageOptimizeLambda } from './optimize-lambda'
import { getOriginShieldRegion } from './origin-shield'
import * as fs from 'fs'
import { IMAGE_OPERATIONS, SIGNING_QUERY_PARAMS } from '@my/shared-image-optimization'

const TEN_KB_IN_BYTES = 10000

export interface ImageOptimizationProps {
  bucketPrefix: string
  lambdaMemoryForImageOptimizer: number
  imageVariantsExpirationDays: number
}

export class ImageOptimization extends Construct {
  public readonly originalImagesBucket: s3.Bucket
  public readonly imageVariantsBucket: s3.Bucket
  public readonly distribution: cloudFront.Distribution

  constructor(scope: Construct, id: string, props: ImageOptimizationProps) {
    super(scope, id)
    const { stage, region } = getAllConfig(this.node)
    const { bucketPrefix, lambdaMemoryForImageOptimizer, imageVariantsExpirationDays } = props

    const cloudFrontLambdaSecret = createHash('md5').update(this.node.addr).digest('hex')

    // bucket for original images uploaded by users.
    this.originalImagesBucket = new s3.Bucket(this, 'original-images', {
      bucketName: `${bucketPrefix}-original-images`,
      removalPolicy: RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      autoDeleteObjects: false,
      // allow clients to directly post to the s3 bucket, given it's a signed url.
      cors: [
        {
          maxAge: 600,
          allowedHeaders: ['*'],
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['*'],
        },
      ],
    })
    // Transformed images bucket for image optimization on web / mobile.
    this.imageVariantsBucket = new s3.Bucket(this, 'image-variants', {
      bucketName: `${bucketPrefix}-image-variants`,
      removalPolicy: RemovalPolicy.RETAIN_ON_UPDATE_OR_DELETE,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      autoDeleteObjects: false,
      lifecycleRules: [
        {
          expiration: Duration.days(imageVariantsExpirationDays),
        },
      ],
    })

    // optimize images
    const imageOptimizerLambda = new ImageOptimizeLambda(this, 'image-optimizer', {
      logRetention:
        DeploymentStages.DEVO === stage
          ? aws_logs.RetentionDays.ONE_DAY
          : aws_logs.RetentionDays.TWO_WEEKS,
      memorySize: lambdaMemoryForImageOptimizer,
      originalImageBucket: this.originalImagesBucket,
      imageVariantBucket: this.imageVariantsBucket,
      // TODO: Run tests against max image size (1024 x 1024) on how long they take to process.
      timeout: Duration.seconds(20), // we shouldn't take longer than 20 seconds to process an image.
      secretKey: cloudFrontLambdaSecret,
    })

    // need to parse lambda url to get domain name:
    // https://github.com/aws/aws-cdk/issues/20254
    const imageOptimizerLambdaUrl = imageOptimizerLambda.url.url
    new CfnOutput(this, 'imageOptimizerLambdaUrl', {
      exportName: `${stage}ImageOptimizerLambdaUrl`,
      description: 'The url for the image optimizer lambda',
      value: imageOptimizerLambdaUrl,
    })

    const imageOptimizerLambdaDomain = Fn.select(2, Fn.split('/', imageOptimizerLambdaUrl))
    new CfnOutput(this, 'imageOptimizerLambdaDomain', {
      exportName: `${stage}imageOptimizerLambdaDomain`,
      description: 'The domain name for the image optimizer lambda',
      value: imageOptimizerLambdaDomain,
    })
    const originShieldRegion = getOriginShieldRegion(region!)
    const imageOrigin = new origins.OriginGroup({
      // First, try to get the image from the bucket containing the image variants.
      primaryOrigin: new origins.S3Origin(this.imageVariantsBucket, {
        originShieldRegion: originShieldRegion,
      }),
      // Second, fallback to the image optimizer lambda to retrieve the image from the original images and transform it.
      fallbackOrigin: new origins.HttpOrigin(imageOptimizerLambdaDomain, {
        originShieldRegion: originShieldRegion,
        customHeaders: {
          // Apply the custom secret to the header so the lambda accepts calls from the origin.
          'x-origin-secret-header': cloudFrontLambdaSecret,
        },
      }),
      // fallback when 403 is returned from retrieving the image variant.
      fallbackStatusCodes: [403],
    })

    // We need to ensure the function adheres to the requirements.
    // https://repost.aws/questions/QUyiUmFAvYQaylmG_UkfJZrA/creating-a-cloudfront-function-in-typescript-using-the-cdk
    // Cloudfront functions only throw internal server error 'null' exceptions when deploying...
    // Sometimes this can be due to the code being > 10 KB.
    const urlRewriteCodePath =
      __dirname + '/' + '../../../apps/lambda-edge-url-rewrite/dist/index.js'
    const isCloudfrontFunctionTooLarge =
      fs.readFileSync(urlRewriteCodePath).byteLength >= TEN_KB_IN_BYTES
    if (isCloudfrontFunctionTooLarge) {
      throw Error('UrlRewrite Cloudfront function is too large!')
    }
    // rewrite the url using a lambda so that we have more cache hits.
    const urlRewriteCloudfrontFunction = new cloudFront.Function(this, 'urlRewriterFunction', {
      code: cloudFront.FunctionCode.fromFile({
        filePath: urlRewriteCodePath,
      }),
      runtime: cloudFront.FunctionRuntime.JS_2_0,
      // we use a random string as otherwise cloudfront function deployments fail with 'null' error
      // Something odd with using the same name.
      functionName: `${stage?.toLowerCase()}-urlRewriteFunction-${(Math.random() + 1)
        .toString(36)
        .substring(7)}`,
    })

    this.distribution = new cloudFront.Distribution(this, 'imageDelivery', {
      comment: 'distribution to deliver optimized images with a cache',
      defaultBehavior: {
        origin: imageOrigin,
        viewerProtocolPolicy: cloudFront.ViewerProtocolPolicy.HTTPS_ONLY,
        functionAssociations: [
          {
            // on requests received, call the cloudfront function before retrieving from cache.
            eventType: cloudFront.FunctionEventType.VIEWER_REQUEST,
            function: urlRewriteCloudfrontFunction,
          },
        ],
        cachePolicy: new cloudFront.CachePolicy(this, `ImageCachePolicy${this.node.addr}`, {
          defaultTtl: Duration.hours(24),
          maxTtl: Duration.days(365),
          minTtl: Duration.seconds(0),
          // Explicitly setting to none.
          // The url-rewrite lambda rewrites the query string parameters we need to cache on the path.
          queryStringBehavior: cloudFront.CacheQueryStringBehavior.none(),
        }),
        originRequestPolicy: new cloudFront.OriginRequestPolicy(
          this,
          `originRequestPolicy${this.node.addr}`,
          {
            originRequestPolicyName: 'PassImageAndSignatureParamsToOrigin',
            comment:
              'Passes only the image optimization (e.g: format, width) query params to the origin.',
            // For Why we need this policy, see:
            // 1. https://stackoverflow.com/questions/58577401/querystring-not-getting-in-aws-lambda-integration-proxy
            // 2. https://docs.aws.amazon.com/cloudfront/latest/APIReference/API_ForwardedValues.html
            // 3. https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/controlling-origin-requests.html#origin-request-create-origin-request-policy
            queryStringBehavior: cloudFront.OriginRequestQueryStringBehavior.allowList(
              ...Object.values(IMAGE_OPERATIONS)
            ),
          }
        ),
        responseHeadersPolicy: new cloudFront.ResponseHeadersPolicy(
          this,
          `ResponseHeadersPolicy${this.node.addr}`,
          {
            responseHeadersPolicyName: 'ImageResponsePolicy',
            // Enable CORS
            corsBehavior: {
              accessControlAllowCredentials: false,
              accessControlAllowHeaders: ['*'],
              accessControlAllowMethods: ['GET'],
              accessControlAllowOrigins: ['*'],
              accessControlMaxAge: Duration.seconds(600),
              originOverride: false,
            },
            // recognizing image requests that were processed by this solution
            customHeadersBehavior: {
              customHeaders: [
                { header: 'x-aws-image-optimization', value: 'v1.0', override: true },
                { header: 'vary', value: 'accept', override: true },
              ],
            },
          }
        ),
      },
      httpVersion: cloudFront.HttpVersion.HTTP2_AND_3,
    })

    // log the domain name for the image delivery distribution when describe-stacks is called.
    new CfnOutput(this, 'ImageDeliveryDomain', {
      exportName: `${stage}ImageDistroDomain`,
      description: 'Domain name of image delivery distribution',
      value: this.distribution.distributionDomainName,
    })
  }
}
