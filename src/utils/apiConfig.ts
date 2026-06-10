import { prisma } from "@/lib/prisma";

export interface ApiConfigData {
  provider: string;
  active_key: string;
  backup_keys?: string[];
}

/**
 * Server-side helper to retrieve the raw, unmasked API Key configuration from the database.
 * This can be used in WebSocket connection hubs, server components, or background scraping scripts.
 * Reads directly from PostgreSQL via Prisma to guarantee access to the actual raw secret tokens.
 */
export async function getDatabaseApiKey(): Promise<ApiConfigData | null> {
  try {
    const setting = await prisma.adminSetting.findUnique({
      where: { key: "api_config" },
    });

    if (!setting) {
      return null;
    }

    const parsed = JSON.parse(setting.value);
    return {
      provider: parsed.provider || "finnhub",
      active_key: parsed.active_key || "",
      backup_keys: parsed.backup_keys || [],
    };
  } catch (error) {
    console.error("Failed to retrieve api_config from the database:", error);
    return null;
  }
}
