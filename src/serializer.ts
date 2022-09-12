/**
 * A {@link ReadCodec} defines how some data type, {@link T}, is parsed from a `string` or {@link Buffer}.
 */
export interface ReadCodec<T> {
  /**
   * Parse the serialized {@link value} into a data object, {@link T}.
   */
  read(value: string): T;
}

/**
 * A {@link WriteCodec} defines how some data type, {@link T}, is serialize as a `string` or {@link Buffer}.
 */
export interface WriteCodec<T> {
  /**
   * Serialize a data object, {@link T}, to a `string` or {@link Buffer}.
   */
  write(value: T): string;
}

/**
 * A {@link Codec} defines how some data type, {@link T}, is serialized to/from a `string` or {@link Buffer}.
 */
export interface Codec<T> extends ReadCodec<T>, WriteCodec<T> {}

export enum DataType {
  String = "String",
  Json = "Json",
}

/**
 * A {@link Serializer} creates a {@link Codec} for serializing a data type, {@link T}.
 */
export interface Serializer<T> {
  dataType: DataType;
  /**
   * Create a {@link Codec} for serializing data objects of type, {@link T}.
   */
  create(): Codec<T>;
}

export namespace Serializer {
  export function text(): TextSerializer {
    return new TextSerializer();
  }
  export function json<T>(props?: JsonSerializerProps<T>): JsonSerializer<T> {
    return new JsonSerializer(props);
  }
}

export class TextSerializer implements Serializer<string> {
  readonly dataType = DataType.String;

  public create(): Codec<string> {
    return {
      read: (value) => value,
      write: (value) => value,
    };
  }
}

export interface JsonSerializerProps<T> {
  /**
   * Optional validation logic to run on values prior to serialization and after deserialization.
   */
  validate?: (value: any) => asserts value is T;
  /**
   * Optional reviver function to be passed to {@link JSON.parse}.
   */
  reviver?: (this: any, key: string, value: any) => any;
  /**
   * Optional replacer function to be passed to {@link JSON.replacer}.
   */
  replacer?: (this: any, key: string, value: any) => any;
}

/**
 * A {@link Serializer} for reading and writing data objects as JSON using
 * NodeJS's intrinsic {@link JSON.parse} and {@link JSON.stringify} functions.
 */
export class JsonSerializer<T> implements Serializer<T> {
  readonly dataType = DataType.Json;

  constructor(readonly props?: JsonSerializerProps<T>) {}

  public create(): Codec<T> {
    // stash properties from this for closure serialization hygiene
    const reviver = this.props?.reviver;
    const replacer = this.props?.replacer;
    const validate = this.props?.validate;
    return {
      read(value) {
        let item: T;
        if (typeof value === "string") {
          item = JSON.parse(value, reviver);
        } else {
          throw new Error();
        }
        validate?.(item);
        return item;
      },
      write(value) {
        validate?.(value);
        return JSON.stringify(value, replacer);
      },
    };
  }
}
