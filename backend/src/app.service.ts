import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { origworld } from './origworld.js';
import { Palier, Product, World, RatioType } from './graphql.js';

@Injectable()
export class AppService {
  readUserWorld(user: string): World {
    let world: World;
    try {
      const data = fs.readFileSync(
        path.join(process.cwd(), 'userworlds/', user + '-world.json'),
      );
      world = JSON.parse(data.toString());
    } catch (e: unknown) {
      console.log((e as Error).message);
      world = JSON.parse(JSON.stringify(origworld));
    }
    return world;
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
    prod.revenu += prod.revenu * Math.pow(prod.croissance, quantite);
    for (const palier of prod.paliers) {
      if (!palier.unlocked && prod.quantite >= palier.seuil) {
        if (palier.typeratio === RatioType.vitesse) {
          prod.vitesse = Math.floor(prod.vitesse / palier.ratio);
        } else if (palier.typeratio === RatioType.gain) {
          prod.revenu *= palier.ratio;
        }
        palier.unlocked = true;
      }
    }
    const qteMin = Math.min(...world.products.map((p) => p.quantite));
    for (const palier of world.allunlocks) {
      if (!palier.unlocked && qteMin >= palier.seuil) {
        if (palier.typeratio === RatioType.vitesse) {
          world.products.forEach((p) => {
            p.vitesse = Math.floor(p.vitesse / palier.ratio);
          });
        } else if (palier.typeratio === RatioType.gain) {
          world.products.forEach((p) => {
            p.revenu *= palier.ratio;
          });
        } else if (palier.typeratio === RatioType.ange) {
          world.angelbonus += palier.ratio;
        }
        palier.unlocked = true;
      }
    }
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
      throw new Error(`Ce produit est déjà en production`);
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
  private updateWorld(user: string): World {
    const world = this.readUserWorld(user);
    const now = Date.now();
    const elapsedTime = now - world.lastupdate;
    world.lastupdate = now;
    if (elapsedTime > 0) {
      const angelBonusMultiplier = 1 + world.activeangels * world.angelbonus / 100; 
      world.products.forEach((prod) => {
        if (!prod.managerUnlocked) {// Cas sans manager : une seule production possible, pas de boucle
          if (prod.timeleft > 0) {
            if (prod.timeleft <= elapsedTime) {
              const revenue = prod.revenu * prod.quantite;
              world.money += revenue * angelBonusMultiplier;
              world.score += revenue * angelBonusMultiplier;
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
            world.money += gains * angelBonusMultiplier;
            world.score += gains * angelBonusMultiplier;
          }
          prod.timeleft = prod.vitesse - remainder; // temps restant pour la production en cours
        }
      });
      world.lastupdate = now;
    }
    return world;
  }
  acheterCashUpgrade(user: string, name: string): Palier {
    const world = this.readUserWorld(user);
    const upgrade = world.upgrades.find((u) => u.name === name);
    if (!upgrade) {
      throw new Error(`Cet upgrade n'existe pas`);
    }
    if (upgrade.unlocked) {
      throw new Error(`Cet upgrade est déjà acheté`);
    }
    if (world.money < upgrade.seuil) {
      throw new Error(`Vous n'avez pas assez d'argent pour acheter cet upgrade`);
    }
    world.money -= upgrade.seuil;
    upgrade.unlocked = true;
    const product = world.products.find((p) => p.id === upgrade.idcible);
    if (product) {
      if (upgrade.typeratio === RatioType.vitesse) {
        product.vitesse /= upgrade.ratio;
      } else if (upgrade.typeratio === RatioType.gain) {
        product.revenu *= upgrade.ratio;
      } else if (upgrade.typeratio === RatioType.ange) {
        world.angelbonus += upgrade.ratio;
      }
      this.saveWorld(user, world);
    }
    if (upgrade.idcible === 0) { // si l'upgrade concerne tous les produits
      world.products.forEach((p) => {
        if (upgrade.typeratio === RatioType.vitesse) {
          p.vitesse /= upgrade.ratio;
        } else if (upgrade.typeratio === RatioType.gain) {
          p.revenu *= upgrade.ratio;
        } else if (upgrade.typeratio === RatioType.ange) {
          world.angelbonus += upgrade.ratio;
        }
      });
    }
    return upgrade;
  }
  acheterAngelUpgrade(user: string, name: string): Palier {
    const world = this.readUserWorld(user);
    const upgrade = world.angelupgrades.find((u) => u.name === name);
    if (!upgrade) {
      throw new Error(`Cet upgrade n'existe pas`);
    }
    if (upgrade.unlocked) {
      throw new Error(`Cet upgrade est déjà acheté`);
    }
    if (world.activeangels < upgrade.seuil) {
      throw new Error(`Vous n'avez pas assez d'anges pour acheter cet upgrade`);
    }
    world.activeangels -= upgrade.seuil;
    upgrade.unlocked = true;
    const product = world.products.find((p) => p.id === upgrade.idcible);
    if (product) {
      if (upgrade.typeratio === RatioType.vitesse) {
        product.vitesse /= upgrade.ratio;
      } else if (upgrade.typeratio === RatioType.gain) {
        product.revenu *= upgrade.ratio;
      }
      this.saveWorld(user, world);
    }
    if (upgrade.idcible === 0) { // si l'upgrade concerne tous les produits
      world.products.forEach((p) => {
        if (upgrade.typeratio === RatioType.vitesse) {
          p.vitesse /= upgrade.ratio;
        } else if (upgrade.typeratio === RatioType.gain) {
          p.revenu *= upgrade.ratio;
        } else if (upgrade.typeratio === RatioType.ange) {
          world.angelbonus += upgrade.ratio;
        }
      });
    }
    return upgrade;
  }
  resetWorld(user: string): World {
    const world = this.updateWorld(user);
    const newTotalAngels = Math.floor(150 * Math.sqrt(world.score / Math.pow(10, 15))); //à corriger
    const angesGagnes = newTotalAngels - world.totalangels;
    const newWorld : World = JSON.parse(JSON.stringify(origworld));
    
    newWorld.score = world.score; // le score ne repart jamais à zéro
    newWorld.totalangels = newTotalAngels;
    newWorld.activeangels = world.activeangels + angesGagnes;
    newWorld.lastupdate = Date.now();
    this.saveWorld(user, newWorld);
    return newWorld;
  }
}