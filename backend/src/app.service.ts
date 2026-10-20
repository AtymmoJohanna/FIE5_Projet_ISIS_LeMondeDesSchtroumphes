import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { origworld } from './origworld.js';
import { Palier, Product, World, RatioType } from './graphql.js';

@Injectable()
export class AppService {
  // ---------------------------------------------------------------
  // LECTURE / SAUVEGARDE DU MONDE
  // ---------------------------------------------------------------

  // Lit le fichier du joueur. S'il n'existe pas, on renvoie une copie du monde d'origine.
  readUserWorld(user: string): World {
    try {
      const data = fs.readFileSync(
        path.join(process.cwd(), 'userworlds/', user + '-world.json'),
      );
      return JSON.parse(data.toString());
    } catch (e: unknown) {
      // copie "profonde" pour ne jamais modifier origworld lui-même
      return JSON.parse(JSON.stringify(origworld));
    }
  }

  // Écrit le monde du joueur dans son fichier
  saveWorld(user: string, world: World) {
    fs.mkdirSync(path.join(process.cwd(), 'userworlds'), { recursive: true }); // crée le dossier s'il n'existe pas
    fs.writeFileSync(
      path.join(process.cwd(), 'userworlds/', user + '-world.json'),
      JSON.stringify(world),
    );
  }

  // ---------------------------------------------------------------
  // MISE À JOUR DU SCORE EN FONCTION DU TEMPS QUI PASSE
  // Appelée au début de CHAQUE requête : comme ça, l'argent gagné
  // pendant que le joueur était absent est toujours pris en compte.
  // ---------------------------------------------------------------
  updateWorld(user: string): World {
    const world = this.readUserWorld(user);
    const now = Date.now();
    // lastupdate est stocké en texte (String dans le schéma) car Date.now() est trop grand pour un Int GraphQL
    const lastupdate = Number(world.lastupdate);
    const elapsedTime = lastupdate === 0 ? 0 : now - lastupdate; // 0 = première connexion
    world.lastupdate = String(now);

    // bonus des anges : ex. 10 anges actifs x 2% = x1.2
    const angelBonus = 1 + (world.activeangels * world.angelbonus) / 100;

    for (const prod of world.products) {
      if (!prod.managerUnlocked) {
        // SANS manager : une seule production à la fois
        if (prod.timeleft > 0) {
          if (prod.timeleft <= elapsedTime) {
            this.ajouterGain(world, prod, 1, angelBonus);
            prod.timeleft = 0;
          } else {
            prod.timeleft -= elapsedTime;
          }
        }
      } else {
        // AVEC manager : la production se relance toute seule en boucle
        const dejaFait = prod.timeleft > 0 ? prod.vitesse - prod.timeleft : 0;
        const tempsTotal = dejaFait + elapsedTime;
        const cycles = Math.floor(tempsTotal / prod.vitesse); // nb de productions terminées
        const reste = tempsTotal % prod.vitesse; // avancement de la production en cours
        this.ajouterGain(world, prod, cycles, angelBonus);
        prod.timeleft = prod.vitesse - reste;
      }
    }
    return world;
  }

  // Ajoute à l'argent et au score le gain de "nb" productions d'un produit
  private ajouterGain(world: World, prod: Product, nb: number, angelBonus: number) {
    const gain = prod.revenu * prod.quantite * nb * angelBonus;
    world.money += gain;
    world.score += gain;
  }

  // ---------------------------------------------------------------
  // APPLIQUER UN BONUS (unlock, allunlock, cash upgrade ou angel upgrade)
  // Une seule fonction pour tous les bonus, comme ça pas de code copié-collé.
  // ---------------------------------------------------------------
  private appliquerBonus(world: World, palier: Palier) {
    // bonus sur les anges
    if (palier.typeratio === RatioType.ange) {
      world.angelbonus += palier.ratio;
      return;
    }
    // idcible = 0 -> tous les produits, sinon seulement le produit ciblé
    const cibles =
      palier.idcible === 0
        ? world.products
        : world.products.filter((p) => p.id === palier.idcible);

    for (const p of cibles) {
      if (palier.typeratio === RatioType.vitesse) {
        // on divise le temps de production (Math.floor car vitesse est un Int)
        p.vitesse = Math.floor(p.vitesse / palier.ratio);
        p.timeleft = Math.floor(p.timeleft / palier.ratio);
      } else if (palier.typeratio === RatioType.gain) {
        p.revenu = p.revenu * palier.ratio;
      }
    }
  }

  // ---------------------------------------------------------------
  // QUERY
  // ---------------------------------------------------------------
  getWorld(user: string): World {
    const world = this.updateWorld(user);
    this.saveWorld(user, world);
    return world;
  }

