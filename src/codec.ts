export interface ReadCodec<Value, Data> {
  read(data: Data): Value;
}
export interface WriteCodec<Value, Data> {
  write(value: Value): Data;
}
export interface Codec<Value, Data>
  extends ReadCodec<Value, Data>,
    WriteCodec<Value, Data> {}

export class JsonCodec<T> implements Codec<T, string> {
  public read(data: string): T {
    return JSON.parse(data);
  }
  public write(value: T): string {
    return JSON.stringify(value);
  }
}
