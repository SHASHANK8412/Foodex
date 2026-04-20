import cartReducer, { addToCart, updateQuantity, removeFromCart, clearCart } from "./cartSlice";

describe("cartSlice", () => {
  const initialState = { items: [] };

  test("adds item to cart", () => {
    const state = cartReducer(initialState, addToCart({ menuItemId: "1", restaurantId: "r1", quantity: 2 }));
    expect(state.items[0].quantity).toBe(2);
  });

  test("updates quantity", () => {
    const state = cartReducer({ items: [{ menuItemId: "1", restaurantId: "r1", quantity: 1 }] }, updateQuantity({ menuItemId: "1", quantity: 3 }));
    expect(state.items[0].quantity).toBe(3);
  });

  test("removes item", () => {
    const state = cartReducer({ items: [{ menuItemId: "1", restaurantId: "r1", quantity: 1 }] }, removeFromCart("1"));
    expect(state.items).toHaveLength(0);
  });

  test("clears cart", () => {
    const state = cartReducer({ items: [{ menuItemId: "1", restaurantId: "r1", quantity: 1 }] }, clearCart());
    expect(state.items).toHaveLength(0);
  });
});
