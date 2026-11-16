import { isValidIndianMobile, normalizeIndianMobile } from "./checkoutDetails";
import { buildCheckoutConfig } from "../services/payment";

describe("Indian mobile numbers", () => {
  test.each([
    ["9876543210", true],
    ["+91 98765 43210", true],
    ["098765-43210", true],
    ["5876543210", false],
    ["98765", false],
    ["", false],
  ])("%p is valid: %p", (value, valid) => {
    expect(isValidIndianMobile(value)).toBe(valid);
  });

  test("normalizes to ten digits", () => {
    expect(normalizeIndianMobile("+91 98765 43210")).toBe("9876543210");
  });
});

describe("Razorpay checkout config", () => {
  test("opens on UPI with QR and app intent, and hides the deprecated collect flow", () => {
    const config = buildCheckoutConfig("upi");

    expect(config.display.sequence[0]).toBe("block.upi");
    expect(config.display.blocks.upi.instruments[0]).toEqual(
      expect.objectContaining({ method: "upi", flows: ["qr", "intent"] })
    );
    expect(config.display.hide).toEqual([{ method: "upi", flows: ["collect"] }]);
  });

  test("puts the chosen method first and keeps the others", () => {
    const config = buildCheckoutConfig("card");
    expect(config.display.sequence).toEqual(["block.card", "block.upi", "block.netbanking", "block.wallet"]);
  });

  test("falls back to UPI for an unknown method", () => {
    expect(buildCheckoutConfig("cash").display.sequence[0]).toBe("block.upi");
  });
});
