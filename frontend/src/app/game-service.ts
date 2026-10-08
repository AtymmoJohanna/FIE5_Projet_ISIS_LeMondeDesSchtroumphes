import { Service, inject, signal, linkedSignal } from '@angular/core';
import { form } from '@angular/forms/signals';
import { Apollo } from '@apollo-orbit/angular';
import {
  ACHETER_QT_PRODUIT_MUTATION,
  ENGAGER_MANAGER_MUTATION,
  GET_WORLD_QUERY,
  LANCER_PRODUCTION_PRODUIT_MUTATION,
  Palier,
  Product,
  RatioType,
  World,
} from './graphql';

// le modèle du formulaire "Your ID" : juste un nom
interface UserLogin {
  name: string;
}

@Service()
export class GameService {
  private readonly apollo = inject(Apollo);

  user = signal('');
  server = signal('http://localhost:3000');

  // ---------------------------------------------------------------
  // LE PSEUDO DU JOUEUR
  // ---------------------------------------------------------------
  UserloginModel = signal<UserLogin>({ name: '' });
  loginForm = form(this.UserloginModel); // formulaire relié au signal UserloginModel

  constructor() {
    // on regarde s'il existe un pseudo stocké dans le navigateur
    let username = localStorage.getItem('username');
    // bonus : si pas de pseudo, on en génère un au hasard
    if (!username || username === '') {
      username = 'Schtroumpf' + Math.floor(Math.random() * 10000);
    }
    // ce pseudo devient la valeur du champ texte ET le joueur actuel
    this.loginForm.name().value.set(username);
    this.user.set(username);
  }

  // appelée quand le joueur appuie sur Entrée dans le champ "Your ID"
  commitName() {
    const field = this.loginForm.name().value().trim();
    if (field === '') return; // on refuse un pseudo vide
    localStorage.setItem('username', field); // on retient le pseudo dans le navigateur
    this.user.set(field); // changer user relance automatiquement la requête getWorld
  }

  // bouton Refresh : on redemande le monde au serveur
  refreshWorld() {
    this.worldQuery.refetch();
  }

  // ---------------------------------------------------------------
  // LE MONDE
  // ---------------------------------------------------------------
  // requête GraphQL getWorld (relancée automatiquement si user change)
  worldQuery = this.apollo.signal.query({
    query: GET_WORLD_QUERY,
    variables: () => ({ user: this.user() }),
    fetchPolicy: 'network-only', // toujours demander au serveur (jamais une vieille copie en cache)
  });
  // le monde : copie modifiable du résultat de la requête
  world = linkedSignal(() => this.worldQuery.data()?.getWorld);

  // message à afficher au joueur (le composant app l'affiche dans une snackbar dès qu'il change)
  snackmessage = signal('');

  // ---------------------------------------------------------------
  // PRODUCTION
  // ---------------------------------------------------------------
  // appelée par un produit quand "qt" productions viennent de se terminer
  productionDone(prod: Product, qt: number) {
    this.world.update((world) => {
      if (!world) return world;
      // bonus des anges : chaque ange actif rapporte angelbonus % (2% au départ)
      const angelBonus = 1 + (world.activeangels * world.angelbonus) / 100;
      const gain = prod.revenu * prod.quantite * qt * angelBonus;
      // on renvoie un NOUVEAU monde (copie de l'ancien) avec money et score mis à jour
      return { ...world, money: world.money + gain, score: world.score + gain };
    });
  }

  // ---------------------------------------------------------------
  // ACHAT DE PRODUITS
  // ---------------------------------------------------------------
  // prix total pour acheter qt exemplaires d'un produit
  // chaque exemplaire coûte "croissance" fois plus cher que le précédent :
  // cout + cout*c + cout*c² + ... = cout * (c^qt - 1) / (c - 1)   (somme géométrique)
  coutAchat(prod: Product, qt: number): number {
    const c = prod.croissance;
    return (prod.cout * (Math.pow(c, qt) - 1)) / (c - 1);
  }

  // nombre maximum d'exemplaires qu'on peut acheter avec "argent"
  // on inverse la formule du dessus : c^n <= 1 + argent*(c-1)/cout  =>  n = log(...) / log(c)
  maxAchetable(prod: Product, argent: number): number {
    const c = prod.croissance;
    let n = Math.floor(Math.log(1 + (argent * (c - 1)) / prod.cout) / Math.log(c));
    // sécurité : à cause des arrondis des nombres à virgule, on vérifie qu'on peut vraiment payer
    if (n > 0 && this.coutAchat(prod, n) > argent) n = n - 1;
    return n;
  }

  buyProduct(product: Product, qt: number) {
    const world = this.world();
    if (!world) return;
    const cost = this.coutAchat(product, qt);
    if (world.money < cost) return; // pas assez d'argent

    // structuredClone = copie complète du monde, qu'on peut modifier sans risque
    // (on travaille sur la copie, puis on la donne au signal à la fin)
    const newworld = structuredClone(world);
    const prod = newworld.products.find((p) => p.id === product.id);
    if (!prod) return;

    newworld.money -= cost;
    prod.quantite += qt;
    prod.cout = prod.cout * Math.pow(prod.croissance, qt); // prix du prochain exemplaire

    // la quantité a augmenté : a-t-on atteint des seuils ?
    this.verifierUnlocks(newworld, prod);

    this.world.set(newworld);
    this.acheterProduitsGraphQL(product.id, qt); // on prévient le backend
  }

