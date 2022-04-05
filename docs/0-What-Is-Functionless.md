# Functionless

The term, Functionless, refers to the concept of managed integrations between services. Functionless services are configured declaratively with JSON or some other language such as Apache Velocity Templates, which relieves you from the burden of operating the software. For example: AWS Step Functions is a "functionless" service because it is configured solely with JSON that is then operated by AWS - there's no runtime to worry about, network connections, clients, etc. It "just works" (provided your configuration is correct).

These integrations have many advantages over using Lambda Functions, including:

1. **lower latency** - there is no cold start, so a service-to-service integration will feel "snappy" when compared to a Lambda Function.
2. **lower cost** - there's no intermediate Lambda Invocation when AppSync calls DynamoDB directly.
3. **higher scalability** - the handlers are not subject to Lambda's concurrent invocation limits and are running on dedicated Amazon servers.
4. **no operational maintenance** - such as upgrading dependencies, patching security vulnerabilities, etc. - theoretically, once the configuration is confirmed to be correct, it then becomes entirely AWS's responsibility to ensure the code is running optimally.

The downsides of these integrations are their dependence on Domain Specific Languages (DSL) such as Apache Velocity Templates or Amazon States Language JSON. These DSLs are difficult to work with since they lack the type-safety and expressiveness of TypeScript.

Functionless makes it easy by converting beautiful, type-safe TypeScript code directly into these configurations. To get started:

- [Getting Started]

# Example

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
