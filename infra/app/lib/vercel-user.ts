import { Construct } from 'constructs'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import { CfnOutput } from 'aws-cdk-lib'
import { getAllConfig } from '@infra/image-optimization'

export interface VercelAppUserProps {
  originalImagesBucket: s3.Bucket
  imageVariantsBucket: s3.Bucket
  imageOptimizationDistribution: cloudfront.Distribution
}

export class VercelAppUser extends Construct {
  public readonly user: iam.User

  constructor(scope: Construct, id: string, props: VercelAppUserProps) {
    super(scope, id)
    const { originalImagesBucket, imageVariantsBucket, imageOptimizationDistribution } = props
    const { stage } = getAllConfig(this.node)

    this.user = new iam.User(this, 'VercelAppUser')

    // Allow our vercel app to assume the user.
    const accessKey = new iam.AccessKey(this, 'vercelAppUserAccessKey', {
      user: this.user,
      serial: 0, // TODO: Auto-increment serial every 90 days or so.
    })

    // print the key, we need to retrieve this to send to our vercel app's environment variables.
    new CfnOutput(this, 'vercelAppUserAccessKeyId', {
      exportName: `${stage}VercelAppUserAccessKeyId`,
      description: 'The access key id used to assume the vercelAppUser.',
      value: accessKey.accessKeyId,
    })
    new CfnOutput(this, 'vercelAppUserSecretKey', {
      exportName: `${stage}VercelAppUserSecretKey`,
      description: 'The access key id used to assume the vercelAppUser.',
      value: accessKey.secretAccessKey.unsafeUnwrap(),
    })

    // Apply all permissions the iam user expects.
    originalImagesBucket.grantDelete(this.user)
    originalImagesBucket.grantReadWrite(this.user)
    imageVariantsBucket.grantRead(this.user)
    imageVariantsBucket.grantDelete(this.user)
    imageOptimizationDistribution.grantCreateInvalidation(this.user)
  }
}
