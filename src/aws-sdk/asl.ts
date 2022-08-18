import { ServiceKeys } from "./types";

export const SDK_INTEGRATION_SERVICE_NAME: Partial<
  Record<ServiceKeys, string>
> = {
  Discovery: "applicationdiscovery",
  ConfigService: "config",
  CUR: "costandusagereport",
  DMS: "databasemigration",
  DirectoryService: "directory",
  MarketplaceEntitlementService: "marketplaceentitlement",
  RDSDataService: "rdsdata",
  StepFunctions: "sfn",
  AugmentedAIRuntime: "sagemakera2iruntime",
  ForecastQueryService: "forecastquery",
  KinesisVideoSignalingChannels: "kinesisvideosignaling",
  LexModelBuildingService: "lexmodelbuilding",
  TranscribeService: "transcribe",
  ELB: "elasticloadbalancing",
  ELBv2: "elasticloadbalancingv2",
};
