import { Code } from "../../code";
import Cart from "./construct.mdx";
import Consume from "./consume.mdx";

export const ExtendAndComposeCode = () => (
  <div className="grid grid-cols-4 gap-8">
    <div className="col-span-4">
      <Code
        fileName="src/cart-component.ts"
        language="typescript"
        introDelayMs={250}
      >
        <Cart />
      </Code>
    </div>
    <div className="col-span-3 -ml-7 -mr-7 -mt-16">
      <Code
        fileName="src/cart-service/cart.ts"
        language="typescript"
        introDelayMs={1900}
      >
        <Consume />
      </Code>
    </div>
  </div>
);
