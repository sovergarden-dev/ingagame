import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getDeals, getNews, getReleases, requireFeedSuccess } from "./feed";
import type { ContentFeedResult } from "./feed";

export const CONTENT_FEED_KEY = {
  releases: ["content-feed", "releases"] as const,
  deals: ["content-feed", "deals"] as const,
  news: ["content-feed", "news"] as const,
};

const FEED_QUERY = {
  staleTime: 60_000,
  placeholderData: keepPreviousData,
  retry: 1,
} as const;

export function useReleasesFeed() {
  return useQuery({
    queryKey: CONTENT_FEED_KEY.releases,
    queryFn: async () => requireFeedSuccess(await getReleases()),
    ...FEED_QUERY,
  });
}

export function useDealsFeed() {
  return useQuery({
    queryKey: CONTENT_FEED_KEY.deals,
    queryFn: async () => requireFeedSuccess(await getDeals()),
    ...FEED_QUERY,
  });
}

export function useNewsFeed() {
  return useQuery({
    queryKey: CONTENT_FEED_KEY.news,
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
