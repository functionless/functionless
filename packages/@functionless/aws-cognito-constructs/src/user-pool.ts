import { aws_cognito } from "aws-cdk-lib";
import type lambda from "aws-lambda";
import type { Construct } from "constructs";
import type { Function } from "@functionless/aws-lambda-constructs";

export type Trigger<Request, Response = Request> = Function<Request, Response>;

/**
 * Triggers for a user pool
 * @see https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools-working-with-aws-lambda-triggers.html
 */
export interface UserPoolTriggers {
  /**
   * Creates an authentication challenge.
   *
   * ```ts
   * new UserPool(scope, id, {
   *   createAuthChallenge: new Function(scope, id, async (event) => {
   *     // handle event, set response properties, etc.
   *     event.response... = ..
   *     return event;
   *   }
   * }
   * ```
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-create-auth-challenge.html
   * @default - no trigger configured
   */
  readonly createAuthChallenge?: Trigger<lambda.CreateAuthChallengeTriggerEvent>;
  /**
   * A custom Message AWS Lambda trigger.
   *
   * ```ts
   * new UserPool(scope, id, {
   *   customMessage: new Function(scope, id, async (event) => {
   *     // handle event, set response properties, etc.
   *     event.response... = ..
   *     return event;
   *   })
   * });
   * ```
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-custom-message.html
   * @default - no trigger configured
   */
  readonly customMessage?: Trigger<lambda.CustomMessageTriggerEvent>;
  /**
   * Defines the authentication challenge.
   *
   * ```ts
   * new UserPool(scope, id, {
   *   defineAuthChallenge: new Function(scope, id, async (event) => {
   *     // handle event, set response properties, etc.
   *     event.response... = ..
   *     return event;
   *   })
   * });
   * ```
   *
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-define-auth-challenge.html
   * @default - no trigger configured
   */
  readonly defineAuthChallenge?: Trigger<lambda.DefineAuthChallengeTriggerEvent>;
  /**
   * A post-authentication AWS Lambda trigger.
   *
   * ```ts
   * new UserPool(scope, id, {
   *   postAuthentication: new Function(scope, id, async (event) => {
   *     // handle event, set response properties, etc.
   *     event.response... = ..
   *     return event;
   *   })
   * });
   * ```
   *
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-post-authentication.html
   * @default - no trigger configured
   */
  readonly postAuthentication?: Trigger<lambda.PostAuthenticationTriggerEvent>;
  /**
   * A post-confirmation AWS Lambda trigger.
   *
   * ```ts
   * new UserPool(scope, id, {
   *   postConfirmation: new Function(scope, id, async (event) => {
   *     // handle event, set response properties, etc.
   *     event.response... = ..
   *     return event;
   *   })
   * });
   * ```
   *
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-post-confirmation.html
   * @default - no trigger configured
   */
  readonly postConfirmation?: Trigger<lambda.PostConfirmationTriggerEvent>;
  /**
   * A pre-authentication AWS Lambda trigger.
   *
   * ```ts
   * new UserPool(scope, id, {
   *   preAuthentication: new Function(scope, id, async (event) => {
   *     // handle event, set response properties, etc.
   *     event.response... = ..
   *     return event;
   *   })
   * });
   * ```
   *
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-authentication.html
   * @default - no trigger configured
   */
  readonly preAuthentication?: Trigger<lambda.PreAuthenticationTriggerEvent>;
  /**
   * A pre-registration AWS Lambda trigger.
   *
   * ```ts
   * new UserPool(scope, id, {
   *   preSignUp: new Function(scope, id, async (event) => {
   *     // handle event, set response properties, etc.
   *     event.response... = ..
   *     return event;
   *   })
   * });
   * ```
   *
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-sign-up.html
   * @default - no trigger configured
   */
  readonly preSignUp?: Trigger<lambda.PreSignUpTriggerEvent>;
  /**
   * A pre-token-generation AWS Lambda trigger.
   *
   * ```ts
   * new UserPool(scope, id, {
   *   preTokenGeneration: new Function(scope, id, async (event) => {
   *     // handle event, set response properties, etc.
   *     event.response... = ..
   *     return event;
   *   })
   * });
   * ```
   *
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-token-generation.html
   * @default - no trigger configured
   */
  readonly preTokenGeneration?: Trigger<lambda.PreTokenGenerationTriggerEvent>;
  /**
   * A user-migration AWS Lambda trigger.
   *
   * ```ts
   * new UserPool(scope, id, {
   *   userMigration: new Function(scope, id, async (event) => {
   *     // handle event, set response properties, etc.
   *     event.response... = ..
   *     return event;
   *   })
   * });
   * ```
   *
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-migrate-user.html
   * @default - no trigger configured
   */
  readonly userMigration?: Trigger<lambda.UserMigrationTriggerEvent>;
  /**
   * Verifies the authentication challenge response.
   *
   * ```ts
   * new UserPool(scope, id, {
   *   verifyAuthChallengeResponse: new Function(scope, id, async (event) => {
   *     // handle event, set response properties, etc.
   *     event.response... = ..
   *     return event;
   *   })
   * });
   * ```
   *
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-verify-auth-challenge-response.html
   * @default - no trigger configured
   */
  readonly verifyAuthChallengeResponse?: Trigger<lambda.VerifyAuthChallengeResponseTriggerEvent>;
  /**
   * Amazon Cognito invokes this trigger to send email notifications to users.
   *
   * ```ts
   * new UserPool(scope, id, {
   *   customEmailSender: new Function(scope, id, async (event) => {
   *     // handle event, set response properties, etc.
   *     event.response... = ..
   *     return event;
   *   })
   * });
   * ```
   *
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-custom-email-sender.html
   * @default - no trigger configured
   */
  readonly customEmailSender?: Trigger<lambda.CustomEmailSenderTriggerEvent>;
  /**
   * Amazon Cognito invokes this trigger to send SMS notifications to users.
   *
   * ```ts
   * new UserPool(scope, id, {
   *   customSmsSender: new Function(scope, id, async (event) => {
   *     // handle event, set response properties, etc.
   *     event.response... = ..
   *     return event;
   *   })
   * });
   * ```
   *
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-custom-sms-sender.html
   * @default - no trigger configured
   */
  readonly customSmsSender?: Trigger<lambda.CustomSMSSenderTriggerEvent>;
}

