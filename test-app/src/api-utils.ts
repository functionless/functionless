/**for some tests */

export const getAuth = (item: IAccount | void, apiKey: string) => {
  let context: Record<string, any> = {};

  if (item?.entityType === "Account") {
    const accountId = item.Id;
    context.accountId = accountId;
    context.apiKey = apiKey;
  }
  return {
    isAuthorized: true,
    resolverContext: context,
    deniedFields: [],
  };
};

export interface IAccount {
  pk: string;
  entityType?: string;
  Id: string;
}
