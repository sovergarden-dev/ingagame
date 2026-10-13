import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/auth/AuthProvider";
import {
  PRIVATE_DATA_KEYS,
  privateDataOnAccountChange,
  type PrivateBag,
  type PrivateStore,
} from "@/domain/private-data";

const STORE_KEY = "inga.privateStore";
const USER_KEY = "inga.privateUser";

function readActive(): PrivateBag {
  const bag: PrivateBag = {};
  for (const key of PRIVATE_DATA_KEYS) {
    const value = window.localStorage.getItem(key);
    if (value !== null) bag[key] = value;
  }
  return bag;
}

function writeActive(bag: PrivateBag) {
  for (const key of PRIVATE_DATA_KEYS) {
    const value = bag[key];
    if (value === undefined) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  }
}

function readStore(): PrivateStore {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return { device: {}, accounts: {} };
    const parsed = JSON.parse(raw) as PrivateStore;
    return {
      device: parsed.device ?? {},
      accounts: parsed.accounts ?? {},
    };
  } catch {
    return { device: {}, accounts: {} };
  }
}

/** Keeps muted games, hidden games, and seen alerts with the account that created them. */
export function PrivateDataGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    const nextId = user?.id ?? null;
    const marker = window.sessionStorage.getItem(USER_KEY);
    if (marker === null) {
      window.sessionStorage.setItem(USER_KEY, nextId ?? "anonymous");
      return;
    }
    const previousId = marker === "anonymous" ? null : marker;
    if (previousId === nextId) return;
    const result = privateDataOnAccountChange({
      previousUserId: previousId,
      nextUserId: nextId,
      store: readStore(),
      active: readActive(),
    });
    writeActive(result.active);
    window.localStorage.setItem(STORE_KEY, JSON.stringify(result.store));
    window.sessionStorage.setItem(USER_KEY, nextId ?? "anonymous");
    window.location.reload();
  }, [loading, user?.id]);

  return children;
}
