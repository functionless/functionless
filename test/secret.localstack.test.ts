import { Duration, SecretValue } from "aws-cdk-lib";
import "jest";
import {
  BinarySecret,
  Function,
  FunctionProps,
  JsonSecret,
  SerializerImpl,
  TextSecret,
} from "../src";
import { runtimeTestExecutionContext, runtimeTestSuite } from "./runtime";

// inject the localstack client config into the lambda clients
// without this configuration, the functions will try to hit AWS proper
const localstackClientConfig: FunctionProps = {
  timeout: Duration.seconds(20),
  clientConfigRetriever:
    runtimeTestExecutionContext.deployTarget === "AWS"
      ? undefined
      : () => ({
          endpoint: `http://${process.env.LOCALSTACK_HOSTNAME}:4566`,
        }),
};

interface UserPass {
  username: string;
  password: string;
}

runtimeTestSuite("secretsManagerStack", (test) => {
  test(
    "JsonSecret should be able to get and put secret values",
    (scope, role) => {
      const secret = new JsonSecret<UserPass>(scope, "JsonSecret", {
        secretStringValue: SecretValue.unsafePlainText(
          JSON.stringify({
            username: "sam",
            password: "sam",
          })
        ),
      });

      const func = new Function(
        scope,
        "Func",
        {
          ...localstackClientConfig,
        },
        async (input: "get" | UserPass) => {
          if (input === "get") {
            return (await secret.getSecretValue()).SecretValue;
          } else {
            const response = await secret.putSecretValue({
              SecretValue: input,
            });
            return response;
          }
        }
      );
      func.resource.grantInvoke(role);
      return {
        outputs: {
          secretArn: secret.resource.secretArn,
          functionArn: func.resource.functionArn,
        },
      };
    },
    async (context, clients) => {
      const userPass: UserPass = {
        username: "sam",
        password: "dragon ball zzz",
      };

      await clients.lambda
        .invoke({
          FunctionName: context.functionArn,
          Payload: JSON.stringify(userPass),
        })
        .promise();

      const value = await clients.lambda
        .invoke({
          FunctionName: context.functionArn,
          Payload: JSON.stringify("get"),
        })
        .promise();

      expect(JSON.parse(value.Payload as string)).toEqual(userPass);
    }
  );

  test(
    "TextSecret should be able to get and put secret values",
    (scope, role) => {
      const secret = new TextSecret(scope, "TextSecret", {
        secretStringValue: SecretValue.unsafePlainText("secret text"),
      });

      const func = new Function(
        scope,
        "Func",
        {
          ...localstackClientConfig,
        },
        async (input: "get" | { put: string }) => {
          if (input === "get") {
            return (await secret.getSecretValue()).SecretValue;
          } else {
            const response = await secret.putSecretValue({
              SecretValue: input.put,
            });
            return response;
          }
        }
      );
      func.resource.grantInvoke(role);
      return {
        outputs: {
          secretArn: secret.resource.secretArn,
          functionArn: func.resource.functionArn,
        },
      };
    },
    async (context, clients) => {
      await clients.lambda
        .invoke({
          FunctionName: context.functionArn,
          Payload: JSON.stringify({ put: "value" }),
        })
        .promise();

      const value = await clients.lambda
        .invoke({
          FunctionName: context.functionArn,
          Payload: JSON.stringify("get"),
        })
        .promise();

      expect(JSON.parse(value.Payload as string)).toEqual("value");
    }
  );

  test(
    "BinarySecret should be able to get and put secret values",
    (scope, role) => {
      const secret = new BinarySecret(scope, "BinarySecret", {
        secretStringValue: SecretValue.unsafePlainText(
          Buffer.from("secret text").toString("base64")
        ),
      });

      SecretValue.ssmSecure("<parameter name>");

      const func = new Function(
        scope,
        "Func",
        {
          ...localstackClientConfig,
        },
        async (input: "get" | { put: string }) => {
          if (input === "get") {
            return (await secret.getSecretValue()).SecretValue.toString(
              "base64"
            );
          } else {
            const response = await secret.putSecretValue({
              SecretValue: Buffer.from(input.put, "base64"),
            });
            return response;
          }
        }
      );
      func.resource.grantInvoke(role);
      return {
        outputs: {
          secretArn: secret.resource.secretArn,
          functionArn: func.resource.functionArn,
        },
      };
    },
    async (context, clients) => {
      const secret = Buffer.from("value").toString("base64");
      await clients.lambda
        .invoke({
          FunctionName: context.functionArn,
          Payload: JSON.stringify({
            put: secret,
          }),
        })
        .promise();

      const value = await clients.lambda
        .invoke({
          FunctionName: context.functionArn,
          Payload: JSON.stringify("get"),
        })
        .promise();

      expect(JSON.parse(value.Payload as string)).toEqual(secret);
    }
  );
});
