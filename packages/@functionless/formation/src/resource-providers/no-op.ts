import {
  CreateRequest,
  DeleteRequest,
  ResourceOperationResult,
  ResourceOperationResultMetadata,
  ResourceProvider,
  UpdateRequest,
} from "../resource-provider";

export class NoOpProvider implements ResourceProvider<any> {
  async create(request: CreateRequest<any>): ResourceOperationResult<any> {
    return {
      Attributes: {},
      InputProperties: {},
      Type: request.resourceType,
      PhysicalId: undefined,
    };
  }
  async update(request: UpdateRequest<any>): ResourceOperationResult<any> {
    return {
      Attributes: {},
      InputProperties: {},
      Type: request.resourceType,
      PhysicalId: undefined,
    };
  }
  async delete(
    _request: DeleteRequest<any>
  ): Promise<void | ResourceOperationResultMetadata> {
    return;
  }
}
