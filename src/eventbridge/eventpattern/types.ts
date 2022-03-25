import { aws_events } from "aws-cdk-lib";

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
  "anything-but": (string | number | null)[] | string | number | PrefixPattern | null;
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
 * As of CDK 2.14, Event Bridge doesn't support the content matchers.
 * To use with CDK, cast to {@link aws_events.EventPattern}.
 * https://github.com/aws/aws-cdk/issues/6184
 */
export type FnLsEventPattern = {
  [key in keyof aws_events.EventPattern]: key extends "detail"
    ? Pattern
    : Exclude<Pattern, SubPattern>;
};
