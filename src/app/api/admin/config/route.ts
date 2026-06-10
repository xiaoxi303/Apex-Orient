import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Helper to mask sensitive keys in api_config JSON string
 */
function maskApiConfig(value: string): string {
  try {
    const parsed = JSON.parse(value);
    if (parsed.active_key) {
      const keyLen = parsed.active_key.length;
      if (keyLen > 8) {
        parsed.active_key = `${parsed.active_key.slice(0, 4)}***********${parsed.active_key.slice(-4)}`;
      } else {
        parsed.active_key = "***********";
      }
    }
    if (parsed.backup_keys && Array.isArray(parsed.backup_keys)) {
      parsed.backup_keys = parsed.backup_keys.map((k: string) => 
        k.length > 8 ? `${k.slice(0, 4)}***********${k.slice(-4)}` : "***********"
      );
    }
    return JSON.stringify(parsed);
  } catch (e) {
    console.error("[Config API] Failed to mask api_config key:", e);
    return value;
  }
}

/**
 * GET: Retrieve admin settings.
 * Supports dynamic security masking for 'api_config' either requested directly or returned in bulk.
 * Query parameters: key (string)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");

    if (!key) {
      // Return all settings, but mask api_config for security
      const settings = await prisma.adminSetting.findMany();
      const maskedSettings = settings.map((s) => {
        if (s.key === "api_config") {
          return { ...s, value: maskApiConfig(s.value) };
        }
        return s;
      });
      return NextResponse.json({ success: true, settings: maskedSettings });
    }

    const setting = await prisma.adminSetting.findUnique({
      where: { key },
    });

    let returnedValue = setting ? setting.value : null;

    if (key === "api_config") {
      if (!returnedValue) {
        // Fallback clean template for Twelve Data
        returnedValue = JSON.stringify({
          provider: "twelvedata",
          active_key: "",
          backup_keys: [],
        });
      } else {
        returnedValue = maskApiConfig(returnedValue);
      }
    }

    return NextResponse.json({
      success: true,
      key,
      value: returnedValue,
    });
  } catch (error) {
    console.error("[Config API] Failed to fetch admin setting:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * POST: Create or update an admin setting.
 * Protects masked configurations (e.g. 'api_config') from overwriting raw database values.
 * Body parameters: key (string), value (string)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing key or value in request body" },
        { status: 400 }
      );
    }

    let finalValue = value;

    // Preserve original key if masked value is submitted
    if (key === "api_config") {
      try {
        const parsedIncoming = JSON.parse(value);
        if (parsedIncoming.active_key && parsedIncoming.active_key.includes("*")) {
          const existingSetting = await prisma.adminSetting.findUnique({
            where: { key: "api_config" },
          });

          if (existingSetting && existingSetting.value) {
            const parsedExisting = JSON.parse(existingSetting.value);
            parsedIncoming.active_key = parsedExisting.active_key;
            
            if (parsedIncoming.backup_keys && Array.isArray(parsedIncoming.backup_keys) && parsedExisting.backup_keys) {
              parsedIncoming.backup_keys = parsedIncoming.backup_keys.map((k: string, idx: number) => {
                if (k.includes("*") && parsedExisting.backup_keys[idx]) {
                  return parsedExisting.backup_keys[idx];
                }
                return k;
              });
            }
            finalValue = JSON.stringify(parsedIncoming);
          } else {
            return NextResponse.json(
              {
                success: false,
                error: "Initial API setup requires a complete unmasked API key. Masked keys containing '*' are rejected on first-time setup.",
              },
              { status: 400 }
            );
          }
        }
      } catch (e) {
        console.error("[Config API] Failed to process api_config key preservation on POST:", e);
        return NextResponse.json(
          { success: false, error: "Invalid JSON format in value parameter" },
          { status: 400 }
        );
      }
    }

    const updatedSetting = await prisma.adminSetting.upsert({
      where: { key },
      update: { value: finalValue },
      create: { key, value: finalValue },
    });

    return NextResponse.json({
      success: true,
      setting: updatedSetting,
    });
  } catch (error) {
    console.error("[Config API] Failed to save admin setting:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
