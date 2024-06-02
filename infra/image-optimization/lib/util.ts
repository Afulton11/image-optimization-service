import { Node } from 'constructs'

export enum DeploymentStages {
  DEVO = 'Devo',
  PROD = 'Prod',
}

export enum Regions {
  US_WEST_2 = 'us-west-2',
}

type GetEnvVariableOptions<T = string> = {
  key: string
  default?: T
  toType?: (value: string) => T
}
export const getEnvConfig = <T = string>(
  node: Node,
  options: GetEnvVariableOptions<T>
): T | undefined => {
  const configValue = node.tryGetContext(options.key) || process.env[options.key]
  if (configValue) {
    return options?.toType?.(configValue) ?? (configValue as T)
  }
  return options.default
}

export const getAllConfig = (node: Node) => ({
  stage: getEnvConfig<DeploymentStages>(node, {
    key: 'STAGE',
    default: DeploymentStages.DEVO,
    toType: (value) => DeploymentStages[value as keyof typeof DeploymentStages],
  }),
  region: getEnvConfig<Regions>(node, {
    key: 'AWS_REGION',
    default: Regions[process.env.CDK_DEFAULT_REGION as keyof typeof Regions] || Regions.US_WEST_2,
    toType: (value) => Regions[value as keyof typeof Regions],
  }),
})
