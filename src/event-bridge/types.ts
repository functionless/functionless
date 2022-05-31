import { aws_events as functionless_event_bridge } from "aws-cdk-lib";
export interface Event<
  T = any,
  DetailType extends string = string,
  Source extends string = string
> {
  source: Source;
  "detail-type": DetailType;
  detail: T;
  version: string;
  id: string;
  account: string;
  time: string;
  region: string;
  resources: string[];
}

/**
 * CDK does not contain rich types for event bridge event patterns.
 * https://github.com/aws/aws-cdk/issues/6184
 */
export interface ExistsPattern {
  exists: boolean;
}

export const isExistsPattern = (x: any): x is ExistsPattern => {
  return "exists" in x;
};

export interface PrefixPattern {
  prefix: string;
}

export const isPrefixPattern = (x: any): x is PrefixPattern => {
  return "prefix" in x;
};

/**
 * Can only contain a single prefix pattern.
 */
export interface AnythingButPattern {
  "anything-but":
    | (string | number | null)[]
    | string
    | number
    | PrefixPattern
    | null;
}

export const isAnythingButPattern = (x: any): x is AnythingButPattern => {
  return "anything-but" in x;
};

export interface NumberPattern {
  numeric: [string, number, string, number] | [string, number];
}

export const isNumberPattern = (x: any): x is NumberPattern => {
  return typeof x === "object" && "number" in x;
};

export const isMatchPattern = (x: any): x is MatchPattern => {
  return x === null || typeof x === "string" || typeof x === "number";
};

export type MatchPattern = number | string | null | boolean;

export interface SubPattern extends Record<string, Pattern> {}

export type PatternList = (
  | MatchPattern
  | AnythingButPattern
  | NumberPattern
  | PrefixPattern
  | ExistsPattern
)[];

export type Pattern = PatternList | undefined | SubPattern;

/**
 * AWS's Event Pattern
 * https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-event-patterns.html
 *
 * CDK's Event Bridge types don't support the content matchers schemas.
 * To use with CDK, cast to {@link aws_events.EventPattern}.
 * https://github.com/aws/aws-cdk/issues/6184
 */
export type FunctionlessEventPattern = {
  [key in keyof functionless_event_bridge.EventPattern]: key extends "detail"
    ? Pattern
    : Exclude<Pattern, SubPattern>;
};