  // ---------------------------------------------------------------
  // BONUS : unlocks, allunlocks (et plus tard upgrades et angel upgrades)
  // Même code que appliquerBonus du backend.
  // ---------------------------------------------------------------
  appliquerBonus(world: World, palier: Palier) {
    // bonus sur les anges
    if (palier.typeratio === RatioType.Ange) {
      world.angelbonus += palier.ratio;
      return;
    }
    // idcible = 0 -> tous les produits, sinon seulement le produit ciblé
    const cibles =
      palier.idcible === 0
        ? world.products
        : world.products.filter((p) => p.id === palier.idcible);

    for (const p of cibles) {
      if (palier.typeratio === RatioType.Vitesse) {
        p.vitesse = Math.floor(p.vitesse / palier.ratio); // produit plus vite
      } else if (palier.typeratio === RatioType.Gain) {
        p.revenu = p.revenu * palier.ratio; // rapporte plus
      }
    }
  }

  // vérifie les unlocks après un achat du produit "prod" (modifie directement "world")
  verifierUnlocks(world: World, prod: Product) {
    const debloques: string[] = []; // noms des bonus débloqués, pour le message

    // 1) les unlocks du produit : quand SA quantité atteint le seuil
    for (const palier of prod.paliers) {
      if (!palier.unlocked && prod.quantite >= palier.seuil) {
        this.appliquerBonus(world, palier);
        palier.unlocked = true;
        debloques.push(palier.name);
      }
    }

    // 2) les allunlocks : quand TOUS les produits atteignent le seuil
    const qteMin = Math.min(...world.products.map((p) => p.quantite));
    for (const palier of world.allunlocks) {
      if (!palier.unlocked && qteMin >= palier.seuil) {
        this.appliquerBonus(world, palier);
        palier.unlocked = true;
        debloques.push(palier.name);
      }
    }

    if (debloques.length > 0) {
      this.snackmessage.set('🔓 Bonus débloqué : ' + debloques.join(', '));
    }
  }

  // texte qui décrit un bonus, ex : "Vitesse x2", "Gain x3", "Anges +2%"
  texteBonus(palier: Palier): string {
    if (palier.typeratio === RatioType.Vitesse) return 'Vitesse x' + palier.ratio;
    if (palier.typeratio === RatioType.Gain) return 'Gain x' + palier.ratio;
    return 'Anges +' + palier.ratio + '%';
  }

  // ---------------------------------------------------------------
  // MANAGERS
  // ---------------------------------------------------------------
  hireManager(manager: Palier) {
    const world = this.world();
    if (!world) return;
    if (manager.unlocked) return; // déjà engagé
    if (world.money < manager.seuil) return; // pas assez d'argent

    // le manager devient "unlocked"
    const newmanagers = world.managers.map((m) =>
      m.name === manager.name ? { ...m, unlocked: true } : m,
    );
    // le produit qu'il gère passe en managerUnlocked (=> production automatique)
    const newproducts = world.products.map((p) =>
      p.id === manager.idcible ? { ...p, managerUnlocked: true } : p,
    );
    this.world.set({
      ...world,
      money: world.money - manager.seuil,
      managers: newmanagers,
      products: newproducts,
    });

    this.snackmessage.set(manager.name + ' a été engagé !');
    this.engagerManagerGraphQL(manager.name);
  }

  // ---------------------------------------------------------------
  // MUTATIONS : on prévient le backend des actions du joueur
  // ---------------------------------------------------------------
  readonly acheterProduitsMutation = this.apollo.signal.mutation(ACHETER_QT_PRODUIT_MUTATION);

  async acheterProduitsGraphQL(id: number, qt: number) {
    try {
      await this.acheterProduitsMutation.mutate({
        variables: { user: this.user(), id, quantite: qt },
      });
    } catch (error) {
      this.snackmessage.set("Erreur serveur : l'achat n'a pas été enregistré");
      this.refreshWorld(); // le serveur fait foi : on recharge son monde pour être à nouveau d'accord avec lui
    }
  }

  readonly engagerManagerMutation = this.apollo.signal.mutation(ENGAGER_MANAGER_MUTATION);

  async engagerManagerGraphQL(name: string) {
    try {
      await this.engagerManagerMutation.mutate({
        variables: { user: this.user(), name },
      });
    } catch (error) {
      this.snackmessage.set("Erreur serveur : le manager n'a pas pu être engagé");
      this.refreshWorld(); // le serveur fait foi : on recharge son monde pour être à nouveau d'accord avec lui
    }
  }

  readonly lancerProductionMutation = this.apollo.signal.mutation(
    LANCER_PRODUCTION_PRODUIT_MUTATION,
  );

  async lancerProductionGraphQL(id: number) {
    try {
      await this.lancerProductionMutation.mutate({
        variables: { user: this.user(), id },
      });
    } catch (error) {
      this.snackmessage.set("Erreur serveur : la production n'a pas été enregistrée");
      this.refreshWorld(); // le serveur fait foi : on recharge son monde pour être à nouveau d'accord avec lui
    }
  }
}