/* eslint-disable */
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type Mutation = {
  __typename?: 'Mutation';
  acheterAngelUpgrade: Maybe<Palier>;
  acheterCashUpgrade: Maybe<Palier>;
  acheterQtProduit: Maybe<Product>;
  engagerManager: Maybe<Palier>;
  lancerProductionProduit: Maybe<Product>;
  resetWorld: Maybe<World>;
};


export type MutationAcheterAngelUpgradeArgs = {
  name: Scalars['String']['input'];
  user: Scalars['String']['input'];
};


export type MutationAcheterCashUpgradeArgs = {
  name: Scalars['String']['input'];
  user: Scalars['String']['input'];
};


export type MutationAcheterQtProduitArgs = {
  id: Scalars['Int']['input'];
  quantite: Scalars['Int']['input'];
  user: Scalars['String']['input'];
};


export type MutationEngagerManagerArgs = {
  name: Scalars['String']['input'];
  user: Scalars['String']['input'];
};


export type MutationLancerProductionProduitArgs = {
  id: Scalars['Int']['input'];
  user: Scalars['String']['input'];
};


export type MutationResetWorldArgs = {
  user: Scalars['String']['input'];
};

export type Palier = {
  __typename?: 'Palier';
  idcible: Scalars['Int']['output'];
  logo: Scalars['String']['output'];
  name: Scalars['String']['output'];
  ratio: Scalars['Int']['output'];
  seuil: Scalars['Float']['output'];
  typeratio: RatioType;
  unlocked: Scalars['Boolean']['output'];
};

export type Product = {
  __typename?: 'Product';
  cout: Scalars['Float']['output'];
  croissance: Scalars['Float']['output'];
  id: Scalars['Int']['output'];
  logo: Scalars['String']['output'];
  managerUnlocked: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  paliers: Array<Palier>;
  quantite: Scalars['Int']['output'];
  revenu: Scalars['Float']['output'];
  timeleft: Scalars['Int']['output'];
  vitesse: Scalars['Int']['output'];
};

export type Query = {
  __typename?: 'Query';
  getWorld: Maybe<World>;
};


export type QueryGetWorldArgs = {
  user: Scalars['String']['input'];
};

export enum RatioType {
  Ange = 'ange',
  Gain = 'gain',
  Vitesse = 'vitesse'
}

export type World = {
  __typename?: 'World';
  activeangels: Scalars['Int']['output'];
  allunlocks: Array<Palier>;
  angelbonus: Scalars['Int']['output'];
  angelupgrades: Array<Palier>;
  lastupdate: Scalars['Int']['output'];
  logo: Scalars['String']['output'];
  managers: Array<Palier>;
  money: Scalars['Float']['output'];
  name: Scalars['String']['output'];
  products: Array<Product>;
  score: Scalars['Float']['output'];
  totalangels: Scalars['Int']['output'];
  upgrades: Array<Palier>;
};
