import { Injectable, Service, inject, signal, linkedSignal } from '@angular/core';
import { Apollo } from '@apollo-orbit/angular';
import { GET_WORLD_QUERY } from './graphql';

@Injectable({ providedIn: 'root' })
@Service()
export class GameService {
    private readonly apollo = inject(Apollo);

    user = signal('Schtroumpfette ');
    server = signal('http://localhost:3000');

    worldQuery = this.apollo.signal.query({
        query: GET_WORLD_QUERY,
        variables: () => ({ user: this.user() }),
    });
    world = linkedSignal(() => this.worldQuery.data()?.getWorld);
}