/**
 * Map a friendly trigger name to the {@link aws_cognito.UserPoolOperation}.
 */
const triggers: {
  [triggerName in keyof UserPoolTriggers]: aws_cognito.UserPoolOperation;
} = {
  createAuthChallenge: aws_cognito.UserPoolOperation.CREATE_AUTH_CHALLENGE,
  customEmailSender: aws_cognito.UserPoolOperation.CUSTOM_EMAIL_SENDER,
  customMessage: aws_cognito.UserPoolOperation.CUSTOM_MESSAGE,
  customSmsSender: aws_cognito.UserPoolOperation.CUSTOM_SMS_SENDER,
  defineAuthChallenge: aws_cognito.UserPoolOperation.DEFINE_AUTH_CHALLENGE,
  postAuthentication: aws_cognito.UserPoolOperation.POST_AUTHENTICATION,
  postConfirmation: aws_cognito.UserPoolOperation.POST_CONFIRMATION,
  preAuthentication: aws_cognito.UserPoolOperation.PRE_AUTHENTICATION,
  preSignUp: aws_cognito.UserPoolOperation.PRE_SIGN_UP,
  preTokenGeneration: aws_cognito.UserPoolOperation.PRE_TOKEN_GENERATION,
  userMigration: aws_cognito.UserPoolOperation.USER_MIGRATION,
  verifyAuthChallengeResponse:
    aws_cognito.UserPoolOperation.VERIFY_AUTH_CHALLENGE_RESPONSE,
};

export interface UserPoolProps
  extends Omit<aws_cognito.UserPoolProps, "lambdaTriggers"> {
  /**
   * Lambda functions to use for supported Cognito triggers.
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools-working-with-aws-lambda-triggers.html
   * @default - No Lambda triggers.
   */
  readonly lambdaTriggers?: UserPoolTriggers;
}

class BaseUserPool {
  public static readonly FunctionlessType = "UserPool";
  public readonly FunctionlessType = UserPool.FunctionlessType;

  /**
   * Create a new {@link UserPool} from an existing {@link aws_cognito.UserPool}.
   *
   *
   * @param resource an existing UserPool Construct.
   * @see {@link aws_cognito.UserPool}
   */
  constructor(
    /**
     * The underlying {@link aws_cognito.UserPool} instance.
     */
    readonly resource: aws_cognito.UserPool
  ) {}

