import { EnvironmentProviders, inject, makeEnvironmentProviders } from '@angular/core';
import { InMemoryCache, provideApollo, withApolloOptions } from '@apollo-orbit/angular';
import { HttpLinkFactory, withHttpLink } from '@apollo-orbit/angular/http';
import { serverUrl } from '../server-config';

export function provideGraphQL(): EnvironmentProviders {
    return makeEnvironmentProviders([
        provideApollo(
            withApolloOptions(() => {
                const httpLinkFactory = inject(HttpLinkFactory);
                
                const httpLink = httpLinkFactory.create({ uri: () => serverUrl() + '/graphql', })
                //const httpLink = httpLinkFactory.create({ uri: 'https://capitalist.lucaslopvet.fr/graphql' })
                return {
                    cache: new InMemoryCache(),
                    link: httpLink
                };
            }),
            withHttpLink()
        )
    ]);
}