import { aws_cognito, Stack } from "aws-cdk-lib";
import { CreateAuthChallengeTriggerEvent } from "aws-lambda";
import "jest";
import { Function, UserPool } from "../src";

test("create user pool with triggers", async () => {
  const stack = new Stack();

  new UserPool(stack, "UserPool", {
    lambdaTriggers: {
      createAuthChallenge: new Function(
        stack,
        "CreateAuthChallenge",
        async (event) => {
          return event;
        }
      ),
    },
  });

  (function () {
    new UserPool(stack, "InvalidUserPool", {
      lambdaTriggers: {
        // @ts-expect-error - does not return the right type
        createAuthChallenge: new Function(
          stack,
          "CreateAuthChallenge",
          async (_event) => {}
        ),
      },
    });
  });
});

test("add a trigger to a user pool using on(<string>)", () => {
  const stack = new Stack();

  const pool = new UserPool(stack, "UserPool");

  pool.on(
    "createAuthChallenge",
    new Function(stack, "CreateAuthChallenge", async (event) => {
      return event;
    })
  );

  (function () {
    pool.on(
      "createAuthChallenge",
      // @ts-expect-error - does not return the right type
      new Function(stack, "InvalidCreateAuthChallenge", async (event) => {})
    );
  });
});

test("add a trigger to a user pool using on(aws_cognito.UserPoolOperation)", () => {
  const stack = new Stack();

  const pool = new UserPool(stack, "UserPool");

  pool.on(
    aws_cognito.UserPoolOperation.CREATE_AUTH_CHALLENGE,
    new Function(
      stack,
      "CreateAuthChallenge",
      // must provide explicit event type
      async (event: CreateAuthChallengeTriggerEvent) => {
        return event;
      }
    )
  );
});

test("add a trigger to a user pool using a specific onX method", () => {
  const stack = new Stack();

  const pool = new UserPool(stack, "UserPool");

  pool.onCreateAuthChallenge(
    new Function(stack, "CreateAuthChallenge", async (event) => {
      return event;
    })
  );

  (function () {
    pool.onCreateAuthChallenge(
      // @ts-expect-error - does not return the right type
      new Function(stack, "InvalidCreateAuthChallenge", async (event) => {})
    );
  });
});
