---
title: Secret
sidebar_position: 5
---

# Secret

A `Secret` Resource stores sensitive data so that it can be securely distributed to your application code, e.g. in a Lambda Function.

There are three types of Secrets:

1. `TextSecret`
2. `BinarySecret`
3. `JsonSecret`

## TextSecret

A `TextSecret` stores the secret encoded as UTF-8 text.

```ts
const secret = new TextSecret(scope, id);
```

## Get Secret Value

The value of the Secret can be obtained by calling `getSecretValue`.

```ts
const apiKeySecret = new TextSecret(scope, "APIKey");

new Function(scope, "Foo", async () => {
  const apiKey = (await apiKey.getSecretValue()).SecretValue;

  // use within your application
});
```

## Put Secret Value

The value of the Secret can be updated by calling `putSecretValue`.

```ts
const apiKeySecret = new TextSecret(scope, "APIKey");

new Function(scope, "Foo", async () => {
  await apiKey.putSecretValue({
    SecretValue: "new api key",
  });
});
```

## BinarySecret

A `BinarySecret` stores the secret as raw Binary data using NodeJS's `Buffer` type.

```ts
const apiKeySecret = new BinarySecret(scope, "APIKey");
```

The interface is the same as TextSecret, except that the secret value is wrapped in a `Buffer`.

## JsonSecret

The `JsonSecret` provides a type-safe interface over a Secret and automatic serialization to and from JSON. It is recommended to use JsonSecret when storing structured Secret data.

```ts
interface UserPass {
  username: string;
  password: string;
}

const userPass = new JsonSecret<UserPass>(scope, "UserPass");

new Function(scope, "Foo", async () => {
  const { username, password } = (await userPass.getSecretValue()).SecretValue;

  await userPass.putSecretValue({
    // type-checked SecretValue
    SecretValue: {
      username,
      password,
    },
  });
});
```

## Initializing the Secret Value

:::warning
AWS will throw a ResourceNotFoundException if there is no secret value stored in the secret.

> An error occurred (ResourceNotFoundException) when calling the GetSecretValue operation: Secrets Manager can't find the specified secret value for staging label: AWSCURRENT

If you encounter this problem, be sure to upload an initial version of the Secret. This can be achieved with the CDK's [`SecretValue`](https://docs.aws.amazon.com/cdk/api/v1/docs/@aws-cdk_core.SecretValue.html) class.

```ts
const secret = new TextSecret(scope, id, {
  secretStringValue: SecretValue.ssmSecure("<parameter name>"),
});
```

This applies to all Secret types - TextSecret, BinarySecret, JsonSecret
:::
