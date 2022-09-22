import { aws_dynamodb } from "aws-cdk-lib";
import { JsonFormat } from "typesafe-dynamodb";
import { BatchGetItem, createBatchGetItemIntegration } from "./batch-get-item";
import { createDeleteItemIntegration, DeleteItem } from "./delete-item";
import { GetItem, createGetItemIntegration } from "./get-item";
import { createPutItemIntegration, PutItem } from "./put-item";
import { createQueryIntegration, Query } from "./query";
import { createScanIntegration, Scan } from "./scan";
import { UpdateItem, createUpdateItemIntegration } from "./update-item";

export class TableRuntimeApi<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Format extends JsonFormat
> {
  readonly get: GetItem<Item, PartitionKey, RangeKey, Format>;

  readonly batchGet: BatchGetItem<Item, PartitionKey, RangeKey, Format>;

  readonly update: UpdateItem<Item, PartitionKey, RangeKey, Format>;

  readonly put: PutItem<Item, Format>;

  readonly delete: DeleteItem<Item, PartitionKey, RangeKey, Format>;

  readonly query: Query<Item, Format>;

  readonly scan: Scan<Item, Format>;

  constructor(readonly resource: aws_dynamodb.ITable, readonly format: Format) {
    this.get = createGetItemIntegration(resource, format);
    this.batchGet = createBatchGetItemIntegration(resource, format);
    this.update = createUpdateItemIntegration(resource, format);
    this.put = createPutItemIntegration(resource, format);
    this.delete = createDeleteItemIntegration(resource, format);
    this.query = createQueryIntegration(resource, format);
    this.scan = createScanIntegration(resource, format);
  }
}
