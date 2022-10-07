import {
  CreateRequest,
  DeleteRequest,
  ResourceProvider,
  ResourceProviderProps,
  UpdateRequest,
} from "../resource-provider";
import { PhysicalResource } from "../resource";
import * as events from "@aws-sdk/client-eventbridge";
import type { Tag } from "@aws-sdk/client-eventbridge";
import { awsSDKRetry } from "../util";

interface EventBusResource {
  /**
   * <p>The name of the new event bus. </p>
   *          <p>Event bus names cannot contain the / character. You can't use the name
   *         <code>default</code> for a custom event bus, as this name is already used for your account's
   *       default event bus.</p>
   *          <p>If this is a partner event bus, the name must exactly match the name of the partner event
   *       source that this event bus is matched to.</p>
   */
  Name: string | undefined;
  /**
   * <p>If you are creating a partner event bus, this specifies the partner event source that the
   *       new event bus will be matched with.</p>
   */
  EventSourceName?: string;
  /**
   * <p>Tags to associate with the event bus.</p>
   */
  Tags?: Tag[];
}

export class EventBusProvider implements ResourceProvider<EventBusResource> {
  private eventBridgeClient: events.EventBridgeClient;

  constructor(private props: ResourceProviderProps) {
    this.eventBridgeClient = new events.EventBridgeClient(props.sdkConfig);
  }

  async create(
    request: CreateRequest<EventBusResource>
  ): Promise<PhysicalResource<EventBusResource>> {
    let result: { arn: string };
    try {
      const r = await awsSDKRetry(() =>
        this.eventBridgeClient.send(
          new events.CreateEventBusCommand(
            // TODO - support undefined name
            request.definition as unknown as events.CreateEventBusCommandInput
          )
        )
      );
      if (!r.EventBusArn) {
        throw new Error("Expected event arn");
      }
      result = {
        arn: r.EventBusArn,
      };
    } catch (err) {
      // TODO: support updates.
      if (err instanceof events.ResourceAlreadyExistsException) {
        result = {
          arn: `arn:aws:events:${this.props.region}:${this.props.account}:event-bus/${request.definition.Name}`,
        };
      } else {
        throw err;
      }
    }
    return {
      PhysicalId: result.arn,
      Attributes: {
        Arn: result.arn,
      },
      InputProperties: request.definition,
      Type: request.resourceType,
    };
  }
  update(
    _request: UpdateRequest<EventBusResource>
  ): Promise<
    | PhysicalResource<EventBusResource>
    | { paddingMillis: number; resource: PhysicalResource<EventBusResource> }
  > {
    throw new Error("Method not implemented.");
  }
  delete(_request: DeleteRequest<EventBusResource>): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
