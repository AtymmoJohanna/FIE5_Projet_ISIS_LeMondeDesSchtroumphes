import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { origworld } from './origworld.js';
import { Palier, Product, World } from './graphql.js';

@Injectable()
export class AppService {
  readUserWorld(user: string): World {
    try {
      const data = fs.readFileSync(
        path.join(process.cwd(), 'userworlds/', user + '-world.json'),
      );
      return JSON.parse(data.toString());
    } catch (e: unknown) {
      console.log((e as Error).message);
      return origworld;
    }
  }
  saveWorld(user: string, world: World) {
    fs.writeFile(
      path.join(process.cwd(), 'userworlds/', user + '-world.json'),
      JSON.stringify(world),
      (err) => {
        if (err) {
          console.error(err);
          throw new Error(`Erreur d'écriture du monde coté serveur`);
        }
      },
    );
  }
  acheterQtProduit(user: string, id: number, quantite: number,): Product {
    const world = this.readUserWorld(user);
    const prod = world.products.find((p) => p.id === id);
    if (!prod) {
      throw new Error(`Ce produit n'existe pas`);
    }
    const coutTotal = quantite / 2 * (2 * prod.cout + (quantite - 1) * prod.cout * (prod.croissance - 1));
    const canBuy = world.money >= coutTotal;
    if (!canBuy) {
      throw new Error(`Vous n'avez pas assez d'argent pour acheter ce produit`);
    }
    world.money -= coutTotal;
    prod.quantite += quantite;
    prod.cout += prod.croissance * quantite;
    this.saveWorld(user, world);
    return prod;
  }
  lancerProductionProduit(user: string, id: number): Product {
    const world = this.readUserWorld(user);
    const prod = world.products.find((p) => p.id === id);
    if (!prod) {
      throw new Error(`Ce produit n'existe pas`);
    }
    if (prod.timeleft > 0) {
      throw new Error(`La production de ce produit est déjà en cours`);
    }
    prod.timeleft = prod.vitesse;
    this.saveWorld(user, world);
    return prod;
  }
  engagerManager(user: string, palier: Palier): Palier {
    const world = this.readUserWorld(user);
    const manager = world.managers.find((m) => m.name === palier.name);
    if (!manager) {
      throw new Error(`Ce manager n'existe pas`);
    }
    const product = world.products.find((p) => p.id === manager.idcible);
    if (!product) {
      throw new Error(`Ce manager ne gère aucun produit`);
    }
    if (manager.unlocked) {
      throw new Error(`Ce manager est déjà engagé`);
    }
    if (world.money < manager.seuil) {
      throw new Error(`Vous n'avez pas assez d'argent pour engager ce manager`);
    }
    world.money -= manager.seuil;
    manager.unlocked = true;
    product.managerUnlocked = true;
    this.saveWorld(user, world);
    return manager;
  }
}
