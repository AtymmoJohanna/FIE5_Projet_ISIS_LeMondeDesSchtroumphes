import { EnvironmentProviders, inject, makeEnvironmentProviders } from '@angular/core';
import { InMemoryCache, provideApollo, withApolloOptions } from '@apollo-orbit/angular';
import { HttpLinkFactory, withHttpLink } from '@apollo-orbit/angular/http';
export function provideGraphQL(): EnvironmentProviders {
    return makeEnvironmentProviders([
        provideApollo(
            withApolloOptions(() => {
                const httpLinkFactory = inject(HttpLinkFactory);
                const httpLink = httpLinkFactory.create({ uri: 'http://localhost:3000/graphql' })
                return {
                    cache: new InMemoryCache(),
                    link: httpLink
                };
            }),
            withHttpLink()
        )
    ]);
}