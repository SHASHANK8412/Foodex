import { gql } from "@apollo/client/core";

export const GET_RESTAURANTS = gql`
  query GetRestaurants {
    restaurants {
      id
      name
      description
      cuisine
      featured
    }
  }
`;
