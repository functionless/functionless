export type Literal =
  | undefined
  | null
  | boolean
  | number
  | string
  | Literal[]
  | readonly Literal[]
  | {
      [key: string]: Literal;
    };

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
