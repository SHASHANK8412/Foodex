// End-to-end order flow through the HTTP API against a real (in-memory) MongoDB:
// pricing and coupons, ordering, payment, rider assignment, delivery, and the
// permission rules around them.

const harness = require("./helpers/testServer");
const request = require("supertest");

const User = require("../models/User");
const Restaurant = require("../models/Restaurant");
const MenuItem = require("../models/MenuItem");
const Order = require("../models/Order");
const { ensureDemoCoupons } = require("../services/pricingService");

jest.setTimeout(120000);

let app;
const fixture = {};

const login = async (email, password) => {
  const response = await request(app).post("/api/auth/login").send({ email, password });
  expect(response.status).toBe(200);
  return response.body.data.token;
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });

const address = { line1: "12 MG Road", city: "Bengaluru", state: "Karnataka", postalCode: "560001" };

beforeAll(async () => {
  app = await harness.start();
});

afterAll(async () => {
  await harness.stop();
});

beforeEach(async () => {
  await harness.clearDatabase();
  await ensureDemoCoupons();

  const [admin, customer, otherCustomer, busyRider, idleRider, offlineRider] = await User.create([
    { name: "Admin", email: "admin@test.dev", password: "secret123", role: "admin" },
    { name: "Asha", email: "asha@test.dev", password: "secret123", role: "user" },
    { name: "Ravi", email: "ravi@test.dev", password: "secret123", role: "user" },
    { name: "Busy Rider", email: "busy@test.dev", password: "secret123", role: "delivery", deliveryPartnerProfile: { isAvailable: true } },
    { name: "Idle Rider", email: "idle@test.dev", password: "secret123", role: "delivery", deliveryPartnerProfile: { isAvailable: true } },
    { name: "Offline Rider", email: "offline@test.dev", password: "secret123", role: "delivery", deliveryPartnerProfile: { isAvailable: false } },
  ]);

  const restaurant = await Restaurant.create({
    name: "Dragon Bowl",
    address: { line1: "1 Church St", city: "Bengaluru", state: "Karnataka", postalCode: "560001" },
    createdBy: admin._id,
    isOpen: true,
    promotions: [{ title: "Noodle week", code: "NOODLE15", discountPercent: 15, active: true }],
  });
  const [noodles, rolls, unavailable] = await MenuItem.create([
    { restaurant: restaurant._id, name: "Hakka Noodles", category: "Noodles", price: 200, isAvailable: true },
    { restaurant: restaurant._id, name: "Spring Rolls", category: "Starters", price: 150, isAvailable: true },
    { restaurant: restaurant._id, name: "Sold Out Soup", category: "Soups", price: 120, isAvailable: false },
  ]);

  // The busy rider already has an active delivery, so a new order should go to the idle one.
  await Order.create({
    user: otherCustomer._id,
    restaurant: restaurant._id,
    items: [{ menuItem: noodles._id, name: "Hakka Noodles", quantity: 1, price: 200 }],
    deliveryAddress: address,
    subtotal: 200,
    taxAmount: 10,
    deliveryFee: 40,
    totalAmount: 250,
    status: "preparing",
    paymentStatus: "paid",
    deliveryPartner: busyRider._id,
  });

  Object.assign(fixture, { admin, customer, otherCustomer, busyRider, idleRider, offlineRider, restaurant, noodles, rolls, unavailable });
});

const cart = (lines) => ({
  restaurantId: String(fixture.restaurant._id),
  items: lines.map(([item, quantity]) => ({ menuItemId: String(item._id), quantity })),
});

