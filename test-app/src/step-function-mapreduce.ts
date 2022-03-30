import { App, aws_dynamodb, Stack } from "aws-cdk-lib";
import {
  $AWS,
  $SFN,
  $util,
  AppsyncResolver,
  StepFunction,
  Table,
} from "functionless";
import * as appsync from "@aws-cdk/aws-appsync-alpha";
import path from "path";

export const app = new App();
export const stack = new Stack(app, "StepFunctionMapReduce");

interface Post<PostID extends string = string> {
  pk: `Post|${PostID}`;
  sk: "";
  postId: PostID;
  title: string;
}

interface Comment<
  PostID extends string = string,
  CommentID extends string = string
> {
  pk: `Post|${PostID}`;
  sk: `Comment|${CommentID}`;
  postId: PostID;
  commentId: CommentID;
  createdTime: string;
  commentText: string;
}

interface CommentPage {
  nextToken?: string;
  comments: Comment[];
}

const database = new Table<Post | Comment, "pk", "sk">(
  new aws_dynamodb.Table(stack, "MessageBoard", {
    partitionKey: {
      name: "pk",
      type: aws_dynamodb.AttributeType.STRING,
    },
    sortKey: {
      name: "sk",
      type: aws_dynamodb.AttributeType.STRING,
    },
    billingMode: aws_dynamodb.BillingMode.PAY_PER_REQUEST,
  })
);

const schema = new appsync.Schema({
  filePath: path.join(__dirname, "..", "message-board.gql"),
});

const api = new appsync.GraphqlApi(stack, "Api", {
  name: "demo",
  schema,
  authorizationConfig: {
    defaultAuthorization: {
      authorizationType: appsync.AuthorizationType.IAM,
    },
  },
  xrayEnabled: true,
  logConfig: {
    fieldLogLevel: appsync.FieldLogLevel.ALL,
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
        S: "",
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
      expression: `pk = :pk`,
      expressionValues: {
        ":pk": {
          S: $context.source.pk,
        },
      },
    },
    nextToken: $context.arguments.nextToken,
    limit: $context.arguments.limit,
  });

  if (response.items) {
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
          S: "",
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

export const addComment = new AppsyncResolver<
  { postId: string; commentText: string },
  Comment
>(($context) => {
  const commentId = $util.autoUlid();
  return database.putItem({
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
}).addResolver(api, {
  typeName: "Mutation",
  fieldName: "addComment",
});

export const deleteWorkflow = new StepFunction(
  stack,
  "DeletePostWorkflow",
  (postId: string) => {
    const state = {
      attemptsLeft: 10,
    };
    while (state.attemptsLeft > 0) {
      try {
        const comments = $AWS.DynamoDB.GetItem({
          TableName: database,
          Key: {
            pk: {
              S: `Post|${postId}`,
            },
            sk: {
              S: "",
            },
          },
        });

        $AWS.DynamoDB.DeleteItem({
          TableName: database,
          Key: {
            pk: {
              S: `Post|${postId}`,
            },
            sk: {
              S: "",
            },
          },
        });

        return "success";
      } catch {
        $SFN.waitFor(60);
      }
    }
  }
);

export const deletePost = new AppsyncResolver<{ postId: string }, Comment>(
  ($context) => {
    const commentId = $util.autoUlid();
    return database.putItem({
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
  }
).addResolver(api, {
  typeName: "Mutation",
  fieldName: "addComment",
});
