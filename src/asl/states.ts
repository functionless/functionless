export interface StateMachine<S extends States> {
  Version?: "1.0";
  Comment?: string;
  TimeoutSeconds?: number;
  StartAt: keyof S;
  States: S;
}

export interface States {
  [stateName: string]: State;
}

export function isState(state: any): state is State {
  return state && "Type" in state;
}

export type State =
  | Choice
  | Fail
  | MapTask
  | ParallelTask
  | Pass
  | Succeed
  | Task
  | Wait;

export type TerminalState = Succeed | Fail | Extract<State, { End: true }>;

/**
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-common-fields.html
 */
export type CommonFields = {
  /**
   * Holds a human-readable description of the state.
   */
  Comment?: string;
  /**
   * A path that selects a portion of the state's input to be passed to the state's task for processing. If omitted, it has the value $ which designates the entire input. For more information, see Input and Output Processing).
   */
  InputPath?: string;
  /**
   * A path that selects a portion of the state's input to be passed to the state's output. If omitted, it has the value $ which designates the entire input. For more information, see Input and Output Processing.
   */
  OutputPath?: string;
} & (
  | {
      /**
       * The name of the next state that is run when the current state finishes. Some state types, such as Choice, allow multiple transition states.
       */
      Next: string;
      End?: never;
    }
  | {
      /**
       * Designates this state as a terminal state (ends the execution) if set to true. There can be any number of terminal states per state machine. Only one of Next or End can be used in a state. Some state types, such as Choice, don't support or use the End field.
       */
      End: true;
      Next?: never;
    }
);

/**
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-succeed-state.html
 */
export interface Succeed extends Omit<CommonFields, "Next" | "End"> {
  Type: "Succeed";
}

/**
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-fail-state.html
 */
export interface Fail extends Pick<CommonFields, "Comment"> {
  Type: "Fail";
  Error?: string;
  Cause?: string;
}

/**
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-wait-state.html
 */
export type Wait = CommonFields & {
  Type: "Wait";
  /**
   * A time, in seconds, to wait before beginning the state specified in the Next field.
   */
  Seconds?: number;
  /**
   * An absolute time to wait until beginning the state specified in the Next field.
   *
   * Timestamps must conform to the RFC3339 profile of ISO 8601, with the further restrictions that an uppercase T must separate the date and time portions, and an uppercase Z must denote that a numeric time zone offset is not present, for example, 2016-08-18T17:33:00Z.
   */
  Timestamp?: string;
  /**
   * A time, in seconds, to wait before beginning the state specified in the Next field, specified using a path from the state's input data.
   */
  SecondsPath?: string;
  /**
   * An absolute time to wait until beginning the state specified in the Next field, specified using a path from the state's input data.
   */
  TimestampPath?: string;
};

export type Parameters =
  | null
  | boolean
  | number
  | string
  | Parameters[]
  | {
      [name: string]: Parameters;
    };

/**
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-pass-state.html
 */
export type Pass = CommonFields & {
  Comment?: string;
  Type: "Pass";
  Result?: any;
  ResultPath?: string | null;
  Parameters?: Parameters;
};

/**
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-task-state.html
 */
export type CommonTaskFields = CommonFields & {
  Comment?: string;
  Parameters?: Parameters;
  ResultSelector?: Parameters;
  ResultPath?: string | null;
  Retry?: Retry[];
  Catch?: Catch[];
};

/**
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-task-state.html
 */
export type Task = CommonTaskFields & {
  Type: "Task";
  Resource: string;
};

/**
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-choice-state.html
 */
export interface Choice extends Omit<CommonFields, "End" | "Next"> {
  Type: "Choice";
  Choices: Branch[];
  Default?: string;
}

/**
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-choice-state.html
 */
export interface Branch extends Condition {
  Next: string;
}

/**
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-choice-state.html
 */
