import { App, aws_dynamodb, Stack } from "aws-cdk-lib";
import { $util, AppsyncResolver, Table } from "functionless";
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

const tweetApi = new appsync.GraphqlApi(stack, "Api", {
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

const getPost = new AppsyncResolver<{ postId: string }, Post | undefined>(
  ($context) => {
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
  }
).addResolver(tweetApi, {
  typeName: "Query",
  fieldName: "getPost",
});

const comments = new AppsyncResolver<
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
}).addResolver(tweetApi, {
  typeName: "Post",
  fieldName: "comments",
});

const createPost = new AppsyncResolver<{title: string}, Post>($context => {
  const postId = $util.autoUlid();
  database.putItem({
    key: {
      pk: {
        S: `Post|${postId}`
      },
      sk: {
        S: $util.
      }
    }
  })

})
