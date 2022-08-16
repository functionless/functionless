import type { ServiceKeys } from "./aws-sdk";

export const IAM_SERVICE_PREFIX: Record<ServiceKeys, string> = {
  AccessAnalyzer: "access-analyzer",
  Account: "account",
  ACM: "acm",
  ACMPCA: "acm-pca",
  AlexaForBusiness: "a4b",
  Amp: "aps",
  Amplify: "amplify",
  AmplifyBackend: "amplifybackend",
  AmplifyUIBuilder: "amplifyuibuilder",
  APIGateway: "apigateway",
  ApiGatewayManagementApi: "apigateway",
  ApiGatewayV2: "apigateway",
  AppConfig: "appconfig",
  AppConfigData: "appconfig",
  Appflow: "appflow",
  AppIntegrations: "app-insights",
  ApplicationAutoScaling: "application-autoscaling",
  ApplicationCostProfiler: "application-cost-profiler",
  ApplicationInsights: "applicationinsights",
  AppMesh: "appmesh",
  AppRunner: "apprunner",
  AppStream: "appstream",
  AppSync: "appsync",
  Athena: "athena",
  AuditManager: "auditmanager",
  AugmentedAIRuntime: "sagemaker",
  AutoScaling: "autoscaling",
  AutoScalingPlans: "autoscaling-plans",
  Backup: "backup",
  BackupGateway: "backup-gateway",
  // BackupStorage is missing in AWS type :shrug:
  // BackupStorage: "backup-storage",
  Batch: "batch",
  Billingconductor: "billingconductor",
  Braket: "braket",
  Budgets: "budgets",
  Chime: "chime",
  ChimeSDKIdentity: "chime",
  ChimeSDKMediaPipelines: "chime",
  ChimeSDKMeetings: "chime",
  ChimeSDKMessaging: "chime",
  Cloud9: "cloud9",
  CloudControl: "cloudformation",
  CloudDirectory: "clouddirectory",
  CloudFormation: "cloudformation",
  CloudFront: "cloudfront",
  CloudHSM: "cloudhsm",
  CloudHSMV2: "cloudhsm",
  CloudSearch: "cloudsearch",
  CloudSearchDomain: "cloudsearch",
  CloudTrail: "cloudtrail",
  CloudWatch: "cloudwatch",
  CloudWatchEvents: "events",
  CloudWatchLogs: "logs",
  CodeArtifact: "codeartifact",
  CodeBuild: "codebuild",
  CodeCommit: "codecommit",
  CodeDeploy: "codedeploy",
  CodeGuruProfiler: "codeguru-profiler",
  CodeGuruReviewer: "codeguru-reviewer",
  CodePipeline: "codepipeline",
  CodeStar: "codestar",
  CodeStarconnections: "codestar-connections",
  CodeStarNotifications: "codestar-notifications",
  CognitoIdentity: "cognito-identity",
  CognitoIdentityServiceProvider: "cognito-idp",
  CognitoSync: "cognito-sync",
  Comprehend: "comprehend",
  ComprehendMedical: "comprehendmedical",
  ComputeOptimizer: "compute-optimizer",
  ConfigService: "config",
  Connect: "connect",
  ConnectCampaigns: "connect-campaigns",
  ConnectContactLens: "connect",
  ConnectParticipant: "connect",
  CostExplorer: "ce",
  CUR: "cur",
  CustomerProfiles: "profile",
  DataBrew: "databrew",
  DataExchange: "dataexchange",
  DataPipeline: "datapipeline",
  DataSync: "datasync",
  DAX: "dax",
  Detective: "detective",
  DeviceFarm: "devicefarm",
  DevOpsGuru: "devops-guru",
  DirectConnect: "directconnect",
  DirectoryService: "ds",
  Discovery: "discovery",
  DLM: "dlm",
  DMS: "dms",
  DocDB: "rds", // source: https://docs.aws.amazon.com/documentdb/latest/developerguide/UsingWithRDS.IAM.ResourcePermissions.html
  Drs: "drs",
  DynamoDB: "dynamodb",
  DynamoDBStreams: "dynamodb",
  EBS: "ebs",
  EC2: "ec2",
  EC2InstanceConnect: "ec2-instance-connect",
  ECR: "ecr",
  ECRPUBLIC: "ecr-public",
  ECS: "ecs",
  EFS: "elasticfilesystem",
  EKS: "eks",
  ElastiCache: "elasticache",
  ElasticBeanstalk: "elasticbeanstalk",
  ElasticInference: "elastic-inference",
  ElasticTranscoder: "elastictranscoder",
  ELB: "elasticloadbalancing",
  ELBv2: "elasticloadbalancing",
  EMR: "elasticmapreduce",
  EMRcontainers: "elasticmapreduce",
  EMRServerless: "elasticmapreduce",
  ES: "es",
  EventBridge: "events",
  Evidently: "evidently",
  Finspace: "finspace",
  Finspacedata: "finspace",
  Firehose: "firehose",
  Fis: "fis",
  FMS: "fms",
  ForecastQueryService: "forecast",
  ForecastService: "forecast",
  FraudDetector: "frauddetector",
  FSx: "fsx",
  GameLift: "gamelift",
  GameSparks: "gamesparks",
  Glacier: "glacier",
  GlobalAccelerator: "globalaccelerator",
  Glue: "glue",
  Grafana: "grafana",
  Greengrass: "greengrass",
  GreengrassV2: "greengrass",
  GroundStation: "groundstation",
  GuardDuty: "guardduty",
  Health: "health",
  HealthLake: "healthlake",
  Honeycode: "honeycode",
  IAM: "iam",
  IdentityStore: "identitystore",
  Imagebuilder: "imagebuilder",
  ImportExport: "importexport",
  Inspector: "inspector",
  Inspector2: "inspector2",
  Iot: "iot",
  IoT1ClickDevicesService: "iot1click",
  IoT1ClickProjects: "iot1click",
  IoTAnalytics: "iotanalytics",
  IotData: "iot",
  IotDeviceAdvisor: "iotdeviceadvisor",
  IoTEvents: "iotevents",
  IoTEventsData: "iotevents",
  IoTFleetHub: "iotfleethub",
  IoTJobsDataPlane: "iotjobsdata",
  IoTSecureTunneling: "iot",
  IoTSiteWise: "iotsitewise",
  IoTThingsGraph: "iotthingsgraph",
  IoTTwinMaker: "iottwinmaker",
  IoTWireless: "iotwireless",
  IVS: "ivs",
  Ivschat: "ivschat",
  Kafka: "kafka",
  KafkaConnect: "kafkaconnect",
  Kendra: "kendra",
  Keyspaces: "cassandra",
  Kinesis: "kinesis",
  KinesisAnalytics: "kinesisanalytics",
  KinesisAnalyticsV2: "kinesisanalytics",
  KinesisVideo: "kinesisvideo",
  KinesisVideoArchivedMedia: "kinesisvideo",
  KinesisVideoMedia: "kinesisvideo",
  KinesisVideoSignalingChannels: "kinesisvideo",
  KMS: "kms",
  LakeFormation: "lakeformation",
  Lambda: "lambda",
  LexModelBuildingService: "lex",
  LexModelsV2: "lex",
  LexRuntime: "lex",
  LexRuntimeV2: "lex",
  LicenseManager: "license-manager",
  LicenseManagerUserSubscriptions: "license-manager-user-subscriptions",
  Lightsail: "lightsail",
  Location: "geo",
  LookoutEquipment: "lookoutequipment",
  LookoutMetrics: "lookoutmetrics",
  LookoutVision: "lookoutvision",
  M2: "m2", // AWS Mainframe Modernization Service
  MachineLearning: "machinelearning",
  Macie: "macie",
  Macie2: "macie2",
  ManagedBlockchain: "managedblockchain",
  MarketplaceCatalog: "aws-marketplace",
  MarketplaceCommerceAnalytics: "marketplacecommerceanalytics",
  MarketplaceEntitlementService: "aws-marketplace",
  MarketplaceMetering: "aws-marketplace",
  MediaConnect: "mediaconnect",
  MediaConvert: "mediaconvert",
  MediaLive: "medialive",
  MediaPackage: "mediapackage",
  MediaPackageVod: "mediapackage-vod",
  MediaStore: "mediastore",
  MediaStoreData: "mediastore",
  MediaTailor: "mediatailor",
  MemoryDB: "memorydb",
  Mgn: "mgn", // AWS Application Migration Service
  MigrationHub: "mgh",
  MigrationHubConfig: "mgh",
  MigrationHubRefactorSpaces: "refactor-spaces",
  MigrationHubStrategy: "migrationhub-strategy",
  Mobile: "mobilehub",
  MobileAnalytics: "mobileanalytics",
  MQ: "mq",
  MTurk: "mechanicalturk",
  MWAA: "airflow",
  Neptune: "neptune-db",
  NetworkFirewall: "network-firewall",
  NetworkManager: "networkmanager",
  Nimble: "nimble",
  OpenSearch: "es",
  OpsWorks: "opsworks",
  OpsWorksCM: "opsworks-cm",
  Organizations: "organizations",
  Outposts: "outposts",
  Panorama: "panorama",
  Personalize: "personalize",
  PersonalizeEvents: "personalize",
  PersonalizeRuntime: "personalize",
  PI: "pi", // AWS Performance Insights
  Pinpoint: "mobiletargeting",
  PinpointEmail: "ses",
  PinpointSMSVoice: "sms-voice",
  PinpointSMSVoiceV2: "sms-voice",
  Polly: "polly",
  Pricing: "pricing",
  Proton: "proton",
  QLDB: "qldb",
  QLDBSession: "qldb",
  QuickSight: "quicksight",
  RAM: "ram", // AWS Resource Access Manager
  Rbin: "rbin", // Recycle Bin
  RDS: "rds",
  RDSDataService: "rds-data",
  Redshift: "redshift",
  RedshiftData: "redshift-data",
  RedshiftServerless: "redshift",
  Rekognition: "rekognition",
  Resiliencehub: "resiliencehub",
  ResourceGroups: "resource-groups",
  ResourceGroupsTaggingAPI: "tag",
  RoboMaker: "robomaker",
  RolesAnywhere: "rolesanywhere",
  Route53: "route53",
  Route53Domains: "route53domains",
  Route53RecoveryCluster: "route53-recovery-cluster",
  Route53RecoveryControlConfig: "route53-recovery-control-config",
  Route53RecoveryReadiness: "route53-recovery-readiness",
  Route53Resolver: "route53resolver",
  RUM: "rum",
  S3: "s3",
  S3Control: "s3",
  S3Outposts: "s3-outposts",
  SageMaker: "sagemaker",
  SagemakerEdge: "sagemaker",
  SageMakerFeatureStoreRuntime: "sagemaker",
  SageMakerRuntime: "sagemaker",
  SavingsPlans: "savingsplans",
  Schemas: "schemas",
  SecretsManager: "secretsmanager",
  SecurityHub: "securityhub",
  ServerlessApplicationRepository: "serverlessrepo",
  ServiceCatalog: "servicecatalog",
  ServiceCatalogAppRegistry: "servicecatalog",
  ServiceDiscovery: "servicediscovery",
  ServiceQuotas: "servicequotas",
  SES: "ses",
  SESV2: "ses",
  Shield: "shield",
  Signer: "signer",
  SimpleDB: "sdb",
  SMS: "sms", // AWS Server Migration Service
  Snowball: "snowball",
  SnowDeviceManagement: "snow-device-management",
  SNS: "sns",
  SQS: "sqs",
  SSM: "ssm",
  SSMContacts: "ssm-contacts",
  SSMIncidents: "ssm-incidents",
  SSO: "sso",
  SSOAdmin: "sso",
  SSOOIDC: "sso-directory",
  StepFunctions: "states",
  StorageGateway: "storagegateway",
  STS: "sts",
  Support: "support",
  SWF: "swf", // Amazon Simple Workflow Service
  Synthetics: "synthetics",
  Textract: "textract",
  TimestreamQuery: "timestream",
  TimestreamWrite: "timestream",
  TranscribeService: "transcribe",
  Transfer: "transfer",
  Translate: "translate",
  VoiceID: "voiceid",
  WAF: "waf",
  WAFRegional: "waf-regional",
  WAFV2: "wafv2",
  WellArchitected: "wellarchitected",
  Wisdom: "wisdom",
  WorkDocs: "workdocs",
  WorkLink: "worklink",
  WorkMail: "workmail",
  WorkMailMessageFlow: "workmailmessageflow",
  WorkSpaces: "workspaces",
  WorkSpacesWeb: "workspaces-web",
  XRay: "xray",
};
