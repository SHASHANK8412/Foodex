import { ApolloClient, InMemoryCache, HttpLink, ApolloLink } from "@apollo/client/core";

const graphqlUrl = import.meta.env.VITE_GRAPHQL_URL || "http://localhost:5000/graphql";

const authLink = new ApolloLink((operation, forward) => {
  const token = localStorage.getItem("foodex_token");
  operation.setContext(({ headers = {} }) => ({
    headers: {
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }));
  return forward(operation);
});

const httpLink = new HttpLink({
  uri: graphqlUrl,
});

const apolloClient = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});

export default apolloClient;
