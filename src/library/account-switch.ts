export type LibraryLists = { wishlist: string[]; following: string[] };

export const EMPTY_LIBRARY: LibraryLists = { wishlist: [], following: [] };

/**
 * Anonymous lists stay on the device. An account list never becomes the next
 * account's upload, and logout restores the device list.
 */
export function libraryOnAccountChange(input: {
  previousUserId: string | null;
  nextUserId: string | null;
  current: LibraryLists;
  anonymous: LibraryLists;
  account: LibraryLists | null;
}): { current: LibraryLists; anonymous: LibraryLists } {
  if (!input.nextUserId) {
    return { current: input.anonymous, anonymous: input.anonymous };
  }
  if (input.previousUserId && input.previousUserId !== input.nextUserId) {
    return { current: input.account ?? EMPTY_LIBRARY, anonymous: input.anonymous };
  }
  if (!input.previousUserId) {
    const accountEmpty =
      !input.account ||
      (input.account.wishlist.length === 0 && input.account.following.length === 0);
    if (accountEmpty) return { current: input.current, anonymous: input.current };
    return { current: input.account ?? EMPTY_LIBRARY, anonymous: input.current };
  }
  return { current: input.current, anonymous: input.anonymous };
}
