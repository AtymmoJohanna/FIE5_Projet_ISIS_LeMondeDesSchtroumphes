import { origworld } from './origworld.js';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AppService } from './app.service.js';
import { Palier } from './graphql.js';
@Resolver('World')
export class GraphQlResolver {
    constructor(private service: AppService) { }
    @Query()
    async getWorld(@Args('user') user: string) {
        const world = this.service.readUserWorld(user);
        return world;
    }
    @Mutation()
    async acheterQtProduit(
        @Args('user') user: string,
        @Args('id') id: number,
        @Args('quantite') quantite: number,
    ) {
        try {
            const world = this.service.readUserWorld(user);
            const prod = world.products.find((p) => p.id === id);
            if(!prod) return undefined;
            prod.quantite += quantite;
            this.service.saveWorld(user, world);
            return prod;
        } catch (e: unknown) {
            console.log((e as Error).message);
            return undefined;
        }
    }
}
