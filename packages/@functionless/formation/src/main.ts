#!/usr/bin/env node

import { Stack } from "./stack";
import { CloudFormationTemplate } from "./template";

export async function main() {
  const deployer = new Stack({
    account: "720731445728",
    region: "us-west-2",
    stackName: "my-stack",
  });

  let state = await deployer.updateStack(template(0), {
    HashKey: "Album",
  });
  console.log("Create", state);

  // this update should delete the orhanned stream
  state = await deployer.updateStack(template(1), {
    HashKey: "Album",
  });

  console.log("Update", state);

  // delete the whole stack
  await deployer.deleteStack();
}

function template(version: number): CloudFormationTemplate {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  const template: CloudFormationTemplate = {
    AWSTemplateFormatVersion: "2010-09-09",
    Conditions: {
      NoTable: {
        "Fn::Not": [{ "Fn::Equals": [{ Ref: "HashKey" }, "Album"] }],
      },
    },
    Parameters: {
      HashKey: {
        Type: "String",
        AllowedValues: ["Album"],
      },
    },
    Rules: {
      AlbumIsAlbum: {
        Assertions: [
          {
            Assert: {
              "Fn::Equals": [{ Ref: "HashKey" }, "Album"],
            },
          },
        ],
      },
    },
    Resources: {
      // myDynamoDBTable: {
      //   Type: "AWS::DynamoDB::Table",
      //   // Condition: "NoTable",
      //   Properties: {
      //     AttributeDefinitions: [
      //       {
      //         AttributeName: "Album",
      //         AttributeType: "S",
      //       },
      //       {
      //         AttributeName: "Artist",
      //         AttributeType: "S",
      //       },
      //       {
      //         AttributeName: "Sales",
      //         AttributeType: "N",
      //       },
      //       {
      //         AttributeName: "NumberOfSongs",
      //         AttributeType: "N",
      //       },
      //     ],
      //     KeySchema: [
      //       {
      //         AttributeName: "Album",
      //         KeyType: "HASH",
      //       },
      //       {
      //         AttributeName: "Artist",
      //         KeyType: "RANGE",
      //       },
      //     ],
      //     BillingMode: "PAY_PER_REQUEST",
      //     TableName: "myTableName",
      //     GlobalSecondaryIndexes: [
      //       {
      //         IndexName: "myGSI",
      //         KeySchema: [
      //           {
      //             AttributeName: "Sales",
      //             KeyType: "HASH",
      //           },
      //           {
      //             AttributeName: "Artist",
      //             KeyType: "RANGE",
      //           },
      //         ],
      //         Projection: {
      //           NonKeyAttributes: ["Album", "NumberOfSongs"],
      //           ProjectionType: "INCLUDE",
      //         },
      //       },
      //       {
      //         IndexName: "myGSI2",
      //         KeySchema: [
      //           {
      //             AttributeName: "NumberOfSongs",
      //             KeyType: "HASH",
      //           },
      //           {
      //             AttributeName: "Sales",
      //             KeyType: "RANGE",
      //           },
      //         ],
      //         Projection: {
      //           NonKeyAttributes: ["Album", "Artist"],
      //           ProjectionType: "INCLUDE",
      //         },
      //       },
      //     ],
      //     LocalSecondaryIndexes: [
      //       {
      //         IndexName: "myLSI",
      //         KeySchema: [
      //           {
      //             AttributeName: "Album",
      //             KeyType: "HASH",
      //           },
      //           {
      //             AttributeName: "Sales",
      //             KeyType: "RANGE",
      //           },
      //         ],
      //         Projection: {
      //           NonKeyAttributes: ["Artist", "NumberOfSongs"],
      //           ProjectionType: "INCLUDE",
      //         },
      //       },
      //     ],
      //   },
      // },
      MyStream: {
        Type: "AWS::Kinesis::Stream",
        Properties: {
          Name: "MyKinesisStream",
          RetentionPeriodHours: 168,
          ShardCount: 1,
          // StreamEncryption: {
          //   EncryptionType: "KMS",
          //   KeyId: "!Ref myKey",
          // },
          Tags: [
            {
              Key: "Environment",
              Value: "Production",
            },
          ],
        },
      },
      // myKey: {
      //   Type: "AWS::KMS::Key",
      //   Properties: {
      //     Description: "An example symmetric KMS key",
      //     EnableKeyRotation: true,
      //     PendingWindowInDays: 20,
      //     KeyPolicy: {
      //       Version: "2012-10-17",
      //       Id: "key-default-1",
      //       Statement: [
      //         {
      //           Sid: "Enable IAM User Permissions",
      //           Effect: "Allow",
      //           Principal: {
      //             AWS: "arn:aws:iam::720731445728:root",
      //           },
      //           Action: "kms:*",
      //           Resource: "*",
      //         },
      //       ],
      //     },
      //   },
      // },
    },
  };

  if (version === 1) {
    // delete MyStream
    delete (template.Resources as any).MyStream;
  }

  return template;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
