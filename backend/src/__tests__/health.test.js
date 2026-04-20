process.env.NODE_ENV = "test";

const request = require("supertest");
const app = require("../app");

describe("Health endpoint", () => {
  test("GET /api/health returns success", async () => {
    const response = await request(app).get("/api/health");
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
