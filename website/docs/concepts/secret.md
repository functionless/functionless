---
title: Secret
sidebar_position: 5
---

# Secret

A `Secret` Resource stores sensitive data so that it can be securely distributed to your application code, e.g. in a Lambda Function.

## Create a Secret

```ts
const secret = new Secret(scope, id);
```

## Statically Typed Secret Data

We recommend always defining an `interface` for the data stored in the Secret. This has the benefit of ensuring all writers and readers of the Secret use the data appropriately.

```ts
interface UserPass {
  username: string;
  password: string;
}

const userPass = new Secret<UserPass>(scope, "UserPass");
```

## Get Secret Value

```ts
const userPass = new Secret<UserPass>(scope, "UserPass");

new Function(scope, "Foo", async () => {
  const creds = await userPass.getSecretValue()?.SecretValue;
});
```

## Put Secret Value