describe("pricing", () => {
  test("prices a cart from database prices, with 5% tax and a ₹40 delivery fee", async () => {
    const response = await request(app).post("/api/pricing/quote").send(cart([[fixture.noodles, 2], [fixture.rolls, 1]]));

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(
      expect.objectContaining({ subtotal: 550, discount: 0, taxAmount: 27.5, deliveryFee: 40, totalAmount: 617.5, coupon: null })
    );
  });

  test("ignores any price the client sends", async () => {
    const tampered = cart([[fixture.noodles, 1]]);
    tampered.items[0].price = 1;

    const response = await request(app).post("/api/pricing/quote").send(tampered);

    expect(response.body.data.subtotal).toBe(200);
  });

  test("applies a percentage coupon with its cap", async () => {
    const response = await request(app)
      .post("/api/pricing/quote")
      .send({ ...cart([[fixture.noodles, 4]]), couponCode: "foodex30" });

    // 30% of 800 is 240, capped at 150; tax is charged on the discounted subtotal.
    expect(response.body.data).toEqual(
      expect.objectContaining({ subtotal: 800, discount: 150, taxAmount: 32.5, totalAmount: 722.5 })
    );
    expect(response.body.data.coupon).toEqual(expect.objectContaining({ code: "FOODEX30", valid: true, savings: 150 }));
  });

  test("explains why a coupon does not apply instead of failing the quote", async () => {
    const response = await request(app)
      .post("/api/pricing/quote")
      .send({ ...cart([[fixture.rolls, 1]]), couponCode: "FOODEX30" });

    expect(response.status).toBe(200);
    expect(response.body.data.discount).toBe(0);
    expect(response.body.data.coupon).toEqual(
      expect.objectContaining({ valid: false, reason: expect.stringContaining("₹149 more") })
    );
  });

  test("free-delivery coupons remove the delivery fee", async () => {
    const response = await request(app)
      .post("/api/pricing/quote")
      .send({ ...cart([[fixture.rolls, 1]]), couponCode: "FASTFREE" });

    expect(response.body.data).toEqual(expect.objectContaining({ deliveryFee: 0, discount: 40, totalAmount: 157.5 }));
  });

  test("restaurant promotions work as coupons at that restaurant", async () => {
    const response = await request(app)
      .post("/api/pricing/quote")
      .send({ ...cart([[fixture.noodles, 1]]), couponCode: "NOODLE15" });

    expect(response.body.data.discount).toBe(30);
    expect(response.body.data.coupon.source).toBe("restaurant");
  });

  test("first-order coupons need a signed-in customer", async () => {
    const response = await request(app)
      .post("/api/pricing/quote")
      .send({ ...cart([[fixture.noodles, 1]]), couponCode: "WELCOME100" });

    expect(response.body.data.coupon).toEqual(expect.objectContaining({ valid: false, reason: "Sign in to use this coupon." }));
  });

  test("rejects unavailable items", async () => {
    const response = await request(app).post("/api/pricing/quote").send(cart([[fixture.unavailable, 1]]));

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Some menu items are unavailable");
    expect(response.body.requestId).toEqual(expect.any(String));
  });

  test("lists offers that can be used right now", async () => {
    const response = await request(app).get("/api/pricing/offers");
    const codes = response.body.data.map((offer) => offer.code);

    expect(codes).toEqual(expect.arrayContaining(["FOODEX30", "FASTFREE", "WELCOME100", "NOODLE15"]));
  });
});

