import { describe, expect, it } from "vitest";
import { createSupabaseClient } from "./index";

describe("createSupabaseClient", () => {
  it("crea un cliente sin lanzar", () => {
    expect(() =>
      createSupabaseClient("https://example.supabase.co", "anon-key-placeholder"),
    ).not.toThrow();
  });
});
