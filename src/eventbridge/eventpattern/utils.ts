import { BinaryOp } from "../../expression";

export const invertBinaryOperator = (op: BinaryOp): BinaryOp => {
  switch (op) {
    case "<":
      return ">";
    case "<=":
      return ">=";
    case ">":
      return "<";
    case ">=":
      return "<=";
    default:
      return op;
  }
};