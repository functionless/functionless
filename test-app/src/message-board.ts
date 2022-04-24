import {
  App,
  aws_dynamodb,
  RemovalPolicy,
  Stack,
  aws_events,
} from "aws-cdk-lib";
import {
  $AWS,
  $SFN,
  $util,
  AppsyncResolver,
  Function,
  StepFunction,
  Table,
  EventBus,
  EventBusRuleInput,
} from "functionless";
import * as appsync from "@aws-cdk/aws-appsync-alpha";
import path from "path";

export const app = new App();
export const stack = new Stack(app, "message-board");

const database = new Table<Post | Comment, "pk", "sk">(
  new aws_dynamodb.Table(stack, "MessageBoard", {
    tableName: "MessageBoard",
    partitionKey: {
      name: "pk",
      type: aws_dynamodb.AttributeType.STRING,
    },
    sortKey: {
      name: "sk",
      type: aws_dynamodb.AttributeType.STRING,
    },
    billingMode: aws_dynamodb.BillingMode.PAY_PER_REQUEST,
    removalPolicy: RemovalPolicy.DESTROY,
  })
);

const schema = new appsync.Schema({
  filePath: path.join(__dirname, "..", "message-board.gql"),
});

const api = new appsync.GraphqlApi(stack, "Api", {
  name: "MessageBoard",
  schema,
  authorizationConfig: {
    defaultAuthorization: {
      authorizationType: appsync.AuthorizationType.IAM,
    },
  },
  xrayEnabled: true,
  logConfig: {
    fieldLogLevel: appsync.FieldLogLevel.ALL,
    excludeVerboseContent: false,
  },
});

export const getPost = new AppsyncResolver<
  { postId: string },
  Post | undefined
>(($context) => {
  return database.getItem({
    key: {
      pk: {
        S: `Post|${$context.arguments.postId}`,
      },
      sk: {
        S: "Post",
      },
    },
  });
}).addResolver(api, {
  typeName: "Query",
  fieldName: "getPost",
});

export const comments = new AppsyncResolver<
  { nextToken?: string; limit?: number },
  CommentPage,
  Omit<Post, "comments">
>(($context) => {
  const response = database.query({
    query: {
      expression: `pk = :pk and begins_with(#sk,:sk)`,
      expressionValues: {
        ":pk": {
          S: $context.source.pk,
        },
        ":sk": {
          S: "Comment|",
        },
      },
      expressionNames: {
        "#sk": "sk",
      },
    },
    nextToken: $context.arguments.nextToken,
    limit: $context.arguments.limit,
  });

  if (response.items !== undefined) {
    return {
      comments: response.items as Comment[],
      nextToken: response.nextToken,
    };
  }
  return {
    comments: [],
  };
}).addResolver(api, {
  typeName: "Post",
  fieldName: "comments",
});

export const createPost = new AppsyncResolver<{ title: string }, Post>(
  ($context) => {
    const postId = $util.autoUlid();
    const post = database.putItem({
      key: {
        pk: {
          S: `Post|${postId}`,
        },
        sk: {
          S: "Post",
        },
      },
      attributeValues: {
        postId: {
          S: postId,
        },
        title: {
          S: $context.arguments.title,
        },
      },
    });

    return post;
  }
).addResolver(api, {
  typeName: "Mutation",
  fieldName: "createPost",
});

export const validateComment = new Function<
  { commentText: string },
  "ok" | "bad"
>(stack, "ValidateComment", async () => {
  return "ok" as const;
});

export const commentValidationWorkflow = new StepFunction<
  { postId: string; commentId: string; commentText: string },
  void
>(stack, "CommentValidationWorkflow", (input) => {
  const status = validateComment({ commentText: input.commentText });
  if (status === "bad") {
    $AWS.DynamoDB.DeleteItem({
      TableName: database,
      Key: {
        pk: {
          S: `Post|${input.postId}`,
        },
        sk: {
          S: `Comment|${input.commentId}`,
        },
      },
    });
  }
});

export const addComment = new AppsyncResolver<
  { postId: string; commentText: string },
  Comment
>(($context) => {
  const commentId = $util.autoUlid();
  const comment = database.putItem({
    key: {
      pk: {
        S: `Post|${$context.arguments.postId}`,
      },
      sk: {
        S: `Comment|${commentId}`,
      },
    },
    attributeValues: {
      postId: {
        S: $context.arguments.postId,
      },
      commentId: {
        S: commentId,
      },
      commentText: {
        S: $context.arguments.commentText,
      },
      createdTime: {
        S: $util.time.nowISO8601(),
      },
    },
  });

  // kick off a workflow to validate the comment
  commentValidationWorkflow({ input: comment });

  return comment;
}).addResolver(api, {
  typeName: "Mutation",
  fieldName: "addComment",
});

interface MessageDeletedEvent
  extends EventBusRuleInput<
    { count: number },
    "Delete-Message-Success",
    "MessageDeleter"
  > {}

