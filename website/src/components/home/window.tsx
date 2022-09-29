export const Window = ({ children }: React.PropsWithChildren<{}>) => (
  <div className="window bg-functionless-code">
    <div className="flex py-4 bg-functionless-code">{children}</div>
  </div>
);
