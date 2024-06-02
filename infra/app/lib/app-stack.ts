import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import {
  DeploymentStages,
  ImageOptimization,
  Regions,
  getAllConfig,
} from '@infra/image-optimization'
import { VercelAppUser } from './vercel-user'

export class AppStack extends cdk.Stack {
  private readonly stage: DeploymentStages
  private readonly appRegion: Regions
  constructor(scope: Construct, id: string) {
    super(scope, id)
    const { region, stage } = getAllConfig(this.node)

    this.appRegion = region!
    this.stage = stage!

    const imageOptimization = new ImageOptimization(this, 'image-optimization', {
      bucketPrefix: `${stage!.toLowerCase()}`,
      imageVariantsExpirationDays: DeploymentStages.DEVO === stage ? 1 : 365,
      lambdaMemoryForImageOptimizer: 256,
    })

    const vercelAppUser = new VercelAppUser(this, 'vercel-user', {
      originalImagesBucket: imageOptimization.originalImagesBucket,
      imageVariantsBucket: imageOptimization.imageVariantsBucket,
      imageOptimizationDistribution: imageOptimization.distribution,
    })
  }

  protected allocateLogicalId(cfnElement: cdk.CfnElement): string {
    const originalId = super.allocateLogicalId(cfnElement)
    const elementIdPrefix = `${this.stage.toLowerCase()}`
    return elementIdPrefix + originalId[0].toUpperCase() + originalId.slice(1)
  }
}
