# Functionless Tutorial

In this tutorial, we will build a Message Board application with a GraphQL API hosted by AWS AppSync. It will allow users to create and read Post in an AWS DynamoDB Table. To introduce more of Functionless's primitives, we'll implement a long-running workflow with an AWS Step Function to delete data from our DynamoDB Table

## Create a DynamoDB Table

Let's start by creating a DynamoDB Table to store Posts on our message board. First, make sure you have a working CDK application:

```ts
import { App, Stack } from "aws-cdk-lib";

const app = new App();
const stack = new Stack(app, "message-board");
```

Next, define an interface, `Post`, to represent the structure of the data stored in the DynamoDB Table.

```ts
export interface Post<PostID extends string> {
  pk: `Post|${PostID}`;
  sk: string;
  postId: PostID;
  content: string;
}
```

You'll notice the weird generic, `PostID extends string`, and its use in the `pk` field. We are doing this because of single table design. Don't be put off by this initially - it will become more clear why this is important later and I promise you'll learn to love it.

Now that we have our `Post` type, let's create an `aws_dynamodb.Table` to store the data.

```ts
import { aws_dynamodb } from "aws-cdk-lib";
import * as functionless from "functionless";

const postDB = new functionless.Table<Post, "pk", "sk">(
  new aws_dynamodb.Table(stack, "PostDB", {
    billingMode: aws_dynamodb.BillingMode.PAY_PER_REQUEST,
    partitionKey: {
      name: "pk",
      type: aws_dynamodb.AttributeType.String,
    },
    sortKey: {
      name: "sk",
      type: aws_dynamodb.AttributeType.String,
    },
  })
);
```

Let's break this down a bit. Notice that there is a `functionless.Table` and an `aws_dynamodb.Table` - what's this all about?

- `aws_dynamodb.Table` is AWS's official CDK Construct for creating a DynamoDB Table. It is what actually provisions the Resource to the cloud and it's where you can configure various properties for the behavior of the Table, such as the Billing Mode.
- `functionless.Table` wraps the `aws_dynamodb.Table` to add integration methods that can be called from within your Functionless application. Without this, you cannot interact with your Table with Functionless.
- `functionless.Table` has three type arguments, `Table<Post, "pk", "sk">`. `Post` defines the type of the data in the DynamoDB Table and the others, `"pk"` and `"sk"`, are the property names of the Table's Partition and Sort Keys, respectively. These types enable auto completion and type checking when using Functionless's DynamoDB APIs.

## Define a GraphQL Schema

Let's move on to building the GraphQL API - we'll use our first "functionless integration" there.

Before we can do anything useful, we need a simple GraphQL schema with our `Post` type, a `createPost` mutation and a `getPost` query. Let's get that out of the way:

```graphql
// message-board.gql

type Query {
  getPost(postId: ID!): Post
}

type Mutation {
  createPost(content: String!): Post!
}

type Post {
  postId: ID!
  content: String!
  createdTime: String!
}
```

Now, in AWS, the best service for hosting a GraphQL service is AWS AppSync. It offers a managed service so you don't have to worry about load balancing, persistent connections, etc. To get set up easily, create a GraphQL API with `aws-appsync-alpha`:

```ts
import * as appsync from "@aws-cdk/aws-appsync-alpha";

// import your graphql schema
const schema = new appsync.Schema({
  filePath: path.join(__dirname, "message-board.gql"),
});

// create the GraphQL API endpoint
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
```

Now that we have created our GraphQL Endpoint, it's time to implement the resolvers for `createPost` and `getPost`. We'll start with `createPost`, since we can only get posts once we can create them!

Import `AppsyncResolver` from the `functionless` library:

```ts
import { AppsyncResolver } from "functionless";
```

This class is how we create Resolver Functions for Appsync. These Resolver Functions configure AppSync to transform requests, integrate with backend services and then transform and return responses. An Appsync Resolver is configured with CloudFormation and Apache Velocity Templates, but Functionless makes this easy by transforming your TypeScript code into those configurations so you don't have to learn them (yuck!).

To implement `createPost`, instantiate a new `AppsyncResolver` and implement its logic with a function (yes, it's that simple):

```ts
export const createPost = new AppsyncResolver<{ title: string }, Post>(
  ($context) => {
    const postId = $util.autoUlid();
    return postDB.putItem({
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
  }
).addResolver(api, {
  typeName: "Mutation",
  fieldName: "createPost",
});
```

Let's break this down into its key components, starting with the `AppsyncResolver` signature:

```ts
export const createPost = new AppsyncResolver<{ content: string }, Post>(
  ($context) => {
    // etc.
  }
);
```

The type argument, `{content: string}`, represents the GraphQL function's arguments, and `Post` (the other type argument) is the return type. It's simply the function signature.

```ts
type Mutation {
  createPost(content: String!): Post!
}
```

The `$context` variable represents AppSync's [`$context`](https://docs.aws.amazon.com/appsync/latest/devguide/resolver-context-reference.html) variable available in Apache Velocity Templates. It contains (among many other things) a reference to the GraphQL arguments, e.g. `$context.arguments.content`.

The function body is a simple one-step resolver that calls the `putItem` API on the `postDB` and returns the result.

```ts
const postId = $util.autoUlid();

return postDB.putItem({
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
    content: {
      S: $context.arguments.content,
    },
  },
});
```

This should feel similar to a Lambda Function, but with some nuances.

- Notice that we generate a ULID for the `postId` with the utility, `$util.autoUlid()`. This refers to [Appsync's Utility helpers in $util](https://docs.aws.amazon.com/appsync/latest/devguide/utility-helpers-in-util.html). Because an AppsyncResolver is converted into Apache Velocity Templates and CloudFormation, the ordinary way of generating an ID (e.g. by using the `uuid` module) does not work - you must instead use the Appsync service's built-in utility functions.
- The `content` GraphQL argument is available as `$context.arguments.content`. This refers to the [`$context` primitive built in to the Appsync service](https://docs.aws.amazon.com/appsync/latest/devguide/resolver-context-reference.html).
- The reason we can simply return the result of `putItem` is because the data is automatically marshalled from DynamoDB's JSON format to simple JSON. Also, remember how we declared our Table - `Table<Person, "pk", "sk">`? This means the return type of `putItem` is a `Person` - so everything type checks correctly. Pretty neat, right? Functionless is all programming the cloud, just like you would your local machine!

Finally, the `addResolver` function adds this Appsync Resolver logic to our Message Board GraphQL API. Calling this function will generate all of the Apache Velocity Templates and configure a Resolver Pipeline for the `createPost` field on the `Mutation` type in our GraphQL API.

```ts
export const createPost = new AppsyncResolver<
  { title: string },
  Post
>().addResolver(api, {
// (omitted)
  typeName: "Mutation",
  fieldName: "createPost",
});
```

Now that we know how to write AppsyncResolvers, implementing getPost should be straight-forward - maybe you want to give that a try?

## Express Step Function

Next