  /**
   * Configure AWS Cognito to trigger a {@link Function}.
   *
   * Usage Pattern 1 - on("triggerName")
   * ```ts
   * userPool.on("createAuthChallenge", new Function(scope, id, async (event) => {
   *   // handle event, set response properties, etc.
   *   event.response... = ..
   *   return event;
   * }))
   * ```
   *
   * Usage Pattern 2 - {@link aws_cognito.UserPoolTriggers}.
   *
   * ```ts
   * userPool.on(
   *   aws_cognito.UserPoolOperation.CREATE_AUTH_CHALLENGE,
   *   new Function(scope, id, async (event: CreateAuthChallengeTriggerEvent) => {
   *                                          // ^ you must explicitly type the even in this case
   *     // handle event, set response properties, etc.
   *     event.response... = ..
   *     return event;
   *   }));
   * ```
   *
   * @param triggerName name of a trigger in {@link UserPoolTriggers}
   * @param handler the {@link Function} to send the trigger events to.
   */
  public on<
    TriggerName extends keyof UserPoolTriggers | aws_cognito.UserPoolOperation
  >(
    triggerName: TriggerName,
    handler: TriggerName extends keyof UserPoolTriggers
      ? Exclude<UserPoolTriggers[TriggerName], undefined>
      : Exclude<UserPoolTriggers[keyof UserPoolTriggers], undefined>
  ): void {
    this.resource.addTrigger(
      typeof triggerName === "object"
        ? triggerName
        : triggers[triggerName as keyof UserPoolTriggers]!,
      handler.resource
    );
  }

  /**
   * Creates an authentication challenge.
   *
   * ```ts
   * userPool.onCreateAuthChallenge(new Function(scope, id, async (event) => {
   *   // handle event, set response properties, etc.
   *   event.response... = ..
   *   return event;
   * }));
   * ```
   *
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-create-auth-challenge.html
   * @default - no trigger configured
   */
  public onCreateAuthChallenge(
    handler: Trigger<lambda.CreateAuthChallengeTriggerEvent>
  ): void {
    return this.on("createAuthChallenge", handler);
  }

  /**
   * Amazon Cognito invokes this trigger to send email notifications to users.
   *
   * ```ts
   * userPool.onCustomEmailSender(new Function(scope, id, async (event) => {
   *   // handle event, set response properties, etc.
   *   event.response... = ..
   *   return event;
   * }));
   * ```
   *
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-custom-email-sender.html
   * @default - no trigger configured
   */
  public onCustomEmailSender(
    handler: Trigger<lambda.CustomEmailSenderTriggerEvent>
  ): void {
    return this.on("customEmailSender", handler);
  }

  /**
   * A custom Message AWS Lambda trigger.
   *
   * ```ts
   * userPool.onCustomMessage(new Function(scope, id, async (event) => {
   *   // handle event, set response properties, etc.
   *   event.response... = ..
   *   return event;
   * }));
   * ```
   *
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-custom-message.html
   * @default - no trigger configured
   */
  public onCustomMessage(
    handler: Trigger<lambda.CustomMessageTriggerEvent>
  ): void {
    return this.on("customMessage", handler);
  }

  /**
   * Amazon Cognito invokes this trigger to send SMS notifications to users.
   *
   * ```ts
   * userPool.onCustomMessage(new Function(scope, id, async (event) => {
   *   // handle event, set response properties, etc.
   *   event.response... = ..
   *   return event;
   * }));
   * ```
   *
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-custom-sms-sender.html
   * @default - no trigger configured
   */
  public onCustomSmsSender(
    handler: Trigger<lambda.CustomSMSSenderTriggerEvent>
  ): void {
    return this.on("customSmsSender", handler);
  }

  /**
   * Defines the authentication challenge.
   *
   * ```ts
   * userPool.onDefineAuthChallenge(new Function(scope, id, async (event) => {
   *   // handle event, set response properties, etc.
   *   event.response... = ..
   *   return event;
   * }));
   * ```
   *
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-define-auth-challenge.html
   * @default - no trigger configured
   */
  public onDefineAuthChallenge(
    handler: Trigger<lambda.DefineAuthChallengeTriggerEvent>
  ): void {
    return this.on("defineAuthChallenge", handler);
  }

  /**
   * A post-authentication AWS Lambda trigger.
   *
   * ```ts
   * userPool.onPostAuthentication(new Function(scope, id, async (event) => {
   *   // handle event, set response properties, etc.
   *   event.response... = ..
   *   return event;
   * }));
   * ```
   *
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-post-authentication.html
   * @default - no trigger configured
   */
  public onPostAuthentication(
    handler: Trigger<lambda.PostAuthenticationTriggerEvent>
  ): void {
    return this.on("postAuthentication", handler);
  }

  /**
   * A post-confirmation AWS Lambda trigger.
   *
   * ```ts
   * userPool.onPostConfirmation(new Function(scope, id, async (event) => {
   *   // handle event, set response properties, etc.
   *   event.response... = ..
   *   return event;
   * }));
   * ```
   *
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-post-confirmation.html
   * @default - no trigger configured
   */
  public onPostConfirmation(
    handler: Trigger<lambda.PostConfirmationTriggerEvent>
  ): void {
    return this.on("postConfirmation", handler);
  }

