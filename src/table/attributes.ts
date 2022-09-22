import { createBatchGetItemAttributesIntegration } from "./batch-get-item";
import { createDeleteItemAttributesIntegration } from "./delete-item";
import { createGetItemAttributesIntegration } from "./get-item";
import { createPutItemAttributesIntegration } from "./put-item";
import { createQueryAttributesIntegration } from "./query";
import { createScanAttributesIntegration } from "./scan";
import { ITable } from "./table";
import { createUpdateItemAttributesIntegration } from "./update-item";

export class TableAttributesInterface<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined = undefined
> {
  constructor(readonly table: ITable<Item, PartitionKey, RangeKey>) {}

  readonly get = createGetItemAttributesIntegration(this.table);
  readonly batchGet = createBatchGetItemAttributesIntegration(this.table);
  readonly put = createPutItemAttributesIntegration(this.table);
  readonly delete = createDeleteItemAttributesIntegration(this.table);
  readonly update = createUpdateItemAttributesIntegration(this.table);
  readonly query = createQueryAttributesIntegration(this.table);
  readonly scan = createScanAttributesIntegration(this.table);
}