export interface Condition {
  Variable?: string;
  Not?: Condition;
  And?: Condition[];
  Or?: Condition[];
  BooleanEquals?: boolean;
  BooleanEqualsPath?: string;
  IsBoolean?: boolean;
  IsNull?: boolean;
  IsNumeric?: boolean;
  IsPresent?: boolean;
  IsString?: boolean;
  IsTimestamp?: boolean;
  NumericEquals?: number;
  NumericEqualsPath?: string;
  NumericGreaterThan?: number;
  NumericGreaterThanPath?: string;
  NumericGreaterThanEquals?: number;
  NumericGreaterThanEqualsPath?: string;
  NumericLessThan?: number;
  NumericLessThanPath?: string;
  NumericLessThanEquals?: number;
  NumericLessThanEqualsPath?: string;
  StringEquals?: string;
  StringEqualsPath?: string;
  StringGreaterThan?: string;
  StringGreaterThanPath?: string;
  StringGreaterThanEquals?: string;
  StringGreaterThanEqualsPath?: string;
  StringLessThan?: string;
  StringLessThanPath?: string;
  StringLessThanEquals?: string;
  StringLessThanEqualsPath?: string;
  StringMatches?: string;
  TimestampEquals?: string;
  TimestampEqualsPath?: string;
  TimestampGreaterThan?: string;
  TimestampGreaterThanPath?: string;
  TimestampGreaterThanEquals?: string;
  TimestampGreaterThanEqualsPath?: string;
  TimestampLessThan?: string;
  TimestampLessThanPath?: string;
  TimestampLessThanEquals?: string;
  TimestampLessThanEqualsPath?: string;
}

/**
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/concepts-error-handling.html
 */
export interface Retry {
  ErrorEquals: string[];
  IntervalSeconds?: number;
  MaxAttempts?: number;
  BackoffRate?: number;
}

/**
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/concepts-error-handling.html
 */
export interface Catch {
  ErrorEquals: string[];
  ResultPath?: string | null;
  Next: string;
}

/**
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-map-state.html
 */
export type MapTask = CommonTaskFields & {
  Type: "Map";
  /**
   * The Iterator field’s value is an object that defines a state machine which will process each element of the array.
   */
  Iterator: StateMachine<States>;
  /**
   * The ItemsPath field’s value is a reference path identifying where in the effective input the array field is found. For more information, see ItemsPath.
   *
   * States within an Iterator field can only transition to each other, and no state outside the Iterator field can transition to a state within it.
   *
   * If any iteration fails, entire Map state fails, and all iterations are terminated.
   */
  ItemsPath?: string;
  /**
   * Specifies where (in the input) to place the output of the branches. The input is then filtered as specified by the OutputPath field (if present) before being used as the state's output. For more information, see Input and Output Processing.
   */
  ResultPath?: string | null;
  /**
   * The `MaxConcurrency` field’s value is an integer that provides an upper bound on how many invocations of the Iterator may run in parallel. For instance, a MaxConcurrency value of 10 will limit your Map state to 10 concurrent iterations running at one time.
   *
   * Concurrent iterations may be limited. When this occurs, some iterations will not begin until previous iterations have completed. The likelihood of this occurring increases when your input array has more than 40 items.
   *
   * The default value is 0, which places no quota on parallelism and iterations are invoked as concurrently as possible.
   *
   * A MaxConcurrency value of 1 invokes the Iterator once for each array element in the order of their appearance in the input, and will not start a new iteration until the previous has completed.
   */
  MaxConcurrency?: number;
};

/**
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-parallel-state.html
 */
export type ParallelTask = CommonTaskFields & {
  Type: "Parallel";
  Branches: StateMachine<States>[];
};

export function isParallelTaskState(state: State): state is ParallelTask {
  return state.Type === "Parallel";
}
export function isMapTaskState(state: State): state is MapTask {
  return state.Type === "Map";
}
export function isTaskState(state: State): state is Task {
  return state.Type === "Task";
}
export function isPassState(state: State): state is Pass {
  return state.Type === "Pass";
}
export function isChoiceState(state: State): state is Choice {
  return state.Type === "Choice";
}
export function isFailState(state: State): state is Fail {
  return state.Type === "Fail";
}
export function isSucceedState(state: State): state is Succeed {
  return state.Type === "Succeed";
}
export function isWaitState(state: State): state is Wait {
  return state.Type === "Wait";
}
