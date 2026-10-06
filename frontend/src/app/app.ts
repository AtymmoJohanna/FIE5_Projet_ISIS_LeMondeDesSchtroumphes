import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BigvaluePipe } from './bigvalue-pipe';
import { Produit } from './produit/produit';
import { MatBadge } from '@angular/material/badge';
import { MatButton } from '@angular/material/button';
import { FormField } from '@angular/forms/signals';
import { GameService } from './game-service';

@Component({
  imports: [RouterOutlet, BigvaluePipe, Produit, MatBadge, MatButton, FormField],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('frontend');
  
  gameService = inject(GameService); // injection du service
  world = this.gameService.world; // copie du signal dans la composant pour plus de facilité

}
