import { aws_cognito } from "aws-cdk-lib";
import lambda from "aws-lambda";
import { Construct } from "constructs";
import { Function } from "./function";
import { Mixin } from "./util";

export type Trigger<Request, Response = Request> = Function<Request, Response>;

/**
 * Triggers for a user pool
 * @see https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools-working-with-aws-lambda-triggers.html
 */
export interface UserPoolTriggers {
  /**
   * Creates an authentication challenge.
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-create-auth-challenge.html
   * @default - no trigger configured
   */
  readonly createAuthChallenge?: Trigger<lambda.CreateAuthChallengeTriggerEvent>;
  /**
   * A custom Message AWS Lambda trigger.
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-custom-message.html
   * @default - no trigger configured
   */
  readonly customMessage?: Trigger<lambda.CustomMessageTriggerEvent>;
  /**
   * Defines the authentication challenge.
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-define-auth-challenge.html
   * @default - no trigger configured
   */
  readonly defineAuthChallenge?: Trigger<lambda.DefineAuthChallengeTriggerEvent>;
  /**
   * A post-authentication AWS Lambda trigger.
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-post-authentication.html
   * @default - no trigger configured
   */
  readonly postAuthentication?: Trigger<lambda.PostAuthenticationTriggerEvent>;
  /**
   * A post-confirmation AWS Lambda trigger.
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-post-confirmation.html
   * @default - no trigger configured
   */
  readonly postConfirmation?: Trigger<lambda.PostConfirmationTriggerEvent>;
  /**
   * A pre-authentication AWS Lambda trigger.
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-authentication.html
   * @default - no trigger configured
   */
  readonly preAuthentication?: Trigger<lambda.PreAuthenticationTriggerEvent>;
  /**
   * A pre-registration AWS Lambda trigger.
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-sign-up.html
   * @default - no trigger configured
   */
  readonly preSignUp?: Trigger<lambda.PreSignUpTriggerEvent>;
  /**
   * A pre-token-generation AWS Lambda trigger.
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-token-generation.html
   * @default - no trigger configured
   */
  readonly preTokenGeneration?: Trigger<lambda.PreTokenGenerationTriggerEvent>;
  /**
   * A user-migration AWS Lambda trigger.
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-migrate-user.html
   * @default - no trigger configured
   */
  readonly userMigration?: Trigger<lambda.UserMigrationTriggerEvent>;
  /**
   * Verifies the authentication challenge response.
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-verify-auth-challenge-response.html
   * @default - no trigger configured
   */
  readonly verifyAuthChallengeResponse?: Trigger<lambda.VerifyAuthChallengeResponseTriggerEvent>;
  /**
   * Amazon Cognito invokes this trigger to send email notifications to users.
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-custom-email-sender.html
   * @default - no trigger configured
   */
  readonly customEmailSender?: Trigger<lambda.CustomEmailSenderTriggerEvent>;
  /**
   * Amazon Cognito invokes this trigger to send SMS notifications to users.
   * @see https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-custom-sms-sender.html
   * @default - no trigger configured
   */
  readonly customSmsSender?: Trigger<lambda.CustomSMSSenderTriggerEvent>;
}

// map a friendly trigger name to the {@link aws_cognito.UserPoolOperation}.
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

/**
 * Defines an AWS Cognito User Pool.
 */
export class UserPool {
  public static readonly FunctionlessType = "UserPool";
  public readonly FunctionlessType = UserPool.FunctionlessType;

  /**
   * The underlying {@link aws_cognito.UserPool} instance.
   */
  readonly resource: aws_cognito.UserPool;

  /**
   * Create a new {@link UserPool} from an existing {@link aws_cognito.UserPool}.
   *
   *
   * @param resource an existing UserPool Construct.
   * @see {@link aws_cognito.UserPool}
   */
  constructor(resource: aws_cognito.UserPool);

  /**
   * Create a new AWS Cognito {@link UserPool}.
   *
   * @param scope Construct scope to instantiate the UserPool in.
   * @param id id of this UserPool within
   * @param props the {@link UserPoolProps}.
   * @see {@link aws_cognito.UserPool}
   */
  constructor(scope: Construct, id: string, props?: UserPoolProps);

  constructor(
    ...args:
      | [resource: aws_cognito.UserPool]
      | [scope: Construct, id: string, props?: UserPoolProps]
  ) {
    if (args.length === 1) {
      this.resource = args[0];
    } else {
      const [scope, id, props] = args;
      this.resource = new aws_cognito.UserPool(scope, id, {
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
      });
    }
  }

  /**
   * Configure a {@link Function} to handle AWS Cognito Triggers.
   *
   * ```ts
   * userPool.on("createAuthChallenge", new Function(scope, id, async (event) => {
   *   // handle event
   * }))
   * ```
   *
   * @param triggerName name of a trigger in {@link UserPoolTriggers}
   * @param handler the {@link Function} to send the trigger events to.
   */
  public on<TriggerName extends keyof UserPoolTriggers>(
    triggerName: TriggerName,
    handler: Exclude<UserPoolTriggers[TriggerName], undefined>
  ): void {
    this.resource.addTrigger(triggers[triggerName], handler.resource);
  }

  /**
   * Adds the `onX` trigger handlers.
   *
   * Example:
   * ```ts
   * userPool.onCreateAuthChallenge(new Function(scope, "CreateAuthChallenge", async (event) => {
   *   // do work and then:
   *   return event;
   * }));
   * ```
   *
   * @see UserPoolTriggerOnMethods
   */
  static {
    Object.keys(triggers).forEach(
      (triggerName) =>
        ((UserPool.prototype as any)[
          `${triggerName.charAt(0).toUpperCase()}${triggerName.slice(1)}`
        ] = function (handler: Function<any>) {
          this.on(triggerName, handler);
        })
    );
  }
}

export type UserPoolTriggerOnMethods = Mixin<{
  [triggerName in keyof UserPoolTriggers as triggerName extends `${infer Head}${infer Rest}`
    ? `on${Uppercase<Head>}${Rest}`
    : never]-?: (handler: UserPoolTriggers[triggerName]) => void;
}>;

/**
 * Adds the `on*` User Pool triggers to the {@link UserPool}.
 *
 * ```ts
 * userPool.onCreateAuthChallenge(new Function(scope, "CreateAuthChallenge", async (event) => {
 *   // do work and then:
 *   return event;
 * }));
 * ```
 */
export interface UserPool extends UserPoolTriggerOnMethods {}
