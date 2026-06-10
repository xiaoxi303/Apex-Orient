import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/stock/twelve-key
 * Returns the Twelve Data API Key from database settings or environment variables.
 * Exposes the key to the frontend for direct client-side CORS fetches.
 */
export async function GET() {
  try {
    // 1. Try environment variables first (both standard and NEXT_PUBLIC)
    let apiKey = process.env.TWELVE_DATA_API_KEY || process.env.NEXT_PUBLIC_TWELVE_DATA_API_KEY || "";
    
    // 2. Fall back to database config (api_config key) if not set in environment
    if (!apiKey) {
      try {
        const apiConfig = await prisma.adminSetting.findUnique({
          where: { key: "api_config" },
        });
        if (apiConfig) {
          const parsed = JSON.parse(apiConfig.value);
          if (parsed.active_key && parsed.active_key.trim() !== "" && !parsed.active_key.includes("*")) {
            apiKey = parsed.active_key;
          }
        }
      } catch (dbErr) {
        console.warn("[Twelve Key API] Failed to read from DB, attempting fallback:", dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      apiKey: apiKey || "demo"
    });
  } catch (error) {
    console.error("[Twelve Key API] Error retrieving Twelve Data API key:", error);
    return NextResponse.json({ success: false, apiKey: "demo" });
  }
}
