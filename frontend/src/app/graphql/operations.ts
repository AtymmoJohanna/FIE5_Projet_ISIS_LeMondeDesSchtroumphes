/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type * as Types from './types';

import { gql } from '@apollo-orbit/angular';
import { TypedDocumentNode as DocumentNode } from '@apollo-orbit/angular';
export type GetWorldQueryVariables = Exact<{
  user: string;
}>;


export type GetWorldQueryData = { getWorld: { name: string, logo: string, money: number, score: number, totalangels: number, activeangels: number, angelbonus: number, lastupdate: number, products: Array<{ id: number, name: string, logo: string, cout: number, croissance: number, revenu: number, vitesse: number, quantite: number, timeleft: number, managerUnlocked: boolean, paliers: Array<{ name: string, logo: string, seuil: number, idcible: number, ratio: number, typeratio: Types.RatioType, unlocked: boolean }> }>, allunlocks: Array<{ name: string, logo: string, seuil: number, idcible: number, ratio: number, typeratio: Types.RatioType, unlocked: boolean }>, upgrades: Array<{ name: string, logo: string, seuil: number, idcible: number, ratio: number, typeratio: Types.RatioType, unlocked: boolean }>, angelupgrades: Array<{ name: string, logo: string, seuil: number, idcible: number, ratio: number, typeratio: Types.RatioType, unlocked: boolean }>, managers: Array<{ name: string, logo: string, seuil: number, idcible: number, ratio: number, typeratio: Types.RatioType, unlocked: boolean }> } | null };


export const GET_WORLD_QUERY = gql`
    query GetWorld($user: String!) {
  getWorld(user: $user) {
    name
    logo
    money
    score
    totalangels
    activeangels
    angelbonus
    lastupdate
    products {
      id
      name
      logo
      cout
      croissance
      revenu
      vitesse
      quantite
      timeleft
      managerUnlocked
      paliers {
        name
        logo
        seuil
        idcible
        ratio
        typeratio
        unlocked
      }
    }
    allunlocks {
      name
      logo
      seuil
      idcible
      ratio
      typeratio
      unlocked
    }
    upgrades {
      name
      logo
      seuil
      idcible
      ratio
      typeratio
      unlocked
    }
    angelupgrades {
      name
      logo
      seuil
      idcible
      ratio
      typeratio
      unlocked
    }
    managers {
      name
      logo
      seuil
      idcible
      ratio
      typeratio
      unlocked
    }
  }
}
    ` as DocumentNode<GetWorldQueryData, GetWorldQueryVariables>;

export function gqlGetWorldQuery(variables: GetWorldQueryVariables): { query: typeof GET_WORLD_QUERY, variables: typeof variables };
export function gqlGetWorldQuery(variables: () => GetWorldQueryVariables | null): { query: typeof GET_WORLD_QUERY, variables: typeof variables };
export function gqlGetWorldQuery(variables: any): any {
  return {
    query: GET_WORLD_QUERY,
    variables
  };
}
