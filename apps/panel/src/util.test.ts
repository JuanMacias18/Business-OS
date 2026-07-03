import { describe, expect, it } from "vitest";
import { greetTenant } from "./util";

describe("greetTenant", () => {
  it("saluda por nombre", () => {
    expect(greetTenant("MysaasTech")).toBe("Hola, MysaasTech");
  });
});
