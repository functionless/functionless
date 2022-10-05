import { NativeBinaryAttribute } from "typesafe-dynamodb/lib/attribute-value";
export declare type AttributeKeyToObject<T> = {
    [k in keyof T]: T[k] extends {
        S: infer S;
    } ? S : T[k] extends {
        N: `${infer N}`;
    } ? N : T[k] extends {
        B: any;
    } ? NativeBinaryAttribute : never;
};
//# sourceMappingURL=util.d.ts.map