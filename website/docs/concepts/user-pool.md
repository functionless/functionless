---
title: User Pool
sidebar_position: 5.5
---

# User Pool

The `UserPool` Resource provides an API for managing Users, including sign-up, sign-in and access control.

## Create a new User Pool

```ts
const userPool = new UserPool(stack, "UserPool");
```

## Import an existing UserPool from the AWS CDK

```ts
import { aws_cognito } from "aws-cdk-lib";

// create a CDK UserPool
const userPoolConstruct = new aws_cognito.UserPool(stack, "UserPool");

// then, wrap the CDK UserPool
const userPool = UserPool.from(userPoolConstruct);
```

## Customize with a Lambda Function Trigger

A User Pool exposes "Triggers" that can be configured to call a Lambda [Function](./function/index.md) during a customer workflow, for example when signing up or authenticating.

Available Triggers include:

- [Create Auth Challenge](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-create-auth-challenge.html)
- [Custom Message](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-custom-message.html)
- [Define Auth Challenge](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-define-auth-challenge.html)
- [Post Authentication](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-post-authentication.html)
- [Post Confirmation](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-post-confirmation.html)
- [Pre Authentication](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-authentication.html)
- [Pre Sign Up](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-sign-up.html)
- [Pre Token Generation](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-token-generation.html)
- [Migrate User](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-migrate-user.html)
- [Verify Auth Challenge Response](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-verify-auth-challenge-response.html)
- [Custom Email Sender](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-custom-email-sender.html)
- [Custom SMS Sender](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-custom-sms-sender.html)

There are three ways to configure a Trigger:

1. pass a [Function](./function/index.md) to the `lambdaTriggers` property when instantiating the `UserPool`.

```ts
// option 1 - in-line the Function
const userPool = new UserPool(stack, "UserPool", {
  lambdaTriggers: {
    createAuthChallenge: new Function(
      stack,
      "CreateAuthChallenge",
      async (event) => {
        // implement logic for the CreateAuthChallenge lifecycle event
        return event;
      }
    ),
  },
});
```

2. Call the specific `userPool.onXXX` method:

```ts
userPool.onCreateAuthChallenge(
  new Function(stack, "CreateAuthChallenge", async (event) => {
    // implement logic for the CreateAuthChallenge lifecycle event
    return event;
  })
);
```

3. Call `userPool.on`.

```ts
// use the string name of the trigger name
userPool.on(
  "createAuthChallenge",
  new Function(stack, "CreateAuthChallenge", async (event) => {
    // implement logic for the CreateAuthChallenge lifecycle event
    return event;
  })
);

// or: use the AWS CDK's underlying UserPoolOperation type.
userPool.on(
  aws_cognito.CREATE_AUTH_CHALLENGE,
  new Function(
    stack,
    "CreateAuthChallenge",
    async (event: CreateAuthChallengeTriggerEvent) => {
      // implement logic for the CreateAuthChallenge lifecycle event
      return event;
    }
  )
);
```

:::warning
If using the UserPoolOperation, the type of the `event` can not be inferred, so you must explicitly annotate the `event` parameter.

```ts
async (event: CreateAuthChallengeTriggerEvent) => {
  // implement logic for the CreateAuthChallenge lifecycle event
  return event;
};
```

:::
