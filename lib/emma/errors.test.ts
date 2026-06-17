import { describe, expect, it } from "vitest";
import { emmaErrors, emmaFail, emmaOk, toEmmaErrorShape } from "@/lib/emma/errors";

describe("EMMA error serialization", () => {
  it("serializes a typed EmmaError to code + message only", () => {
    expect(toEmmaErrorShape(emmaErrors.forbidden("nope"))).toEqual({ code: "FORBIDDEN", message: "nope" });
  });

  it("collapses unknown errors to a generic INTERNAL shape without leaking details", () => {
    const shape = toEmmaErrorShape(new Error("postgres://user:supersecret@host/db"));
    expect(shape.code).toBe("INTERNAL");
    expect(shape.message).toBe("Unexpected EMMA error.");
    expect(JSON.stringify(shape)).not.toContain("supersecret");
  });

  it("wraps success and failure without serializing secrets", () => {
    expect(emmaOk(5)).toEqual({ ok: true, data: 5 });

    const failed = emmaFail(new Error("api_key=sk-secret-value"));
    expect(failed.ok).toBe(false);
    expect(JSON.stringify(failed)).not.toContain("sk-secret-value");
  });
});
