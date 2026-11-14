process.env.NODE_ENV = "test";

const request = require("supertest");
const app = require("../app");

describe("Health endpoint", () => {
  test.each(["/", "/api"])("GET %s describes the API instead of a 404", async (url) => {
    const response = await request(app).get(url);
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({ service: "Foodex API", status: "running" }));
    expect(response.body.docs).toMatch(/\/api\/docs$/);
  });

  test("GET /api/health returns success", async () => {
    const response = await request(app).get("/api/health");
    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
