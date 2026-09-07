import { useQuery } from "@tanstack/react-query";
import { getDeals, getNews, getReleases } from "./feed";

export const CONTENT_FEED_KEY = {
  releases: ["content-feed", "releases"] as const,
  deals: ["content-feed", "deals"] as const,
  news: ["content-feed", "news"] as const,
};

export function useReleasesFeed() {
  return useQuery({
    queryKey: CONTENT_FEED_KEY.releases,
    queryFn: () => getReleases(),
    staleTime: 60_000,
  });
}

export function useDealsFeed() {
  return useQuery({
    queryKey: CONTENT_FEED_KEY.deals,
    queryFn: () => getDeals(),
    staleTime: 60_000,
  });
}

export function useNewsFeed() {
  return useQuery({
    queryKey: CONTENT_FEED_KEY.news,
    queryFn: () => getNews(),
    staleTime: 60_000,
  });
}
