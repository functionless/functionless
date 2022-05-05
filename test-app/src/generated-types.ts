import { GraphQLResolveInfo } from 'graphql';
export type Maybe<T> = T | null | undefined;
export type InputMaybe<T> = T | null | undefined;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type ResolverFn<TResult, TParent, TContext, TArgs> = { args: TArgs; context: TContext; result: TResult; source: TParent;}
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
};

export type Mutation = {
  addPerson: Maybe<Person>;
  addPerson2: Maybe<Person>;
  deletePerson: Maybe<Person>;
  updateName: Maybe<Person>;
};


export type MutationAddPersonArgs = {
  input: PersonInput;
};


export type MutationAddPerson2Args = {
  input: PersonInput;
};


export type MutationDeletePersonArgs = {
  id: Scalars['ID'];
};


export type MutationUpdateNameArgs = {
  id: Scalars['ID'];
  name: Scalars['String'];
};

export type Person = {
  id: Scalars['String'];
  name: Scalars['String'];
};

export type PersonInput = {
  name: Scalars['String'];
};

export type ProcessedPerson = {
  id: Scalars['String'];
  name: Scalars['String'];
  score: Scalars['Int'];
};

export type Query = {
  getPerson: Maybe<ProcessedPerson>;
};


export type QueryGetPersonArgs = {
  id: Scalars['String'];
};



export type ResolverTypeWrapper<T> = Promise<T> | T;

export type Resolver<TResult, TParent = {}, TContext = {}, TArgs = {}> = ResolverFn<TResult, TParent, TContext, TArgs>;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = {}, TContext = {}, TArgs = {}> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = {}, TContext = {}> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = {}, TContext = {}> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = {}, TParent = {}, TContext = {}, TArgs = {}> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  Boolean: ResolverTypeWrapper<Scalars['Boolean']>;
  ID: ResolverTypeWrapper<Scalars['ID']>;
  Int: ResolverTypeWrapper<Scalars['Int']>;
  Mutation: ResolverTypeWrapper<{}>;
  Person: ResolverTypeWrapper<Person>;
  PersonInput: PersonInput;
  ProcessedPerson: ResolverTypeWrapper<ProcessedPerson>;
  Query: ResolverTypeWrapper<{}>;
  String: ResolverTypeWrapper<Scalars['String']>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  Boolean: Scalars['Boolean'];
  ID: Scalars['ID'];
  Int: Scalars['Int'];
  Mutation: {};
  Person: Person;
  PersonInput: PersonInput;
  ProcessedPerson: ProcessedPerson;
  Query: {};
  String: Scalars['String'];
};

export type MutationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  addPerson: Resolver<Maybe<ResolversTypes['Person']>, ParentType, ContextType, RequireFields<MutationAddPersonArgs, 'input'>>;
  addPerson2: Resolver<Maybe<ResolversTypes['Person']>, ParentType, ContextType, RequireFields<MutationAddPerson2Args, 'input'>>;
  deletePerson: Resolver<Maybe<ResolversTypes['Person']>, ParentType, ContextType, RequireFields<MutationDeletePersonArgs, 'id'>>;
  updateName: Resolver<Maybe<ResolversTypes['Person']>, ParentType, ContextType, RequireFields<MutationUpdateNameArgs, 'id' | 'name'>>;
};

export type PersonResolvers<ContextType = any, ParentType extends ResolversParentTypes['Person'] = ResolversParentTypes['Person']> = {
  id: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  name: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ProcessedPersonResolvers<ContextType = any, ParentType extends ResolversParentTypes['ProcessedPerson'] = ResolversParentTypes['ProcessedPerson']> = {
  id: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  name: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  score: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type QueryResolvers<ContextType = any, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  getPerson: Resolver<Maybe<ResolversTypes['ProcessedPerson']>, ParentType, ContextType, RequireFields<QueryGetPersonArgs, 'id'>>;
};

export type Resolvers<ContextType = any> = {
  Mutation: MutationResolvers<ContextType>;
  Person: PersonResolvers<ContextType>;
  ProcessedPerson: ProcessedPersonResolvers<ContextType>;
  Query: QueryResolvers<ContextType>;
};

