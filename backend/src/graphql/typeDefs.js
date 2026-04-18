const typeDefs = `#graphql
  scalar DateTime

  type Restaurant {
    id: ID!
    name: String!
    description: String
    cuisine: [String!]!
    featured: Boolean
    ownerId: ID
  }

  type MenuItem {
    id: ID!
    restaurant: ID!
    name: String!
    description: String
    category: String
    price: Float!
    estimatedCost: Float
    isAvailable: Boolean!
    featured: Boolean
    imageUrl: String
  }

  type OrderItem {
    name: String!
    quantity: Int!
    price: Float!
  }

  type Order {
    id: ID!
    shortId: String
    user: User
    restaurant: Restaurant
    status: String!
    totalAmount: Float!
    createdAt: DateTime
    items: [OrderItem!]!
  }

  type User {
    id: ID!
    name: String!
    email: String!
    role: String!
  }

  input CartLineInput {
    menuItemId: ID!
    quantity: Int!
  }

  input CreateOrderInput {
    restaurantId: ID!
    items: [CartLineInput!]!
    line1: String!
    city: String!
    state: String!
    postalCode: String!
    lat: Float
    lng: Float
  }

  type Query {
    restaurants: [Restaurant!]!
    restaurant(id: ID!): Restaurant
    menuByRestaurant(restaurantId: ID!): [MenuItem!]!
    myOrders: [Order!]!
    users: [User!]!
  }

  type Mutation {
    createOrder(input: CreateOrderInput!): Order!
    toggleFeaturedMenuItem(menuItemId: ID!, featured: Boolean!): MenuItem!
  }

  type Subscription {
    orderStatusUpdated(orderId: ID!): Order!
  }
`;

module.exports = typeDefs;
