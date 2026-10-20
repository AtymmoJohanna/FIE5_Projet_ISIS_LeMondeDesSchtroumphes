import { Component, OnDestroy, OnInit, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { BigvaluePipe } from '../bigvalue-pipe';
import { SecondPipe } from '../second-pipe';
import { GameService } from '../game-service';
import { Product } from '../graphql';

@Component({
  imports: [BigvaluePipe, SecondPipe],
  selector: 'app-produit',
  styleUrl: './produit.css',
  templateUrl: './produit.html',
})
export class Produit implements OnInit, OnDestroy {
  gameService = inject(GameService);
  // prod est un signal qui représente le produit (donné par le composant parent app)
  prod = input<Product | undefined>();

  // temps restant avant la fin de la production en cours (en ms). 0 = pas en production
  timeleft = signal(0);
  // date du dernier calcul (en ms, avec performance.now())
  lastupdate = 0;
  // vitesse du produit au dernier calcul (pour détecter un bonus de vitesse)
  vitesseConnue = 0;
  // identifiant du setInterval, pour pouvoir l'arrêter
  intervalId: any;

  // pourcentage de remplissage de la barre (de 0 à 100), recalculé tout seul quand timeleft change
  progress = computed(() => {
    const p = this.prod();
    if (!p || this.timeleft() === 0) return 0;
    return ((p.vitesse - this.timeleft()) / p.vitesse) * 100;
  });

  // ---------------------------------------------------------------
  // ACHAT
  // ---------------------------------------------------------------
  // position du commutateur d'achat, donnée par le composant parent app : 'x1', 'x10', 'x100' ou 'Max'
  qtmulti = input('x1');

  // nombre max d'exemplaires achetables avec l'argent actuel
  maxCanBuy = computed(() => {
    const p = this.prod();
    const money = this.gameService.world()?.money ?? 0;
    if (!p) return 0;
    return this.gameService.maxAchetable(p, money);
  });

  // combien on achète en cliquant sur Buy
  numberToBuy = computed(() => {
    if (this.qtmulti() === 'Max') return this.maxCanBuy();
    return Number(this.qtmulti().substring(1)); // 'x10' -> '10' -> 10
  });

  // prix total de cet achat
  coutAchat = computed(() => {
    const p = this.prod();
    if (!p) return 0;
    return this.gameService.coutAchat(p, this.numberToBuy());
  });

  // a-t-on assez d'argent ? (sert à activer / désactiver le bouton Buy)
  canBuy = computed(() => {
    const money = this.gameService.world()?.money ?? 0;
    return this.numberToBuy() > 0 && money >= this.coutAchat();
  });

  acheter() {
    const p = this.prod();
    if (!p || !this.canBuy()) return;
    this.gameService.buyProduct(p, this.numberToBuy());
  }

  // ---------------------------------------------------------------
  // PRODUCTION
  // ---------------------------------------------------------------
  constructor() {
    // à chaque fois que le monde arrive du serveur (chargement, changement de joueur, Refresh),
    // on reprend la production là où le serveur dit qu'elle en est
    effect(() => {
      const mondeServeur = this.gameService.worldQuery.data()?.getWorld;
      // untracked : on lit l'id du produit sans relancer l'effet à chaque changement du produit
      const id = untracked(() => this.prod()?.id);
      const prodServeur = mondeServeur?.products.find((p) => p.id === id);
      if (prodServeur) {
        this.timeleft.set(prodServeur.timeleft);
        this.vitesseConnue = prodServeur.vitesse;
        this.lastupdate = performance.now();
      }
    });
  }

  ngOnInit() {
    this.lastupdate = performance.now();
    // boucle principale : on recalcule tous les dixièmes de seconde
    this.intervalId = setInterval(() => this.calcScore(), 100);
  }

  ngOnDestroy() {
    clearInterval(this.intervalId);
  }

  // clic sur le produit : on lance la production
  startFabrication() {
    const p = this.prod();
    if (!p) return;
    if (p.quantite === 0) return; // on ne possède pas encore ce produit
    if (this.timeleft() > 0) return; // déjà en production
    if (p.managerUnlocked) return; // le manager s'en occupe déjà
    this.timeleft.set(p.vitesse);
    this.gameService.lancerProductionGraphQL(p.id); // on prévient le backend
  }

  // calcule ce qui s'est passé depuis le dernier appel (même logique que updateWorld du backend)
  calcScore() {
    const p = this.prod();
    if (!p) return;
    const now = performance.now();
    const elapsed = now - this.lastupdate;
    this.lastupdate = now;

    // un bonus de vitesse vient d'être débloqué : la production en cours accélère aussi
    if (this.vitesseConnue !== 0 && p.vitesse !== this.vitesseConnue) {
      this.timeleft.set((this.timeleft() * p.vitesse) / this.vitesseConnue);
    }
    this.vitesseConnue = p.vitesse;

    if (!p.managerUnlocked) {
      // SANS manager : une seule production à la fois
      if (this.timeleft() > 0) {
        const reste = this.timeleft() - elapsed;
        if (reste <= 0) {
          this.timeleft.set(0);
          this.gameService.productionDone(p, 1);
        } else {
          this.timeleft.set(reste);
        }
      }
    } else {
      // AVEC manager : la production se relance toute seule en boucle
      const dejaFait = this.timeleft() > 0 ? p.vitesse - this.timeleft() : 0;
      const tempsTotal = dejaFait + elapsed;
      const cycles = Math.floor(tempsTotal / p.vitesse); // nb de productions terminées
      if (cycles > 0) {
        this.gameService.productionDone(p, cycles);
      }
      this.timeleft.set(p.vitesse - (tempsTotal % p.vitesse));
    }
  }
}