import { apiRequest } from "@/services/api";
import type { AdSlide, SiteSettings } from "@/types/admin";

export interface SiteBootstrap {
  settings: SiteSettings;
  ads: AdSlide[];
}

export const siteService = {
  /** Public: no session required; every visitor needs this for the shell. */
  getBootstrap() {
    return apiRequest<SiteBootstrap>("/site");
  },
};

export const DEFAULT_SITE_NAME = "I2P Forum";
