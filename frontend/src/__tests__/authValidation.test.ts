import { describe, it, expect } from "vitest";
import {
  validateEmail,
  validatePassword,
  validatePasswordMatch,
} from "../utils/authValidation";

describe("validateEmail", () => {
  it("returns emailRequired for empty string", () => {
    expect(validateEmail("")).toBe("emailRequired");
    expect(validateEmail("   ")).toBe("emailRequired");
  });

  it("returns emailInvalid for malformed addresses", () => {
    expect(validateEmail("notanemail")).toBe("emailInvalid");
    expect(validateEmail("missing@tld")).toBe("emailInvalid");
    expect(validateEmail("@nodomain.com")).toBe("emailInvalid");
  });

  it("returns null for valid email addresses", () => {
    expect(validateEmail("user@example.com")).toBeNull();
    expect(validateEmail("a+b@sub.domain.io")).toBeNull();
  });
});

describe("validatePassword", () => {
  it("returns passwordRequired for empty string", () => {
    expect(validatePassword("")).toBe("passwordRequired");
  });

  it("returns passwordMin for passwords shorter than 8 characters", () => {
    expect(validatePassword("abc")).toBe("passwordMin");
    expect(validatePassword("1234567")).toBe("passwordMin");
  });

  it("returns null for passwords 8 characters or longer", () => {
    expect(validatePassword("12345678")).toBeNull();
    expect(validatePassword("strongpass!")).toBeNull();
  });
});

describe("validatePasswordMatch", () => {
  it("returns confirmRequired when confirm is empty", () => {
    expect(validatePasswordMatch("password123", "")).toBe("confirmRequired");
  });

  it("returns passwordsMismatch when passwords differ", () => {
    expect(validatePasswordMatch("password123", "different")).toBe("passwordsMismatch");
  });

  it("returns null when passwords match", () => {
    expect(validatePasswordMatch("password123", "password123")).toBeNull();
  });
});
