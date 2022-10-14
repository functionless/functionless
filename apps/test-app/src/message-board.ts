import * as path from "path";
import * as appsync from "@aws-cdk/aws-appsync-alpha";
import {
  App,
  aws_dynamodb,
  RemovalPolicy,
  Stack,
  aws_events,
  Duration,
} from "aws-cdk-lib";
import { Event } from "@functionless/aws-events";
import { EventBus } from "@functionless/aws-events-constructs";
import { Table } from "@functionless/aws-dynamodb-constructs";
import {
  $util,
  AppsyncContext,
  AppsyncField,
  AppsyncResolver,
} from "@functionless/aws-appsync-constructs";
import { Function } from "@functionless/aws-lambda-constructs";
import {
  $SFN,
  ExpressStepFunction,
  StepFunction,
} from "@functionless/aws-stepfunctions-constructs";
import { $AWS } from "@functionless/aws-sdk";

export const app = new App();
export const stack = new Stack(app, "message-board");

const database = Table.fromTable<Post | Comment, "pk", "sk">(
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

new AppsyncResolver<{ postId: string }, Post | undefined>(
  stack,
  "getPost",
  {
    api,
    typeName: "Query",
    fieldName: "getPost",
  },
  ($context) => {
    return database.appsync.get({
      key: {
        pk: {
          S: `Post|${$context.arguments.postId}`,
        },
        sk: {
          S: "Post",
        },
      },
    });
  }
);

new AppsyncResolver<
  { nextToken?: string; limit?: number },
  CommentPage,
  Omit<Post, "comments">
>(
  stack,
  "comments",
  {
    api,
    typeName: "Post",
    fieldName: "comments",
  },
  async ($context) => {
    const response = await database.appsync.query({
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
  }
);

export const createPost = new AppsyncResolver<{ title: string }, Post>(
  stack,
  "createPost",
  {
    api,
    typeName: "Mutation",
    fieldName: "createPost",
  },
  async ($context) => {
    const postId = $util.autoUlid();
    const post = await database.appsync.put({
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
);

export const validateComment = new Function<
  { commentText: string },
  "ok" | "bad"
>(stack, "ValidateComment", async () => {
  return "ok" as const;
});

export const commentValidationWorkflow = new StepFunction<
  { postId: string; commentId: string; commentText: string },
  void
>(stack, "CommentValidationWorkflow", async (input) => {
  const status = await validateComment({ commentText: input.commentText });
  if (status === "bad") {
    await database.attributes.delete({
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
>(
  stack,
  "addComment",
  {
    api,
    typeName: "Mutation",
    fieldName: "addComment",
  },
  async ($context) => {
    const commentId = $util.autoUlid();
    const comment = await database.appsync.put({
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
    await commentValidationWorkflow({ input: comment });

    return comment;
  }
);

interface MessageDeletedEvent
  extends Event<
    { count: number },
    "Delete-Message-Success",
    "MessageDeleter"
  > {}

interface PostDeletedEvent
  extends Event<{ id: string }, "Delete-Post-Success", "MessageDeleter"> {}

const customDeleteBus = new EventBus<MessageDeletedEvent | PostDeletedEvent>(
  stack,
  "deleteBus"
);

const deleteWorkflow = new StepFunction<{ postId: string }, void>(
  stack,
  "DeletePostWorkflow",
  async (input) => {
    while (true) {
      try {
        const comments = await database.query({
          KeyConditionExpression: `pk = :pk`,
          ExpressionAttributeValues: {
            ":pk": `Post|${input.postId}`,
          },
        });

        if (comments.Items?.[0] !== undefined) {
          await $SFN.forEach(comments.Items, async (comment) =>
            database.delete({
              Key: {
                pk: comment.pk,
                sk: comment.sk,
              },
            })
          );
        } else {
          await database.delete({
            Key: {
              pk: `Post|${input.postId}`,
              sk: "Post",
            },
          });

          await customDeleteBus.putEvents({
            "detail-type": "Delete-Post-Success",
            source: "MessageDeleter",
            detail: {
              id: input.postId,
            },
          });
        }
      } catch {
        $SFN.waitFor(10);
      }
    }
  }
);

export const deletePost: AppsyncResolver<
  { postId: string },
  AWS.StepFunctions.StartExecutionOutput | undefined
> = new AppsyncResolver(
  stack,
  "deletePost",
  {
    api,
    typeName: "Mutation",
    fieldName: "deletePost",
  },
  async ($context) => {
    const item = await database.appsync.get({
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
      $util.log.info("Item was undefined");
      return undefined;
    }

    return deleteWorkflow({
      input: {
        postId: $context.arguments.postId,
      },
    });
  }
);

export const getDeletionStatus = new AppsyncResolver<
  { executionArn: string },
  string | undefined
>(
  stack,
  "getDeletionStatus",
  {
    api,
    typeName: "Query",
    fieldName: "getDeletionStatus",
  },
  async ($context) => {
    const executionStatus = await deleteWorkflow.describeExecution(
      $context.arguments.executionArn
    );

    return executionStatus.status;
  }
);

export interface CommentPage {
  nextToken?: string;
  comments: Comment[];
}

interface Notification {
  message: string;
}

interface TestDeleteEvent extends Event<{ postId: string }, "Delete", "test"> {}

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
    message: `post deleted ${event.id} using ${deleteWorkflow.resource.stateMachineName}`,
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
  .map(
    (event) =>
      <Notification>{
        message: `Messages deleted: ${
          (<MessageDeletedEvent>event).detail.count
        }`,
      }
  )
  .pipe(sendNotification);

customDeleteBus
  .when(
    stack,
    "Delete Post Rule",
    (event) => event["detail-type"] === "Delete-Post-Success"
  )
  .map(
    (event) =>
      <Notification>{
        message: `Post Deleted: ${(<PostDeletedEvent>event).detail.id}`,
      }
  )
  .pipe(sendNotification);

/**
 * Native Function test
 */

new aws_events.EventBus(stack, "busbus");

const b = { bus: customDeleteBus };

const func = new Function<undefined, string>(stack, "testFunc2", async () => {
  return "hi";
});

const exprSfn = new ExpressStepFunction(stack, "exp", () => {
  return "woo";
});

new Function(
  stack,
  "testFunc",
  {
    timeout: Duration.minutes(1),
  },
  async () => {
    const result = func();
    console.log(`function result: ${result}`);
    await customDeleteBus.putEvents({
      "detail-type": "Delete-Post-Success",
      source: "MessageDeleter",
      detail: {
        id: "from the test method!!",
      },
    });
    const result2 = await $AWS.EventBridge.putEvents({
      Entries: [
        {
          EventBusName: customDeleteBus.eventBusArn,
          Source: "MessageDeleter",
          Detail: JSON.stringify({
            id: "from the sdk put event method!",
          }),
          DetailType: "Delete-Post-Success",
        },
      ],
    });
    console.log(`bus: ${JSON.stringify(result2)}`);
    const exc = await deleteWorkflow({
      input: {
        postId: "something",
      },
    });
    const { bus } = b;
    await bus.putEvents({
      "detail-type": "Delete-Message-Success",
      detail: { count: 0 },
      source: "MessageDeleter",
    });
    console.log(deleteWorkflow.describeExecution(exc.executionArn));
    await database.put({
      Item: {
        pk: "Post|1",
        sk: "Post",
        postId: "1",
        title: "myPost",
      },
    });
    const item = await database.get({
      ConsistentRead: true,
      Key: { pk: "Post|1" as any, sk: "Post" },
    });
    console.log(item.Item?.pk);
    return exprSfn({});
    // return "hi";
  }
);

/**
 * GraphQL created with Code-First
 */
const api2 = new appsync.GraphqlApi(stack, "Api2", {
  name: "MessageReader",
});

/*
  type Query {
    getPost(postId: string!): Post
  }

 type Post {
  postId: ID!
  title: String!
  comments(nextToken: String, limit: Int): CommentPage
 }

 type CommentPage {
  nextToken: String
  comments: [Comment]!
 }

 type Comment {
  postId: ID!
  commentId: ID!
  commentText: String!
  createdTime: String!
 }
 */

const post = api2.addType(
  new appsync.ObjectType("Post", {
    definition: {
      postId: appsync.GraphqlType.id({
        isRequired: true,
      }),
      title: appsync.GraphqlType.string({
        isRequired: true,
      }),
    },
  })
);

const comment = api2.addType(
  new appsync.ObjectType("Comment", {
    definition: {
      postId: appsync.GraphqlType.id({
        isRequired: true,
      }),
      commentId: appsync.GraphqlType.id({
        isRequired: true,
      }),
      commentText: appsync.GraphqlType.string({
        isRequired: true,
      }),
      createdTime: appsync.GraphqlType.string({
        isRequired: true,
      }),
    },
  })
);

const commentPage = api2.addType(
  new appsync.ObjectType("CommentPage", {
    definition: {
      nextToken: appsync.GraphqlType.string(),
      comments: appsync.GraphqlType.intermediate({
        intermediateType: comment,
        isRequiredList: true,
      }),
    },
  })
);

post.addField({
  fieldName: "comments",
  field: new AppsyncField(
    {
      api: api2,
      returnType: commentPage.attribute(),
      args: {
        nextToken: appsync.GraphqlType.string(),
        limit: appsync.GraphqlType.int(),
      },
    },
    async (
      $context: AppsyncContext<
        { nextToken?: string; limit?: number },
        Omit<Post, "comments">
      >
    ): Promise<CommentPage> => {
      const response = await database.appsync.query({
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
    }
  ),
});

api2.addQuery(
  "getPost",
  new AppsyncField(
    {
      api: api2,
      returnType: post.attribute(),
      args: {
        postId: appsync.GraphqlType.string({ isRequired: true }),
      },
    },
    ($context) => {
      return database.appsync.get({
        key: {
          pk: {
            S: `Post|${$context.arguments.postId}`,
          },
          sk: {
            S: "Post",
          },
        },
      });
    }
  )
);

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