describe("order lifecycle", () => {
  const placeOrder = async (token, lines, couponCode) =>
    request(app)
      .post("/api/orders")
      .set(auth(token))
      .send({ ...cart(lines), couponCode, deliveryAddress: address });

  const pay = async (token, placed) =>
    request(app).post("/api/orders/verify-payment").set(auth(token)).send({
      orderId: placed.order._id,
      razorpayOrderId: placed.payment.razorpayOrderId,
      razorpayPaymentId: "pay_test",
      razorpaySignature: "sig_test",
    });

  test("charges exactly the quoted total, coupon included", async () => {
    const token = await login("asha@test.dev", "secret123");
    const lines = [[fixture.noodles, 2], [fixture.rolls, 1]];

    const quote = await request(app).post("/api/pricing/quote").set(auth(token)).send({ ...cart(lines), couponCode: "WELCOME100" });
    const placed = await placeOrder(token, lines, "WELCOME100");

    expect(placed.status).toBe(201);
    expect(placed.body.data.order.totalAmount).toBe(quote.body.data.totalAmount);
    expect(placed.body.data.order).toEqual(expect.objectContaining({ couponCode: "WELCOME100", discountAmount: 100 }));
    // Razorpay takes the amount in paise.
    expect(placed.body.data.payment.amount).toBe(Math.round(quote.body.data.totalAmount * 100));
  });

  test("payment confirms the order and assigns the least busy available rider", async () => {
    const token = await login("asha@test.dev", "secret123");
    const placed = (await placeOrder(token, [[fixture.noodles, 1]])).body.data;

    let order = await Order.findById(placed.order._id);
    expect(order.deliveryPartner).toBeUndefined(); // unpaid orders get no rider

    const paid = await pay(token, placed);
    expect(paid.status).toBe(200);

    order = await Order.findById(placed.order._id);
    expect(order.paymentStatus).toBe("paid");
    expect(order.status).toBe("confirmed");
    expect(String(order.deliveryPartner)).toBe(String(fixture.idleRider._id));
  });

  test("only the assigned rider can move the order, and only along the lifecycle", async () => {
    const customerToken = await login("asha@test.dev", "secret123");
    const placed = (await placeOrder(customerToken, [[fixture.noodles, 1]])).body.data;
    await pay(customerToken, placed);

    const statusUrl = `/api/orders/${placed.order._id}/status`;
    const busyToken = await login("busy@test.dev", "secret123");
    const idleToken = await login("idle@test.dev", "secret123");

    const stranger = await request(app).patch(statusUrl).set(auth(busyToken)).send({ status: "delivered" });
    expect(stranger.status).toBe(403);

    const customer = await request(app).patch(statusUrl).set(auth(customerToken)).send({ status: "delivered" });
    expect(customer.status).toBe(403);

    const cancelByRider = await request(app).patch(statusUrl).set(auth(idleToken)).send({ status: "cancelled" });
    expect(cancelByRider.status).toBe(403);

    const skipAhead = await request(app).patch(statusUrl).set(auth(idleToken)).send({ status: "delivered" });
    expect(skipAhead.status).toBe(400); // confirmed -> delivered skips the pick-up

    const pickedUp = await request(app).patch(statusUrl).set(auth(idleToken)).send({ status: "out_for_delivery" });
    expect(pickedUp.status).toBe(200);

    const delivered = await request(app).patch(statusUrl).set(auth(idleToken)).send({ status: "delivered" });
    expect(delivered.status).toBe(200);
    expect(delivered.body.data.status).toBe("delivered");

    const backwards = await request(app).patch(statusUrl).set(auth(await login("admin@test.dev", "secret123"))).send({ status: "preparing" });
    expect(backwards.status).toBe(400);
  });

  test("a first-order coupon cannot be used twice", async () => {
    const token = await login("asha@test.dev", "secret123");
    const first = (await placeOrder(token, [[fixture.noodles, 2]], "WELCOME100")).body.data;
    await pay(token, first);

    const second = await placeOrder(token, [[fixture.noodles, 2]], "WELCOME100");

    expect(second.status).toBe(400);
    expect(second.body.message).toBe("This coupon is only for your first order.");
  });

  test("customers only see their own orders", async () => {
    const asha = await login("asha@test.dev", "secret123");
    const ravi = await login("ravi@test.dev", "secret123");
    const placed = (await placeOrder(asha, [[fixture.rolls, 1]])).body.data;

    const own = await request(app).get(`/api/orders/${placed.order._id}`).set(auth(asha));
    const other = await request(app).get(`/api/orders/${placed.order._id}`).set(auth(ravi));
    const list = await request(app).get("/api/orders").set(auth(ravi));

    expect(own.status).toBe(200);
    expect(other.status).toBe(403);
    expect(list.body.data.every((order) => String(order.user) === String(fixture.otherCustomer._id))).toBe(true);
  });
});

describe("accounts and riders", () => {
  test("registration cannot choose a role or account state", async () => {
    const response = await request(app).post("/api/auth/register").send({
      name: "Mallory",
      email: "mallory@test.dev",
      password: "secret123",
      role: "admin",
      isActive: false,
    });

    expect(response.status).toBe(201);
    const user = await User.findOne({ email: "mallory@test.dev" });
    expect(user.role).toBe("user");
    expect(user.isActive).toBe(true);
  });

  test("riders can go offline and back", async () => {
    const token = await login("idle@test.dev", "secret123");

    const offline = await request(app).put("/api/delivery/availability").set(auth(token)).send({ isAvailable: false });
    const me = await request(app).get("/api/delivery/me").set(auth(token));

    expect(offline.status).toBe(200);
    expect(me.body.data.isAvailable).toBe(false);
  });

  test("users loaded without their password can still be saved", async () => {
    // Regression: the save hook used to demand a password on every save, and
    // the password is never selected by default.
    const user = await User.findById(fixture.customer._id);
    user.phone = "+91-9000000009";

    await expect(user.save()).resolves.toBeTruthy();
    expect(await (await User.findById(fixture.customer._id).select("+password")).comparePassword("secret123")).toBe(true);
  });

  test("availability is for riders only", async () => {
    const token = await login("asha@test.dev", "secret123");
    const response = await request(app).put("/api/delivery/availability").set(auth(token)).send({ isAvailable: true });

    expect(response.status).toBe(403);
  });
});

describe("health and errors", () => {
  test("readiness reports MongoDB up", async () => {
    const response = await request(app).get("/api/health/ready");

    expect(response.status).toBe(200);
    expect(response.body.checks.mongo.status).toBe("up");
  });

  test("malformed ids and JSON are client errors, not 500s", async () => {
    const token = await login("asha@test.dev", "secret123");

    const badId = await request(app).get("/api/orders/not-an-id").set(auth(token));
    const badJson = await request(app).post("/api/pricing/quote").set("Content-Type", "application/json").send("{oops");

    expect(badId.status).toBe(400);
    expect(badJson.status).toBe(400);
    expect(badJson.body.message).toBe("Malformed JSON body");
  });
});