interface PostDeletedEvent
  extends EventBusRuleInput<
    { id: string },
    "Delete-Post-Success",
    "MessageDeleter"
  > {}

const customDeleteBus = new EventBus<MessageDeletedEvent | PostDeletedEvent>(
  stack,
  "deleteBus"
);

export const deleteWorkflow = new StepFunction<{ postId: string }, void>(
  stack,
  "DeletePostWorkflow",
  (input) => {
    while (true) {
      try {
        const comments = $AWS.DynamoDB.Query({
          TableName: database,
          KeyConditionExpression: `pk = :pk`,
          ExpressionAttributeValues: {
            ":pk": {
              S: `Post|${input.postId}`,
            },
          },
        });

        if (comments.Items?.[0] !== undefined) {
          $SFN.forEach(comments.Items, (comment) =>
            $AWS.DynamoDB.DeleteItem({
              TableName: database,
              Key: {
                pk: comment.pk,
                sk: comment.sk,
              },
            })
          );

          customDeleteBus({
            "detail-type": "Delete-Message-Success",
            source: "MessageDeleter",
            detail: {
              count: comments.Items.length,
            },
          });
        } else {
          $AWS.DynamoDB.DeleteItem({
            TableName: database,
            Key: {
              pk: {
                S: `Post|${input.postId}`,
              },
              sk: {
                S: "Post",
              },
            },
          });

          customDeleteBus({
            "detail-type": "Delete-Post-Success",
            source: "MessageDeleter",
            detail: {
              id: input.postId,
            },
          });

          return {
            status: "deleted",
            postId: input.postId,
          };
        }
      } catch {
        $SFN.waitFor(10);
      }
    }
  }
);

export const deletePost = new AppsyncResolver<
  { postId: string },
  AWS.StepFunctions.StartExecutionOutput | undefined
>(($context) => {
  const item = database.getItem({
    key: {
      pk: {
        S: `Post|${$context.arguments.postId}`,
      },
      sk: {
        S: "Post",
      },
    },
  });

  if (item === undefined) {
    return undefined;
  }

  return deleteWorkflow({ input: { postId: $context.arguments.postId } });
}).addResolver(api, {
  typeName: "Mutation",
  fieldName: "deletePost",
});

export const getDeletionStatus = new AppsyncResolver<
  { executionArn: string },
  string | undefined
>(($context) => {
  const executionStatus = deleteWorkflow.describeExecution(
    $context.arguments.executionArn
  );

  return executionStatus.status;
}).addResolver(api, {
  typeName: "Query",
  fieldName: "getDeletionStatus",
});

export interface Post<PostID extends string = string> {
  pk: `Post|${PostID}`;
  sk: "Post";
  postId: PostID;
  title: string;
}

export interface Comment<
  PostID extends string = string,
  CommentID extends string = string
> {
  pk: `Post|${PostID}`;
  sk: `Comment|${CommentID}`;
  postId: PostID;
  commentId: CommentID;
  commentText: string;
  createdTime: string;
}

export interface CommentPage {
  nextToken?: string;
  comments: Comment[];
}

interface Notification {
  message: string;
}

interface TestDeleteEvent
  extends EventBusRuleInput<{ postId: string }, "Delete", "test"> {}

const sendNotification = new Function<Notification, void>(
  stack,
  "sendNotification",
  async (event) => {
    console.log("notification: ", event);
  }
);

const defaultBus = EventBus.default<TestDeleteEvent>(stack);

deleteWorkflow
  .onSucceeded(stack, "deleteSuccessfulEvent")
  .map((event) => ({
    message: `post deleted ${event.id} using ${deleteWorkflow.stateMachineName}`,
  }))
  .pipe(sendNotification);

defaultBus
  .when(stack, "testDelete", (event) => event.source === "test")
  .map((event) => event.detail)
  .pipe(deleteWorkflow);

customDeleteBus
  .when(
    stack,
    "Delete Message Rule",
    (event) => event["detail-type"] === "Delete-Message-Success"
  )
  // TODO: the when should narrow the type
  .map<Notification>((event) => ({
    message: `Messages deleted: ${(<MessageDeletedEvent>event).detail.count}`,
  }))
  .pipe(sendNotification);

customDeleteBus
  .when(
    stack,
    "Delete Post Rule",
    (event) => event["detail-type"] === "Delete-Post-Success"
  )
  // TODO: the when should narrow the type
  .map<Notification>((event) => ({
    message: `Post Deleted: ${(<PostDeletedEvent>event).detail.id}`,
  }))
  .pipe(sendNotification);

const busbusbus = new aws_events.EventBus(stack, "busbus");

new Function(stack, "testFunc", async (_something: string) => {
  console.log(customDeleteBus.eventBusArn);
  console.log(busbusbus.eventBusArn);
  console.log("huh?!?!?!??!!");
  console.log("strange");
});
