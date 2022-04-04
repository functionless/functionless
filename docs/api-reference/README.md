functionless / [Exports](modules.md)

# Functionless `λ<`

[![npm version](https://badge.fury.io/js/functionless.svg)](https://badge.fury.io/js/functionless)

**Functionless** is a TypeScript plugin that transforms TypeScript code into Service-to-Service (aka. "functionless") integrations, such as AWS AppSync [Resolvers](https://docs.aws.amazon.com/appsync/latest/devguide/configuring-resolvers.html) and [Velocity Templates](https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-programming-guide.html), or [Amazon States Language](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-amazon-states-language.html) for AWS Step Functions.

For example, the below function creates an Appsync Resolver Pipeline with two stages:

1. Put an item into the `postTable` DynamoDB Table
2. Trigger a long-running Step Function workflow to validate the contents

Functionless parses the TypeScript code and converts it to Amazon States Language, Apache Velocity Templates and a CloudFormation configuration, saving you from writing all of that boilerplate.

```ts
const postTable = new Table<Post, "postId">(new aws_dynamodb.Table(this, "PostTable", { .. }));

// a Lambda Function which can validate the contents of a Post
const validatePost = new Function<Post, "Cool" | "Not Cool">(
  new aws_lambda.Function(this, "Validate", { .. })
);

// Query.addPost AppSync Resolver
const addPost = new AppsyncResolver<{ title: string, text: string }, Post>(($context) => {
  const post = postDatabase.get({
    key: $util.toDynamoDB($util.autoUuid()),
    title: $util.toDynamoDB($context.arguments.title),
    text: $util.toDynamoDB($context.arguments.text),
  });

  // start execution of a long-running workflow to validate the Post
  validatePostWorkflow(post);

  return post;
});

// Step Function workflow that validates the contents of a Post and deletes it if bad
const validatePostWorkflow = new StepFunction(this, "ValidatePostWorkflow", (post: Post) => {
  // run some computation, maybe it's slow, so best to put in a StepFunction
  const validationResult = validatePost(post);
  if (validationResult.status === "Not Cool") {
    // delete bad posts
    $AWS.DynamoDB.DeleteItem({
      TableName: postTable,
      Key: {
        postId: {
          S: post.postId
        }
      }
    });
  }
});
```
