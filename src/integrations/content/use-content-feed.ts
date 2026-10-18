import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  allowMockContentFeed,
  getDeals,
  getFreeOffers,
  getNews,
  getReleases,
  requireFeedSuccess,
  type ContentFeedResult,
  type ContentKind,
  type ViteEnvSlice,
} from "./feed.ts";

export function getEffectiveFeedMode(
  env = (import.meta.env ?? {}) as ViteEnvSlice,
): "live" | "mock" | "hybrid" {
  if (!allowMockContentFeed(env)) return "live";
  if (env.VITE_CONTENT_FEED_MOCK === "1") return "mock";
  return "hybrid";
}

export function contentFeedQueryKey(
  kind: ContentKind,
  mode: string = getEffectiveFeedMode(),
  subScope?: string,
) {
  return subScope
    ? (["content-feed", mode, kind, subScope] as const)
    : (["content-feed", mode, kind] as const);
}

export const CONTENT_FEED_KEY = {
  releases: contentFeedQueryKey("releases"),
  deals: contentFeedQueryKey("deals"),
  free: contentFeedQueryKey("deals", getEffectiveFeedMode(), "free"),
  news: contentFeedQueryKey("news"),
};

const FEED_QUERY = {
  staleTime: 60_000,
  placeholderData: keepPreviousData,
  retry: 1,
} as const;

export function useReleasesFeed() {
  return useQuery({
    queryKey: contentFeedQueryKey("releases"),
    queryFn: async () => requireFeedSuccess(await getReleases()),
    ...FEED_QUERY,
  });
}

export function useDealsFeed() {
  return useQuery({
    queryKey: contentFeedQueryKey("deals"),
    queryFn: async () => requireFeedSuccess(await getDeals()),
    ...FEED_QUERY,
  });
}

export function useFreeOffersFeed() {
  return useQuery({
    queryKey: contentFeedQueryKey("deals", getEffectiveFeedMode(), "free"),
    queryFn: async () => requireFeedSuccess(await getFreeOffers()),
    ...FEED_QUERY,
  });
}

export function useNewsFeed() {
  return useQuery({
    queryKey: contentFeedQueryKey("news"),
    queryFn: async () => requireFeedSuccess(await getNews()),
    ...FEED_QUERY,
  });
}

export function feedGateProps(query: {
  isPending: boolean;
  isError: boolean;
  data: ContentFeedResult<unknown> | undefined;
  refetch: () => unknown;
}) {
  return {
    isPending: query.isPending,
    isError: query.isError,
    result: query.data,
    onRetry: () => {
      void query.refetch();
    },
  };
}

export type ContentFeedQuery = UseQueryResult<ContentFeedResult<unknown>>;
