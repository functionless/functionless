<div align="center">
  <a href="https://functionless.org">
    <img src="./logo.svg" />
  </a>
  <br />
  <h1>Functionless</h1>
  <h2>Code-first, Cloud-native</h2>
  <h3>
  Build cloud applications with batteries-included<br /><b>Components</b> and easy-to-follow <b>Conventions</b>.
  </h3>
  <a href="https://badge.fury.io/js/functionless.svg">
    <img src="https://badge.fury.io/js/functionless.svg">
  </a>
  <a href="https://discord.gg/VRqHbjrbfC">
    <img src="https://img.shields.io/discord/985291961885949973?label=discord">
  </a>
</div>

**Functionless** is a compiler plugin and Construct library that enhances your cloud programming experience with TypeScript and the AWS Cloud Development Kit (CDK). Tedious and error-prone configurations are inferred directly from your application logic, including IAM Policies, environment variables and proprietary domain specific languages such as Amazon States Language, Velocity Templates and Event Bridge Pattern Documents. This makes it simple, easy and fun(!) to configure AWS's powerful services without learning a new language or abstraction. Functionless always ensures that your IAM Policies are minimally permissive and that there is no missing plumbing code, so you can be confident that when your code compiles - then it also deploys, runs and is secure!

# Documentation

- [Functionless Documentation](https://functionless.org)

# Example Developer Experience

The below snippet shows how easy it is to configure AWS Appsync, Lambda, Step Functions and DynamoDB.

Functionless parses the TypeScript code and converts it to IAM Policies, Amazon States Language, Apache Velocity Templates and a CloudFormation configuration - saving you from writing all of that boilerplate!

```ts
const postTable = new functionless.Table<Post, "postId">(this, "PostTable", {
  partitionKey: {
    name: "postId",
    type: aws_dynamodb.AttributeType.String,
  },
  billingMode: aws_dynamodb.BillingMode.PAY_PER_REQUEST,
});

// Query.addPost AppSync Resolver
const addPost = new functionless.AppsyncResolver<
  { title: string; text: string },
  Post
>(($context) => {
  const post = postDatabase.get({
    key: $util.toDynamoDB($util.autoUuid()),
    title: $util.toDynamoDB($context.arguments.title),
    text: $util.toDynamoDB($context.arguments.text),
  });

  // start execution of a long-running workflow to validate the Post
  validatePostWorkflow(post);

  return post;
});

// a Lambda Function which can validate the contents of a Post
const validatePost = new Function(this, "ValidatePost", async (post: Post) => {
  if (post.title.includes("Functionless")) {
    return "Cool";
  } else {
    return "Not Cool";
  }
});

// Step Function workflow that validates the contents of a Post and deletes it if bad
const validatePostWorkflow = new StepFunction(
  this,
  "ValidatePostWorkflow",
  async (post: Post) => {
    const validationResult = await validatePost(post);
    if (validationResult.status === "Not Cool") {
      await $AWS.DynamoDB.DeleteItem({
        Table: postTable,
        Key: {
          postId: {
            S: post.postId,
          },
        },
      });
    }
  }
);
```
