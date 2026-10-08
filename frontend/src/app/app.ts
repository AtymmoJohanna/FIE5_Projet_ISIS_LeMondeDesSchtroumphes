import { Component, computed, effect, inject, signal } from '@angular/core';
import { BigvaluePipe } from './bigvalue-pipe';
import { Produit } from './produit/produit';
import { MatBadge } from '@angular/material/badge';
import { MatButton } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormField } from '@angular/forms/signals';
import { GameService } from './game-service';
import { Product } from './graphql';

@Component({
  imports: [BigvaluePipe, Produit, MatBadge, MatButton, FormField],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  gameService = inject(GameService); // injection du service
  world = this.gameService.world; // copie du signal dans le composant pour plus de facilité
  private snackBar = inject(MatSnackBar); // pour afficher les petits messages en bas de l'écran

  constructor() {
    // dès que gameService.snackmessage change, on affiche le message
    effect(() => {
      const message = this.gameService.snackmessage();
      if (message !== '') {
        this.snackBar.open(message, 'ok', { duration: 2000 });
      }
    });
  }

  // ---------------------------------------------------------------
  // COMMUTATEUR D'ACHAT
  // ---------------------------------------------------------------
  // position du commutateur d'achat : 'x1', 'x10', 'x100' ou 'Max'
  qtmulti = signal('x1');

  // à chaque clic : x1 -> x10 -> x100 -> Max -> x1 ...
  changeQtMulti() {
    const positions = ['x1', 'x10', 'x100', 'Max'];
    const index = positions.indexOf(this.qtmulti());
    const suivant = (index + 1) % positions.length; // le % fait revenir à 0 après le dernier
    this.qtmulti.set(positions[suivant]);
  }

  // ---------------------------------------------------------------
  // MANAGERS
  // ---------------------------------------------------------------
  // la fenêtre des managers est-elle ouverte ?
  showManagers = signal(false);

  // nombre de managers qu'on peut engager maintenant (affiché dans le badge du bouton)
  badgeManagers = computed(() => {
    const world = this.world();
    if (!world) return 0;
    return world.managers.filter((m) => !m.unlocked && world.money >= m.seuil).length;
  });

  // nom du produit géré par un manager (idcible = id du produit)
  nomProduit(id: number): string {
    return this.world()?.products.find((p) => p.id === id)?.name ?? '';
  }

  // ---------------------------------------------------------------
  // UNLOCKS
  // ---------------------------------------------------------------
  showUnlocks = signal(false);

  // le prochain unlock pas encore débloqué d'un produit (les paliers sont rangés par seuil)
  prochainUnlock(product: Product) {
    return product.paliers.find((p) => !p.unlocked);
  }

  // le prochain allunlock pas encore débloqué
  prochainAllUnlock = computed(() => this.world()?.allunlocks.find((p) => !p.unlocked));

  // la plus petite quantité parmi tous les produits (c'est elle qui compte pour les allunlocks)
  quantiteMin = computed(() => {
    const world = this.world();
    if (!world) return 0;
    return Math.min(...world.products.map((p) => p.quantite));
  });
}