  /**
   * A pre-authentication AWS Lambda trigger.
   *
   * ```ts
   * userPool.onPreAuthentication(new Function(scope, id, async (event) => {
   *   // handle event, set response properties, etc.
   *   event.response... = ..
   *   return event;
   * }));
   * ```
   *
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-authentication.html
   * @default - no trigger configured
   */
  public onPreAuthentication(
    handler: Trigger<lambda.PreAuthenticationTriggerEvent>
  ): void {
    return this.on("preAuthentication", handler);
  }

  /**
   * A pre-registration AWS Lambda trigger.
   *
   * ```ts
   * userPool.onPreSignUp(new Function(scope, id, async (event) => {
   *   // handle event, set response properties, etc.
   *   event.response... = ..
   *   return event;
   * }));
   * ```
   *
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-sign-up.html
   * @default - no trigger configured
   */
  public onPreSignUp(handler: Trigger<lambda.PreSignUpTriggerEvent>): void {
    return this.on("preSignUp", handler);
  }

  /**
   * A pre-token-generation AWS Lambda trigger.
   *
   * ```ts
   * userPool.onPreTokenGeneration(new Function(scope, id, async (event) => {
   *   // handle event, set response properties, etc.
   *   event.response... = ..
   *   return event;
   * }));
   * ```
   *
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-token-generation.html
   * @default - no trigger configured
   */
  public onPreTokenGeneration(
    handler: Trigger<lambda.PreTokenGenerationTriggerEvent>
  ): void {
    return this.on("preTokenGeneration", handler);
  }

  /**
   * A user-migration AWS Lambda trigger.
   *
   * ```ts
   * userPool.onUserMigration(new Function(scope, id, async (event) => {
   *   // handle event, set response properties, etc.
   *   event.response... = ..
   *   return event;
   * }));
   * ```
   *
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-migrate-user.html
   * @default - no trigger configured
   */
  public onUserMigration(
    handler: Trigger<lambda.UserMigrationTriggerEvent>
  ): void {
    return this.on("userMigration", handler);
  }

  /**
   * Verifies the authentication challenge response.
   *
   * ```ts
   * userPool.onVerifyAuthChallengeResponse(new Function(scope, id, async (event) => {
   *   // handle event, set response properties, etc.
   *   event.response... = ..
   *   return event;
   * }));
   * ```
   *
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-verify-auth-challenge-response.html
   * @default - no trigger configured
   */
  public onVerifyAuthChallengeResponse(
    handler: Trigger<lambda.VerifyAuthChallengeResponseTriggerEvent>
  ): void {
    return this.on("verifyAuthChallengeResponse", handler);
  }
}

/**
 * An AWS Cognito User Pool.
 */
export interface IUserPool extends BaseUserPool {}

/**
 * Defines an AWS Cognito User Pool.
 *
 * ```ts
 * const userPool = new UserPool(stack, "UserPool", {
 *   lambdaTriggers: {
 *     createAuthChallenge: new Function(
 *       stack,
 *       "CreateAuthChallenge",
 *       async (event) => {
 *         // implement logic for the CreateAuthChallenge lifecycle event
 *         return event;
 *       }
 *     ),
 *   },
 * });
 * ```
 */
export class UserPool extends BaseUserPool implements IUserPool {
  /**
   * Create a {@link UserPool} from a pre-existing {@link aws_cognito.UserPool}.
   *
   * @param resource a pre-existing CDK User Pool L2 Construct.
   * @returns a Functionless {@link UserPool}.
   */
  public static from(resource: aws_cognito.UserPool): IUserPool {
    return new BaseUserPool(resource);
  }

  /**
   * Create a new AWS Cognito {@link UserPool}.
   *
   * @param scope Construct scope to instantiate the UserPool in.
   * @param id id of this UserPool within
   * @param props the {@link UserPoolProps}.
   * @see {@link aws_cognito.UserPool}
   */
  constructor(scope: Construct, id: string, props?: UserPoolProps) {
    super(
      new aws_cognito.UserPool(scope, id, {
        ...props,
        lambdaTriggers: props?.lambdaTriggers
          ? Object.fromEntries(
              Object.entries(props.lambdaTriggers).map(
                ([triggerName, triggerHandler]) => [
                  triggerName,
                  triggerHandler.resource,
                ]
              )
            )
          : undefined,
      })
    );
  }
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
