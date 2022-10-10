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
