export function isResource(a: any): a is Resource {
  return typeof a?.kind === "string";
}

export interface Resource {
  kind: string;
}
