import { Service, inject, signal, linkedSignal, computed } from '@angular/core';
import { form } from '@angular/forms/signals';
import { Apollo } from '@apollo-orbit/angular';
import {
  ACHETER_QT_PRODUIT_MUTATION,
  ENGAGER_MANAGER_MUTATION,
  GET_WORLD_QUERY,
  LANCER_PRODUCTION_PRODUIT_MUTATION,
  ACHETER_CASH_UPGRADE_MUTATION,
  RESET_WORLD_MUTATION,
  ACHETER_ANGEL_UPGRADE_MUTATION,
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
  //server = signal('https://capitalist.lucaslopvet.fr');

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

  angelMultiplier = computed(() => {
    const world = this.world();
    return world ? 1 + (world.activeangels * world.angelbonus) / 100 : 1;
  });

  // message à afficher au joueur (le composant app l'affiche dans une snackbar)
  snackmessage = signal<{ text: string; icon: string }>({ text: '', icon: '' });

  notify(text: string, icon: string) {
    // on crée un nouvel objet à chaque fois : même deux messages identiques de suite s'afficheront
    this.snackmessage.set({ text, icon });
  }

  // ---------------------------------------------------------------
  // PRODUCTION
  // ---------------------------------------------------------------
  // appelée par un produit quand "qt" productions viennent de se terminer
  productionDone(prod: Product, qt: number) {
    this.world.update((world) => {
      if (!world) return world;
      const gain = prod.revenu * prod.quantite * qt * this.angelMultiplier();
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
        p.timeleft = Math.floor(p.timeleft / palier.ratio); // la production en cours accélère aussi
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
      this.notify('Bonus débloqué : ' + debloques.join(', '), 'bonus');
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

    this.notify(manager.name + ' a été engagé !', 'manager');
    this.engagerManagerGraphQL(manager.name);
  }

  // ---------------------------------------------------------------
  // CASH UPGRADES
  // ---------------------------------------------------------------
  buyUpgrade(upgrade: Palier) {
    const world = this.world();
    if (!world) return;
    if (upgrade.unlocked) return; // déjà acheté
    if (world.money < upgrade.seuil) return; // pas assez d'argent

    const newworld = structuredClone(world);
    const up = newworld.upgrades.find((u) => u.name === upgrade.name);
    if (!up) return;

    newworld.money -= up.seuil;
    up.unlocked = true;
    this.appliquerBonus(newworld, up);

    this.world.set(newworld);
    this.notify(up.name + ' acheté !', 'bonus');
    this.acheterUpgradeGraphQL(up.name);
  }

  readonly acheterUpgradeMutation = this.apollo.signal.mutation(ACHETER_CASH_UPGRADE_MUTATION);

  async acheterUpgradeGraphQL(name: string) {
    try {
      await this.acheterUpgradeMutation.mutate({
        variables: { user: this.user(), name },
      });
    } catch (error) {
      this.notify("Erreur serveur : l'upgrade n'a pas été enregistré", 'erreur');
      this.refreshWorld();
    }
  }

  // ---------------------------------------------------------------
  // ANGES / INVESTORS
  // ---------------------------------------------------------------
  // anges supplémentaires gagnés par la partie en cours (même formule que le backend)
  angesSupplementaires(world: World): number {
    const total = Math.floor(150 * Math.sqrt(world.score / Math.pow(10, 15)));
    return Math.max(0, total - world.totalangels);
  }

  readonly resetWorldMutation = this.apollo.signal.mutation(RESET_WORLD_MUTATION);

  async resetWorldGraphQL() {
    try {
      await this.resetWorldMutation.mutate({
        variables: { user: this.user() },
      });
      this.refreshWorld(); // on récupère le monde remis à zéro par le serveur
      this.notify('Nouvelle partie ! Tes anges sont actifs', 'bonus');
    } catch (error) {
      this.notify('Erreur serveur : la remise à zéro a échoué', 'erreur');
    }
  }

    // ---------------------------------------------------------------
  // ANGEL UPGRADES
  // ---------------------------------------------------------------
  buyAngelUpgrade(upgrade: Palier) {
    const world = this.world();
    if (!world) return;
    if (upgrade.unlocked) return; // déjà acheté
    if (world.activeangels < upgrade.seuil) return; // pas assez d'anges

    const newworld = structuredClone(world);
    const up = newworld.angelupgrades.find((u) => u.name === upgrade.name);
    if (!up) return;

    newworld.activeangels -= up.seuil; // pour un angel upgrade, "seuil" est un nombre d'anges
    up.unlocked = true;
    this.appliquerBonus(newworld, up); // gain, vitesse ou ange, comme les autres bonus

    this.world.set(newworld);
    this.notify(up.name + ' acheté !', 'bonus');
    this.acheterAngelUpgradeGraphQL(up.name);
  }

  readonly acheterAngelUpgradeMutation = this.apollo.signal.mutation(
    ACHETER_ANGEL_UPGRADE_MUTATION,
  );

  async acheterAngelUpgradeGraphQL(name: string) {
    try {
      await this.acheterAngelUpgradeMutation.mutate({
        variables: { user: this.user(), name },
      });
    } catch (error) {
      this.notify("Erreur serveur : l'angel upgrade n'a pas été enregistré", 'erreur');
      this.refreshWorld();
    }
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
      this.notify("Erreur serveur : l'achat n'a pas été enregistré", 'erreur');
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
      this.notify("Erreur serveur : le manager n'a pas pu être engagé", 'erreur');
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
      this.notify("Erreur serveur : la production n'a pas été enregistrée", 'erreur');
      this.refreshWorld(); // le serveur fait foi : on recharge son monde pour être à nouveau d'accord avec lui
    }
  }
}