  // ---------------------------------------------------------------
  // MUTATIONS
  // ---------------------------------------------------------------
  acheterQtProduit(user: string, id: number, quantite: number): Product {
    const world = this.updateWorld(user);
    const prod = world.products.find((p) => p.id === id);
    if (!prod) {
      throw new Error(`Ce produit n'existe pas`);
    }
    // coût de n produits = cout * (croissance^n - 1) / (croissance - 1)  (somme géométrique)
    const coutachat =
      (prod.cout * (Math.pow(prod.croissance, quantite) - 1)) / (prod.croissance - 1);
    if (world.money < coutachat) {
      throw new Error(`Vous n'avez pas assez d'argent pour acheter ce produit`);
    }
    world.money -= coutachat;
    prod.quantite += quantite;
    prod.cout = prod.cout * Math.pow(prod.croissance, quantite); // prix du prochain exemplaire
    // (le revenu ne change PAS à l'achat : seulement avec les unlocks et upgrades)

    // unlocks du produit : débloqués quand la quantité atteint le seuil
    for (const palier of prod.paliers) {
      if (!palier.unlocked && prod.quantite >= palier.seuil) {
        this.appliquerBonus(world, palier);
        palier.unlocked = true;
      }
    }

    // allunlocks : débloqués quand TOUS les produits atteignent le seuil
    const qteMin = Math.min(...world.products.map((p) => p.quantite));
    for (const palier of world.allunlocks) {
      if (!palier.unlocked && qteMin >= palier.seuil) {
        this.appliquerBonus(world, palier);
        palier.unlocked = true;
      }
    }

    this.saveWorld(user, world);
    return prod;
  }

  lancerProductionProduit(user: string, id: number): Product {
    const world = this.updateWorld(user);
    const prod = world.products.find((p) => p.id === id);
    if (!prod) {
      throw new Error(`Ce produit n'existe pas`);
    }
    if (prod.quantite === 0) {
      throw new Error(`Vous ne possédez pas encore ce produit`);
    }
    if (prod.timeleft > 0) {
      throw new Error(`Ce produit est déjà en production`);
    }
    prod.timeleft = prod.vitesse;
    this.saveWorld(user, world);
    return prod;
  }

  engagerManager(user: string, name: string): Palier {
    const world = this.updateWorld(user);
    const manager = world.managers.find((m) => m.name === name);
    if (!manager) {
      throw new Error(`Ce schtroumpf manager n'existe pas`);
    }
    const product = world.products.find((p) => p.id === manager.idcible);
    if (!product) {
      throw new Error(`Ce schtroumpf manager ne gère aucun produit`);
    }
    if (manager.unlocked) {
      throw new Error(`Ce schtroumpf manager est déjà engagé`);
    }
    if (world.money < manager.seuil) {
      throw new Error(`Vous n'avez pas assez d'argent pour engager ce schtroumpf manager`);
    }
    world.money -= manager.seuil;
    manager.unlocked = true;
    product.managerUnlocked = true;
    this.saveWorld(user, world);
    return manager;
  }

  acheterCashUpgrade(user: string, name: string): Palier {
    const world = this.updateWorld(user);
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
    this.appliquerBonus(world, upgrade);
    this.saveWorld(user, world);
    return upgrade;
  }

  acheterAngelUpgrade(user: string, name: string): Palier {
    const world = this.updateWorld(user);
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
    world.activeangels -= upgrade.seuil; // les anges dépensés sont perdus
    upgrade.unlocked = true;
    this.appliquerBonus(world, upgrade);
    this.saveWorld(user, world);
    return upgrade;
  }

  resetWorld(user: string): World {
    const world = this.updateWorld(user);
    // formule du jeu d'origine : anges = 150 * racine(score / 10^15)
    const newTotalAngels = Math.floor(150 * Math.sqrt(world.score / Math.pow(10, 15)));
    const angesGagnes = Math.max(0, newTotalAngels - world.totalangels);

    // on repart du monde d'origine...
    const newWorld: World = JSON.parse(JSON.stringify(origworld));
    // ... mais on garde le score, les anges et les angel upgrades déjà achetés
    newWorld.score = world.score;
    newWorld.totalangels = world.totalangels + angesGagnes;
    newWorld.activeangels = world.activeangels + angesGagnes;
    newWorld.lastupdate = String(Date.now());
    newWorld.angelupgrades = world.angelupgrades;
    for (const upgrade of newWorld.angelupgrades) {
      if (upgrade.unlocked) {
        this.appliquerBonus(newWorld, upgrade); // on réapplique leurs bonus au nouveau monde
      }
    }
    this.saveWorld(user, newWorld);
    return newWorld;
  }
}