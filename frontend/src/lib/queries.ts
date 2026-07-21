import { useQuery } from "@tanstack/react-query";
import {
  dashboardApi,
  meApi,
  paymentMethodsApi,
  paymentsApi,
  questionsApi,
  roadSignsApi,
  settingsApi,
  tariffsApi,
  ticketsApi,
  topicsApi,
  usersApi,
} from "./api";

export const qk = {
  topics: ["topics"] as const,
  topicQuestions: (id: number) => ["topicQuestions", id] as const,
  question: (id: string) => ["question", id] as const,
  adminQuestions: (p: unknown) => ["adminQuestions", p] as const,
  tariffs: ["tariffs"] as const,
  adminTariffs: ["adminTariffs"] as const,
  methods: ["methods"] as const,
  adminMethods: ["adminMethods"] as const,
  meStats: ["meStats"] as const,
  mistakes: ["mistakes"] as const,
  favorites: ["favorites"] as const,
  referral: ["referral"] as const,
  dashSummary: ["dashSummary"] as const,
  timeseries: (r: string) => ["timeseries", r] as const,
  topicsDist: ["topicsDist"] as const,
  passRate: ["passRate"] as const,
  adminReferral: ["adminReferral"] as const,
  users: (p: unknown) => ["users", p] as const,
  payments: (p: number) => ["payments", p] as const,
  settings: ["settings"] as const,
};

export const useTopics = () =>
  useQuery({ queryKey: qk.topics, queryFn: topicsApi.list });

export const useTickets = () =>
  useQuery({ queryKey: ["tickets"], queryFn: ticketsApi.list });

export const useRoadSigns = () =>
  useQuery({ queryKey: ["roadSigns"], queryFn: roadSignsApi.get, staleTime: 1000 * 60 * 30 });

export const useTopicQuestions = (topicId: number, enabled = true) =>
  useQuery({
    queryKey: qk.topicQuestions(topicId),
    queryFn: () => questionsApi.byTopic(topicId),
    enabled,
  });

export const useAdminQuestions = (params: {
  topicId?: number;
  search?: string;
  page?: number;
}) =>
  useQuery({
    queryKey: qk.adminQuestions(params),
    queryFn: () => questionsApi.adminList(params),
  });

export const useActiveTariffs = () =>
  useQuery({ queryKey: qk.tariffs, queryFn: tariffsApi.listActive });

export const useAdminTariffs = () =>
  useQuery({ queryKey: qk.adminTariffs, queryFn: tariffsApi.adminList });

export const useEnabledMethods = () =>
  useQuery({ queryKey: qk.methods, queryFn: paymentMethodsApi.listEnabled });

export const useAdminMethods = () =>
  useQuery({ queryKey: qk.adminMethods, queryFn: paymentMethodsApi.adminList });

export const useMeStats = () =>
  useQuery({ queryKey: qk.meStats, queryFn: meApi.stats });

export const useMistakes = () =>
  useQuery({ queryKey: qk.mistakes, queryFn: meApi.mistakes });

export const useFavorites = () =>
  useQuery({ queryKey: qk.favorites, queryFn: meApi.favorites });

export const useReferral = () =>
  useQuery({ queryKey: qk.referral, queryFn: meApi.referral });

export const useDashboardSummary = () =>
  useQuery({
    queryKey: qk.dashSummary,
    queryFn: dashboardApi.summary,
    refetchInterval: 30_000,
  });

export const useTimeseries = (range: string) =>
  useQuery({
    queryKey: qk.timeseries(range),
    queryFn: () => dashboardApi.timeseries(range),
  });

export const useTopicsDistribution = () =>
  useQuery({ queryKey: qk.topicsDist, queryFn: dashboardApi.topicsDistribution });

export const usePassRate = () =>
  useQuery({ queryKey: qk.passRate, queryFn: dashboardApi.passRate });

export const useAdminReferral = () =>
  useQuery({ queryKey: qk.adminReferral, queryFn: dashboardApi.referral });

export const useUsers = (params: { search?: string; page?: number }) =>
  useQuery({ queryKey: qk.users(params), queryFn: () => usersApi.list(params) });

export const usePayments = (page: number) =>
  useQuery({ queryKey: qk.payments(page), queryFn: () => paymentsApi.adminList(page) });

export const useSettings = () =>
  useQuery({ queryKey: qk.settings, queryFn: settingsApi.get });
