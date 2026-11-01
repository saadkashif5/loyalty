import { describe, expect, it } from "vitest";
import { logSerializers } from "@/config/logger";
import { scrubText, scrubUrl } from "@/utils/scrub";

describe("log scrubbing", () => {
  it("removes emails and Pakistani mobile numbers from text", () => {
    expect(scrubText('E11000 dup key: { email: "sara.k+1@example.com.pk" }')).toBe(
      'E11000 dup key: { email: "[email]" }',
    );
    for (const phone of ["03001234567", "+923001234567", "92 300 1234567", "0300-1234567"]) {
      expect(scrubText(`call ${phone} now`)).toBe("call [phone] now");
    }
  });

  it("leaves ordinary ids and amounts alone", () => {
    const id = "6543210fedcba9876543210f 1300123456789";
    expect(scrubText(id)).toBe(id);
  });

  it("drops query strings and invitation tokens from URLs", () => {
    expect(scrubUrl("/api/v1/invitations/abc123/accept?x=1")).toBe(
      "/api/v1/invitations/[token]/accept",
    );
    expect(scrubUrl("/api/v1/discover?search=sara@example.com")).toBe("/api/v1/discover");
  });

  it("logs only the safe parts of a request", () => {
    const line = logSerializers.req({
      id: "req-1",
      method: "POST",
      url: "/api/v1/invitations/secret-token/accept?a=b",
      headers: { authorization: "Bearer x", "x-internal-secret": "y", "x-client-ip": "1.2.3.4" },
      remoteAddress: "1.2.3.4",
    });
    expect(line).toEqual({
      id: "req-1",
      method: "POST",
      url: "/api/v1/invitations/[token]/accept",
    });
  });

  it("scrubs error messages and stacks", () => {
    const line = logSerializers.err(new Error("no user for sara@example.com"));
    expect(line.message).toBe("no user for [email]");
    expect(line.stack).not.toContain("sara@example.com");
  });
});
