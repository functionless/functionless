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
