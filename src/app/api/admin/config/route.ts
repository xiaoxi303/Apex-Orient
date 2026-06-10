import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET: Retrieve admin settings.
 * Supports dynamic desensitization and default configuration fallback for 'api_config'.
 * Query parameters: key (string)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");

    if (!key) {
      // If no key is provided, return all settings
      const settings = await prisma.adminSetting.findMany();
      return NextResponse.json({ success: true, settings });
    }

    const setting = await prisma.adminSetting.findUnique({
      where: { key },
    });

    let returnedValue = setting ? setting.value : null;

    // --- Dynamic Security Masking & Null Protection for API Configs ---
    if (key === "api_config") {
      if (!returnedValue) {
        // If database does not have an api_config record yet, fallback to a clean template
        returnedValue = JSON.stringify({
          provider: "finnhub",
          active_key: "",
          backup_keys: [],
        });
      } else {
        try {
          const parsed = JSON.parse(returnedValue);
          if (parsed.active_key) {
            const keyLen = parsed.active_key.length;
            // Mask intermediate characters, displaying only first 4 and last 4 characters
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
          returnedValue = JSON.stringify(parsed);
        } catch (e) {
          console.error("Failed to mask api_config key on GET:", e);
        }
      }
    }

    return NextResponse.json({
      success: true,
      key,
      value: returnedValue,
    });
  } catch (error) {
    console.error("Failed to fetch admin setting:", error);
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

    // --- Mask Preservation & First-Time Configuration Guard ---
    if (key === "api_config") {
      try {
        const parsedIncoming = JSON.parse(value);
        
        // If the submitted key contains masks (*)
        if (parsedIncoming.active_key && parsedIncoming.active_key.includes("*")) {
          const existingSetting = await prisma.adminSetting.findUnique({
            where: { key: "api_config" },
          });

          if (existingSetting && existingSetting.value) {
            const parsedExisting = JSON.parse(existingSetting.value);
            // Replace the masked input value with the raw database credential
            parsedIncoming.active_key = parsedExisting.active_key;
            
            // Do the same for backup keys if they match patterns
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
            // Case: Database has no previous record, but user submitted a masked key.
            // Reject the request to prevent writing dummy characters to a fresh environment.
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
        console.error("Failed to process api_config key preservation on POST:", e);
        return NextResponse.json(
          { success: false, error: "Invalid JSON format in value parameter" },
          { status: 400 }
        );
      }
    }

    // Upsert the configuration setting
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
    console.error("Failed to save admin setting:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
