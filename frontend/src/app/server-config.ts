import { signal } from '@angular/core';

// adresse du backend, partagée par Apollo (requêtes) et GameService (images).
// elle est retenue dans le navigateur entre deux visites.
export const serverUrl = signal(localStorage.getItem('server') ?? 'http://localhost:3000');

// les serveurs proposés dans le menu (nom affiché + adresse de base, sans /graphql)
export const SERVEURS = [
  { nom: 'Schtroumpf-Backend', url: 'http://localhost:3000' },
  { nom: 'LA-Backend', url: 'https://capitalist.lucaslopvet.fr' },
];