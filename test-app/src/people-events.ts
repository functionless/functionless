import * as functionless from "functionless";
import { aws_events, aws_lambda } from "aws-cdk-lib";
import { Construct } from "constructs";

interface UserDetails {
  id?: string;
  name: string;
  age: number;
  interests: string[];
}

interface UserEvent
  extends functionless.EventBusRuleInput<
    UserDetails,
    // We can provide custom detail-types to match on
    "Create" | "Update" | "Delete"
  > {}

interface CreateOrUpdate {
  id?: string;
  name: string;
  age: number;
  operation: "Create" | "Update";
  interests: string[];
}

interface Delete {
  id: string;
}

export class PeopleEvents extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const createOrUpdateFunction = new functionless.Function<
      CreateOrUpdate,
      void
    >(
      new aws_lambda.Function(this, "createOrUpdate", {
        code: aws_lambda.Code.fromInline(`
      exports.handler = async (event) => {
          console.log('event: ', event)
        };
      `),
        runtime: aws_lambda.Runtime.NODEJS_14_X,
        handler: "index.handler",
      })
    );

    const deleteFunction = new functionless.Function<Delete, void>(
      new aws_lambda.Function(this, "delete", {
        code: aws_lambda.Code.fromInline(`
      exports.handler = async (event) => {
          console.log('event: ', event)
        };
      `),
        runtime: aws_lambda.Runtime.NODEJS_14_X,
        handler: "index.handler",
      })
    );

    const bus = new functionless.EventBus<UserEvent>(
      new aws_events.EventBus(this, "myBus")
    );

    // Create and update events are sent to a spcific lambda function.
    bus
      .when(
        this,
        "createOrUpdateRule",
        (event) =>
          event["detail-type"] === "Create" || event["detail-type"] === "Update"
      )
      .map<CreateOrUpdate>((event) => ({
        id: event.detail.id,
        name: event.detail.name,
        age: event.detail.age,
        operation: event["detail-type"] as "Create" | "Update",
        interests: event.detail.interests,
      }))
      .pipe(createOrUpdateFunction);

    // Delete events are sent to a spcific lambda function.
    bus
      .when(this, "deleteRule", (event) => event["detail-type"] === "Delete")
      .map<Delete>((event) => ({
        id: event.detail.id!,
      }))
      .pipe(deleteFunction);

    const youngAdultCatLoversBus = new functionless.EventBus<UserEvent>(
      new aws_events.EventBus(this, "catTeamBus")
    );

    // New, young, cat loving users are forwarded to our sister team.
    bus
      .when(
        this,
        "catLovers",
        (event) =>
          event["detail-type"] === "Create" &&
          event.detail.interests.includes("CATS") &&
          event.detail.age >= 18 &&
          event.detail.age < 30
      )
      .pipe(youngAdultCatLoversBus);
  }
}
