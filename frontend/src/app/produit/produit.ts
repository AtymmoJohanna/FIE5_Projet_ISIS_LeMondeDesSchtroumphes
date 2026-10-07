import { Component } from '@angular/core';
import { BigvaluePipe } from '../bigvalue-pipe';
import { SecondPipe } from '../second-pipe';
import { inject } from '@angular/core';
import { GameService } from '../game-service';
import { input } from '@angular/core';
import { Product } from '../graphql';

@Component({
  imports: [BigvaluePipe, SecondPipe],
  selector: 'app-produit',
  styleUrl: './produit.css',
  templateUrl: './produit.html',
})
export class Produit {
  gameService = inject(GameService);
  // prod est un signal qui représente le produit
  prod = input<Product | undefined>();

  startFabrication() {
    
  }
}
