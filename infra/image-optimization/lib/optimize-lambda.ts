import { Construct } from 'constructs'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import { Duration, aws_logs as logs } from 'aws-cdk-lib'
import * as path from 'path'

export interface ImageOptimizeLambdaProps {
  originalImageBucket: s3.Bucket
  imageVariantBucket: s3.Bucket
  secretKey: string
  memorySize: number
  timeout: Duration
  logRetention: logs.RetentionDays
}

export class ImageOptimizeLambda extends Construct {
  public readonly lambda: lambda.Function
  public readonly url: lambda.FunctionUrl

  constructor(scope: Construct, id: string, props: ImageOptimizeLambdaProps) {
    super(scope, id)
    const {
      originalImageBucket,
      imageVariantBucket,
      memorySize,
      timeout,
      logRetention,
      secretKey,
    } = props

    const lambdaImageProcessingPath = path.join(__dirname, '../../../apps/lambda-image-processing/')
    const imageProcessingCode = path.join(lambdaImageProcessingPath, 'dist/')
    const sharpLayerCode = path.join(lambdaImageProcessingPath, 'lambda-layers-sharp/layer')
    console.log('🗂 Created lambda paths for ImageOptimizeLambda: ', {
      imageProcessingCode,
      sharpLayerCode,
    })

    const sharpLayer = new lambda.LayerVersion(this, 'SharpLayer', {
      code: lambda.Code.fromAsset(sharpLayerCode),
      compatibleArchitectures: [lambda.Architecture.ARM_64],
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
    })

    this.lambda = new lambda.Function(this, 'imageOptimizer', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(imageProcessingCode),
      architecture: lambda.Architecture.ARM_64,
      memorySize,
      timeout,
      logRetention,
      environment: {
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
        NODE_OPTiONS: `--max-old-space-size=${memorySize - 5} --enable-source-maps`,
        originalImageBucketName: originalImageBucket.bucketName,
        imageVariantBucketName: imageVariantBucket.bucketName,
        originSecretKey: secretKey,
      },
      layers: [sharpLayer],
    })

    // Alow the optimize lambda to read from original images
    originalImageBucket.grantRead(this.lambda)

    // Allow the optimize lambda to write to the transformed images
    imageVariantBucket.grantReadWrite(this.lambda)

    // add a url to the function for calling by Cloudfront.
    this.url = this.lambda.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    })
  }
}
