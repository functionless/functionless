# Programmable Infrastructure

Here at Functionless, we envision a world of "Programmable Infrastructure", where the boundaries between infrastructure configuration and runtime logic running in services like Lambda Functions, Step Functions, REST/GraphQL API Gateways, etc. are erased and replaced with a seamless, typesafe programming environment.

This step upwards in abstraction will enable new types of programming models for the cloud, for example Cloud Functions, Higher-Order Cloud Functions, Cloud Classes, Abstract Cloud Classes and Cloud Interfaces. These are the same primitives we enjoy in our favorite programming language, except lifted to a new level - the cloud.

So what does it mean to be "lifted to the cloud"? How is a Cloud Function different than an ordinary NodeJS Function?

## Cloud Function

In TypeScript, a `Function` is defined as taking in 0 or more `Args` and returning a `Result`. Nothing out of the ordinary here.

```ts
<Args extends any[], Result>(...args: Args) => Result;
```

A `Cloud Function` is exactly the same, except it has other data associated with it - which we call its `dependencies` and `closureState`.

```ts
{
  // each Function has an implicit set of dependencies - the APIs it will call at runtime
  dependencies: Dependency[];
  // state captured from the closure and serialized into the Function's bundle
  closureState: State;
} & <Args extends any[], Result>(...args: Args) => Result
```

### Dependencies

The `dependencies` are a list of all the service APIs the `Function` needs access to, for example - to call `GetItem` on a specific DynamoDB `Table`, or `Invoke` another `Cloud Function`. This information is extracted by statically analyzing the Function's code with the TypeScript compiler and by (TODO) walking the `closureState` at synthesis time.

Example: the below Function needs `DynamoDB::GetItem` access to the `Table`.

```ts
const table: Table = ??;

new Function(scope, id, async (input: { id: string; }) => {
  return $AWS.DynamoDB.GetItem({
    Table,
    Key: {
      id: {
        S: input.id
      }
    }
  });
});
```

### State

`State` is data captured by the `Function`'s closure and serialized directly into the JS bundle deployed to Lambda.

Static data can be serialized as JavaScript objects.

```ts
const data = { payload: "hello world" };

new Function(scope, id, async () => {
  // reference to data, serialize the object into the JS bundle
  return data;
});
```

Tokens are resolved during infrastructure deployment and are therefore plumbed through Environment Variables.

```ts
const table: Table = ...;

new Function(scope, id, async () => {
  // a reference to a Token - a value only available after deployment
  // this value is retrieved from an Environment Variable
  return table.resource.tableArn;
});
```

All of this is done transparently to the Function implementor.

## Higher Order Cloud Function

Now that we have defined a Cloud Function, we should naturally progress and define the Higher Order Cloud Function. According to wikipedia, a Higher Order Function is a function that does at least one of the following:

1. takes one or more functions as arguments (i.e. a procedural parameter, which is a parameter of a procedure that is itself a procedure),
2. returns a function as its result.

### Take one or more Function(s) as Arguments

There are two ways at looking at this:

1. a NodeJS Function (not a `Cloud Function`) that maps a `Cloud Function` over a list of data.

```ts
// more generally, this would be the `Cloud Functor`.
async function <Item>map(list: Item[], fn: Function<Item, string>) {
  return Promise.all(list.map(fn));
}
```

When calling this from within a `Cloud Function`, the `Lambda::Invoke` API dependency is detected statically.

```ts
const processVideo = new Function(
  scope,
  "ProcessVideo",
  async (video: Video) => {
    return expensiveComputation(video);
  }
);

new Function(scope, id, async (videos: Video[]) => {
  // call the `processVideo` Function for each video in the list
  return map(videos, processVideo);
});
```

2. A `Cloud Function` accepting a reference to another `Cloud Function` in the request payload at runtime.

```ts
new Function(
  std,
  "map",
  <Item>(request: { list: Item[]; fn: Function<Item, string> }) => {
    return Promise.all(request.list.map(request.fn));
  }
);
```

In this scenario, the `Cloud Function`, `"map"`, accepts a JSON payload containing two properties: `list` and `fn`. The `list` is ordinary JSON data, but the `fn` is a reference to a `Function` Construct. Obviously we cannot pass a `Function` Construct at runtime since they only exist during CDK synthesis, but we can pass the ARN of the Function as a JSON string.

```ts
{
  list: [1, 2, 3],
  fn: "arn:../processVideo"
}
```

The Functionless framework can then apply some magic to transform the ARN into an API client and pass it to the function body.

```ts
(request: { fn: Function<any, any> }) => {
  // that function is then seamlessly callable
  return request.fn();
};
```

This is great, but won't we be missing the IAM Policy Statements since the ARN is passed at runtime? Well, yes and no. Yes if you manually pass an arbitrary Function ARN, but if the call is initiated from within Functionless, then it can be captured as a dependency.

```ts
const processVideo = new Function(
  scope,
  "ProcessVideo",
  async (video: Video) => {
    return doProcess(video);
  }
);

const mapList = new Function(
  scope,
  "Process",
  async <In, Out>(request: {
    items: In[];
    process: Function<In, Out>;
  }): Promise<Out> => {
    return request.items.map(request.process);
  }
);

new AwsMethod({
  httpMethod: "POST",
  request: ($input) =>
    mapList({
      items: $input.data.items,
      // dependency for `mapList` to be able to call `processVideo` is captured here
      process: processVideo,
    }),
});
```

The direction of this dependency is the reverse of what we've typically supported in Functionless. Should we call it "transitive" dependencies or perhaps a "passed" dependency?

### Returns a Function as its Result

The second criteria for a higher-order function is returning a Function.

Again, there are two ways of thinking about this.

1. Returns a reference to a Function declared outside of the closure.

```ts
const processVideo = new Function(
  scope,
  "ProcessVideo",
  async (video: Video) => {
    return doProcess(video);
  }
);

new Function(scope, "ProcessVideo", async (video: Video) => {
  return processVideo;
});
```

2. Return a NodeJS `Function` created within the closure.

```ts
new Function(scope, "ProcessVideo", async (video: Video) => {
  // this function is serialized and returned as a JSON string
  return () => {
    return video;
  };
});
```

3. Return a `Cloud Function` created within the closure

This final case is the holy grail of this next level of abstraction - a self-provisioning runtime.

```ts
new Function(scope, "ProcessVideo", async (id: string) => {
  return new Function(scope, id, (video: Video) => {
    return processVideo({id, video});
  };
});
```

Perhaps by using the Pulumi Automation API, plain-old-shitty CloudFormation or maybe a new and exciting IaC platform like IaSQL, this Function would dynamically create a new Lambda Function with all of the request state captured inside.

Perhaps it could even create other resources like a `Table`.

```ts
new Function(scope, "ProcessVideo", async (id: string) => {
  const videoStore = new Table(scope, `store${id}`);

  return new Function(scope, id, (video: Video) => {
    await videoStore.putItem({
      item: video
    });
  };
});
```

Hold on, where have I seen this pattern before? Oh that's right, this is exactly what a PaaS is - an API that creates infrastructure on demand.

At this point, IaC is totally unified with application code.
