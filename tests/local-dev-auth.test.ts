import { afterEach, describe, expect, it } from "vitest";

import {
  createLocalDevSession,
  isLocalDevLoginConfigured,
  isLocalDevSession,
  readLocalDevCredentials,
  validateLocalDevLogin
} from "@/lib/local-dev-auth";

const originalNodeEnv = process.env.NODE_ENV;
const originalLoginId = process.env.LOCAL_DEV_LOGIN_ID;
const originalPassword = process.env.LOCAL_DEV_PASSWORD;

function setNodeEnv(value: string | undefined) {
  Object.defineProperty(process.env, "NODE_ENV", {
    configurable: true,
    enumerable: true,
    value,
    writable: true
  });
}

afterEach(() => {
  setNodeEnv(originalNodeEnv);

  if (originalLoginId === undefined) {
    delete process.env.LOCAL_DEV_LOGIN_ID;
  } else {
    process.env.LOCAL_DEV_LOGIN_ID = originalLoginId;
  }

  if (originalPassword === undefined) {
    delete process.env.LOCAL_DEV_PASSWORD;
  } else {
    process.env.LOCAL_DEV_PASSWORD = originalPassword;
  }
});

describe("local dev auth", () => {
  it("enables local dev credentials only in development when both env values are present", () => {
    setNodeEnv("development");
    process.env.LOCAL_DEV_LOGIN_ID = "pconlocal";
    process.env.LOCAL_DEV_PASSWORD = "112233";

    expect(isLocalDevLoginConfigured()).toBe(true);
    expect(readLocalDevCredentials()).toEqual({
      loginId: "PCONLOCAL",
      password: "112233"
    });
  });

  it("returns an owner-like local dev session only for matching credentials", () => {
    setNodeEnv("development");
    process.env.LOCAL_DEV_LOGIN_ID = "PCONLOCAL";
    process.env.LOCAL_DEV_PASSWORD = "112233";

    const session = validateLocalDevLogin("pconlocal", "112233");

    expect(session).toEqual(createLocalDevSession("PCONLOCAL"));
    expect(isLocalDevSession(session)).toBe(true);
    expect(validateLocalDevLogin("PCONLOCAL", "wrong-pass")).toBeNull();
  });

  it("disables local dev login outside development", () => {
    setNodeEnv("production");
    process.env.LOCAL_DEV_LOGIN_ID = "PCONLOCAL";
    process.env.LOCAL_DEV_PASSWORD = "112233";

    expect(isLocalDevLoginConfigured()).toBe(false);
    expect(readLocalDevCredentials()).toBeNull();
    expect(validateLocalDevLogin("PCONLOCAL", "112233")).toBeNull();
  });
});
