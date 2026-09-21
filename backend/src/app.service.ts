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
    const coutachat = (prod.cout * (Math.pow(prod.croissance, quantite) - 1)) / (prod.croissance - 1)
    const canBuy = world.money >= coutachat;
    if (!canBuy) {
      throw new Error(`Vous n'avez pas assez d'argent pour acheter ce produit`);
    }
    world.money -= coutachat;
    prod.quantite += quantite;
    prod.cout = prod.cout * Math.pow(prod.croissance, quantite);
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
  engagerManager(user: string, name: string): Palier {
    const world = this.readUserWorld(user);
    const manager = world.managers.find((m) => m.name === name);
    if (!manager) {
      throw new Error(`Ce schtroumphmanager n'existe pas`);
    }
    const product = world.products.find((p) => p.id === manager.idcible);
    if (!product) {
      throw new Error(`Ce schtroumph manager ne gère aucun produit`);
    }
    if (manager.unlocked) {
      throw new Error(`Ce schtroumph manager est déjà engagé`);
    }
    if (world.money < manager.seuil) {
      throw new Error(`Vous n'avez pas assez d'argent pour engager ce schtroumph manager`);
    }
    world.money -= manager.seuil;
    manager.unlocked = true;
    product.managerUnlocked = true;
    this.saveWorld(user, world);
    return manager;
  }
  private updateWorld(world: World): World {
    const now = Date.now();
    const elapsedTime = now - world.lastupdate;
    world.lastupdate = now;
    if (elapsedTime > 0) {
      world.products.forEach((prod) => {
        if (!prod.managerUnlocked) {// Cas sans manager : une seule production possible, pas de boucle
          if (prod.timeleft > 0) {
            if (prod.timeleft <= elapsedTime) {// La production s'est terminée entre-temps
              const revenue = prod.revenu * prod.quantite;
              world.money += revenue;
              world.score += revenue;
              prod.timeleft = 0;
            } else {
              prod.timeleft -= elapsedTime;
            }
          }
        } else { // Cas avec manager : la production se relance automatiquement en boucle
          const progress = prod.timeleft > 0 ? prod.vitesse - prod.timeleft : 0;
          const totalProgress = progress + elapsedTime;
          const cycles = Math.floor(totalProgress / prod.vitesse); //combien de productions complètes ont eu lieu
          const remainder = totalProgress % prod.vitesse; //temps déjà avancé dans le cycle actuellement en cours
          if (cycles > 0) {
            const gains = cycles * prod.revenu * prod.quantite;
            world.money += gains;
            world.score += gains;
          }
          prod.timeleft = prod.vitesse - remainder; // temps restant pour la production en cours
        }
      });
      world.lastupdate = now;
    }
    return world;
  }
}