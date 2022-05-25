/*
new ApiIntegration<...>()
  .transformRequest(req => ...) // transform input
  .call(...) // call integration
  .handleSuccess(...) // 200 response mapping template
  .handleFailure("400", ...)  // 400 response mapping template
  .handleFailure("500", ...);  // 500 response mapping template
*/

import { aws_apigateway } from "aws-cdk-lib";
import { FunctionDecl, isFunctionDecl } from "./declaration";
import { isErr } from "./error";
import { Function } from "./function";
import { VTL } from "./vtl";

type RequestTransformerFunction<Req, IntegRes> = (req: Req) => IntegRes;

export class ApiIntegration<
  Request,
  IntegrationRequest = Request,
  IntegrationResponse = any
> {
  /**
   * This static property identifies this class as an ApiIntegration to the TypeScript plugin.
   */
  public static readonly FunctionlessType = "ApiIntegration";
  readonly functionlessKind = "ApiIntegration";

  private readonly requestTransformer: FunctionDecl | undefined;
  private readonly integration:
    | Function<IntegrationRequest, IntegrationResponse>
    | undefined;

  public constructor();
  public constructor(
    requestTransformer?: FunctionDecl,
    integration?: Function<IntegrationRequest, IntegrationResponse>
  );
  public constructor(
    requestTransformer?: RequestTransformerFunction<
      Request,
      IntegrationRequest
    >,
    integration?: Function<IntegrationRequest, IntegrationResponse>
  );
  public constructor(
    requestTransformer?:
      | RequestTransformerFunction<Request, IntegrationRequest>
      | FunctionDecl,
    integration?: Function<IntegrationRequest, IntegrationResponse>
  ) {
    if (requestTransformer) {
      if (isFunctionDecl(requestTransformer)) {
        this.requestTransformer = requestTransformer;
      } else if (isErr(requestTransformer)) {
        throw requestTransformer.error;
      } else {
        throw Error("Unknown compiler error.");
      }
    }
    this.integration = integration;
  }

  transformRequest<I>(
    requestTransformer: RequestTransformerFunction<Request, I>
  ): ApiIntegration<Request, I, IntegrationResponse> {
    return new ApiIntegration<Request, I, IntegrationResponse>(
      requestTransformer
    );
  }

  call<I>(
    fn: Function<IntegrationRequest, I>
  ): ApiIntegration<Request, IntegrationRequest, I> {
    return new ApiIntegration<Request, IntegrationRequest, I>(
      this.requestTransformer,
      fn
    );
  }

  addMethod(path: string, api: aws_apigateway.RestApi): void {
    const resource = api.root.addResource(path);

    let apigwIntegration: aws_apigateway.Integration;

    if (!this.integration) {
      apigwIntegration = new aws_apigateway.MockIntegration({
        requestTemplates: {
          "application/json": '{ "statusCode": 200 }',
        },
      });
    } else {
      if (this.requestTransformer) {
        // @ts-ignore
        const vtl = new VTL();
        // @ts-ignore
        const x = this.requestTransformer.body.statements;
        // vtl.eval(this.requestTransformer);
        // @ts-ignore
        const requestMappingTemplate = 123;
      }
      apigwIntegration = new aws_apigateway.LambdaIntegration(
        this.integration.resource,
        { proxy: this.requestTransformer == undefined }
      );
    }

    resource.addMethod("GET", apigwIntegration, {
      requestParameters: {
        "method.request.path.num": true,
      },
    });
  }
}

// declare const fn: Function<string, number>;

// const restApi = new aws_apigateway.RestApi("api");

// // TODO: prevent calling transformRequest after call
// const api = new ApiIntegration<number>()
//   .transformRequest((n) => n.toString())
//   .call(fn);

// type SynthesizedMethodProps = aws_apigateway.MethodProps;

// export class SynthesizedMethod extends aws_apigateway.Method {
//   /**
//    * All of the Request and Response Mapping templates in the order they are executed by the AppSync service.
//    */
//   // readonly templates: string[];

//   constructor(
//     scope: Construct,
//     id: string,
//     props: SynthesizedMethodProps
//   ) {
//     super(scope, id, props);

//     this.httpMethod
//   }
// }
