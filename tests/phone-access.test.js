import { describe, it, expect } from "vitest";
import { codesMatch, createPhoneGate, formatCode, generateCode, normalizeCode } from "../server/phone-access.js";

const fakeReq = ({ ip = "192.168.1.20", path = "/", query = {}, cookie = "", body } = {}) => ({
  socket: { remoteAddress: ip },
  path,
  query,
  body,
  headers: { cookie },
});
const fakeRes = () => {
  const res = { statusCode: 200, headers: {}, body: null };
  res.status = (c) => ((res.statusCode = c), res);
  res.type = () => res;
  res.send = (b) => ((res.body = b), res);
  res.json = (b) => ((res.body = b), res);
  res.setHeader = (k, v) => (res.headers[k] = v);
  res.redirect = (c, url) => ((res.statusCode = c), (res.location = url), res);
  return res;
};

describe("access codes", () => {
  it("generates 8-char unambiguous codes", () => {
    for (let i = 0; i < 50; i++) expect(generateCode()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
  });
  it("matches case- and dash-insensitively", () => {
    expect(normalizeCode("abcd-2345")).toBe("ABCD2345");
    expect(codesMatch("abcd-2345", "ABCD2345")).toBe(true);
    expect(codesMatch("ABCD2346", "ABCD2345")).toBe(false);
    expect(codesMatch("", "ABCD2345")).toBe(false);
    expect(formatCode("ABCD2345")).toBe("ABCD-2345");
  });
});

describe("phone gate", () => {
  const code = "ABCD2345";
  it("always lets the Mac itself in", () => {
    const gate = createPhoneGate({ code });
    let passed = false;
    gate.middleware(fakeReq({ ip: "127.0.0.1" }), fakeRes(), () => (passed = true));
    expect(passed).toBe(true);
  });
  it("locks other devices without the code", () => {
    const gate = createPhoneGate({ code });
    const res = fakeRes();
    gate.middleware(fakeReq(), res, () => {});
    expect(res.statusCode).toBe(401);
    const api = fakeRes();
    gate.middleware(fakeReq({ path: "/api/health" }), api, () => {});
    expect(api.body.error).toMatch(/Locked/);
  });
  it("unlocks with ?key= and sets a cookie", () => {
    const gate = createPhoneGate({ code });
    const res = fakeRes();
    let passed = false;
    gate.middleware(fakeReq({ query: { key: "abcd-2345" } }), res, () => (passed = true));
    expect(passed).toBe(true);
    expect(res.headers["Set-Cookie"]).toMatch(/cih_access=ABCD2345.*HttpOnly/);
  });
  it("accepts the cookie afterwards", () => {
    const gate = createPhoneGate({ code });
    let passed = false;
    gate.middleware(fakeReq({ cookie: "x=1; cih_access=ABCD2345" }), fakeRes(), () => (passed = true));
    expect(passed).toBe(true);
  });
  it("rate-limits wrong codes", () => {
    const gate = createPhoneGate({ code });
    for (let i = 0; i < 10; i++) gate.unlockHandler(fakeReq({ body: { code: "WRONG000" } }), fakeRes());
    const res = fakeRes();
    gate.unlockHandler(fakeReq({ body: { code } }), res); // even the right code is refused while locked
    expect(res.statusCode).toBe(429);
  });
  it("lets public paths (icons) through", () => {
    const gate = createPhoneGate({ code, publicPaths: ["/icons/"] });
    let passed = false;
    gate.middleware(fakeReq({ path: "/icons/icon-192.png" }), fakeRes(), () => (passed = true));
    expect(passed).toBe(true);
  });
});
