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
        const prod = this.service.acheterQtProduit(user, id, quantite);
        return prod;
    }
    @Mutation()
    async lancerProductionProduit(
        @Args('user') user: string,
        @Args('id') id: number,
    ) {
        const prod = this.service.lancerProductionProduit(user, id);
        return prod;
    }
    @Mutation()
    async engagerManager(
        @Args('user') user: string,
        @Args('palier') palier: Palier,
    ) {
        const manager = this.service.engagerManager(user, palier);
        return manager;
    }
}
