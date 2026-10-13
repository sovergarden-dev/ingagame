export const PRIVATE_DATA_KEYS = [
  "inga.watchControls",
  "inga.hiddenGames",
  "inga.releaseAlerts.seen",
  "gamepulse.dealAlerts.seen",
  "inga.pins",
] as const;

export type PrivateDataKey = (typeof PRIVATE_DATA_KEYS)[number];
export type PrivateBag = Partial<Record<PrivateDataKey, string>>;

export type PrivateStore = {
  device: PrivateBag;
  accounts: Record<string, PrivateBag>;
};

/**
 * Anonymous private data stays on the device. Account A never becomes account B.
 * Logout restores the device bag.
 */
export function privateDataOnAccountChange(input: {
  previousUserId: string | null;
  nextUserId: string | null;
  store: PrivateStore;
  active: PrivateBag;
}): { store: PrivateStore; active: PrivateBag } {
  if (input.previousUserId === input.nextUserId) {
    return { store: input.store, active: input.active };
  }
  const accounts = { ...input.store.accounts };
  if (input.previousUserId) accounts[input.previousUserId] = input.active;
  if (!input.nextUserId) {
    return {
      store: { device: input.store.device, accounts },
      active: input.store.device,
    };
  }
  if (!input.previousUserId) {
    return {
      store: {
        device: input.active,
        accounts: { ...accounts, [input.nextUserId]: accounts[input.nextUserId] ?? input.active },
      },
      active: accounts[input.nextUserId] ?? input.active,
    };
  }
  return {
    store: { device: input.store.device, accounts },
    active: accounts[input.nextUserId] ?? {},
  };
}
