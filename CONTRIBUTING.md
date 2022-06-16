## Running

functionless

> yarn install

> yarn watch

test-app

> cd test-app

> yarn install

> yarn watch

website

> cd website

> yarn start

### Testing

Required:
* Docker - `sudo dockerd`
* [Localstack](https://docs.localstack.cloud/get-started/#localstack-cli)

`yarn test` - boots up localstack, runs all tests, stops localstack
`yarn test:fast` - runs all non-localstack tests
`yarn watch` - watches all tests
`vs-code jest plugin` - use the vs code jest plugin to run individual tests and debug
 
When using any method that does not invode `yarn test`, `./script/localstack` may be used to start localstack (and boostrap CDK) manually. 

## Additions

### Error Codes

Functionless maintains well documented and linked error codes for compiler and synth errors.

#### Error Code Strategy

https://github.com/functionless/functionless/issues/182#issuecomment-1155683168

TLDR; keep it simple and follow Typescript/React

1.  Error Codes - Start at 10000
2.  Error Message/Title
3.  Type - Error, Warning, Info, Deprecated
  
All errors should be functionless(code) - If the error pertains to a specific service, the message should include that. If an error code is no longer relevant, we do not re-use the code, change the type to deprecated and stop returning the error. At major version bumps, we will clean up the deprecated errors and re-evaluate.

#### Add a new Error Code

1. Add a new exported constant in the `src/error_codes.ts` file.

```ts
/**
 * Error thrown when doing something bad.
 * \`\`\`ts
 * some code showing valid and invalid cases
 * \`\`\
 * 
 * More context
 * 
 * Work arounds
 **/
export const My_New_Error: ErrorCode {
	type: ErrorType.ERROR,
	messageText: "my new error",
	code: 199999
} 
```

**type** - 
* ERROR - Should fail validation, cli, will fail during compile, synth, or runtime
* WARN - Should show warning during validation, cli, may fail during compile, synth, or runtime
* INFO - Show info during validate. Will not fail during compile, synth, or runtime.
* DEPRECATED - Errors or warnings that are no longer applicable. (We unblocked the use case, for example).

**Message Text** - A short, single sentence with no punctuation describing what the error is. The title of the error on the Error Code page. The anchor created on the url. The error printed by default with a `SynthError`.

**Code** - Unique, numberic code, starting at 10000. Will be displayed in the IDE and website to uniquely identify the error even if the message text changes.

**TSDocs** - Above the ErrorCode, TS docs should be used to describe the error in detail. This can contain markdown, which will be turned into markdown in the docs. Include code examples of what not to do is possible, go into detail on the issue, and explain any workarounds or escape hatching avaliable to bypass the issue.

## Troubleshooting

### 

[Error 101 - Function not compiled]https://functionless.org/docs/error-codes#function-not-compiled-by-functionless-plugin

The compiler plugin isn't patched or working.

1. `npx ts-patch install -s`
	1. `npx ts-patch check` can be used to this needs to be done. At least 1 item should be marked as Installed
2. Check your typescript versions and match sure they all match through the code base.