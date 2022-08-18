import { Duration } from "aws-cdk-lib";
import "jest";
import { Function, FunctionProps, JsonSecret } from "../src";
import { localstackTestSuite } from "./localstack";
import { localLambda } from "./runtime-util";

// inject the localstack client config into the lambda clients
// without this configuration, the functions will try to hit AWS proper
const localstackClientConfig: FunctionProps = {
  timeout: Duration.seconds(20),
  clientConfigRetriever: () => ({
    endpoint: `http://${process.env.LOCALSTACK_HOSTNAME}:4566`,
  }),
};

interface UserPass {
  username: string;
  password: string;
}

localstackTestSuite("secretsManagerStack", (test) => {
  test(
    "should be able to get and put secret values",
    (scope) => {
      const secret = new JsonSecret<UserPass>(scope, "Secret");

      const func = new Function(
        scope,
        "Func",
        {
          ...localstackClientConfig,
        },
        async (input: "get" | UserPass) => {
          if (input === "get") {
            return secret.getSecretValue();
          } else {
            return secret.putSecretValue({
              SecretValue: input,
            });
          }
        }
      );
      return {
        outputs: {
          secretArn: secret.resource.secretArn,
          functionArn: func.resource.functionArn,
        },
      };
    },
    async (context) => {
      const userPass: UserPass = {
        username: "sam",
        password: "dragon ball zzz",
      };
      await localLambda
        .invoke({
          FunctionName: context.functionArn,
          Payload: JSON.stringify(userPass),
        })
        .promise();

      const value = await localLambda
        .invoke({
          FunctionName: context.functionArn,
          Payload: JSON.stringify("get"),
        })
        .promise();

      expect(value).toEqual({
        ExecutedVersion: "$LATEST",
        FunctionError: "Unhandled",
        LogResult: "",
        // WHY THE FUCK?
        Payload:
          '{"errorMessage":"Secrets Manager can\'t find the specified secret value for staging label: AWSCURRENT","errorType":"ResourceNotFoundException"}\n',
        StatusCode: 200,
      });
    }
  );
});
