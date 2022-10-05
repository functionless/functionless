import * as sut from "@src/api/api-gateway";
import { getScope, withScope } from "@src/loader";
import { Stack } from "aws-cdk-lib";
import { Construct } from "constructs";

test("formatting the api gateway path", () => {
  withScope(new Stack(), () => {
    const api = sut.RestApi();
    withScope(new Construct(getScope(), "todos"), () => {
      withScope(new Construct(getScope(), "[todo-id]"), () => {
        withScope(new Construct(getScope(), "assignees"), () => {
          withScope(new Construct(getScope(), "[user-id]"), () => {
            const handler = new Construct(getScope(), "my-fake-handler");
            expect(sut.formatResourcePath(api, handler)).toBe(
              "/todos/{todo-id}/assignees/{user-id}"
            );
          });
        });
      });
    });
  });
});
