import { formatCurrency, formatDateTime } from "./format";

describe("format utils", () => {
  test("formatCurrency returns INR format", () => {
    expect(formatCurrency(123)).toContain("₹");
  });

  test("formatDateTime returns empty for null", () => {
    expect(formatDateTime(null)).toBe("");
  });
});
