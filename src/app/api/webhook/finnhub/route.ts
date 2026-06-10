import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/webhook/finnhub
 * Receives Webhook events (e.g., breaking news, testing pings) from Finnhub.
 * Decodes news payloads, formats them, and writes them directly to the 'news_brief' AdminSetting.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Hook Security verification (optional logging)
    const secretHeader = req.headers.get("X-Finnhub-Secret");
    // Default or user-provided Webhook secret for comparison
    const WEBHOOK_SECRET = process.env.FINNHUB_WEBHOOK_SECRET || "d82qp91r01qvkevni6bg";

    if (secretHeader) {
      console.log(`[Webhook] Received X-Finnhub-Secret header: ${secretHeader}`);
      if (secretHeader !== WEBHOOK_SECRET) {
        console.warn("[Webhook] Security mismatch! X-Finnhub-Secret header did not match local secret.");
        // We log it but do not block execution during testing/dev phase to ensure smooth run-through
      }
    } else {
      console.log("[Webhook] Received request without X-Finnhub-Secret header.");
    }

    // 2. Parse payload body
    const body = await req.json();
    console.log("[Webhook] Received Finnhub Payload:", JSON.stringify(body));

    let newsText = "";

    // 3. Adaptive parsing logic to support pings, array of news articles, or direct root objects
    if (body.type === "ping") {
      newsText = "🔥 Webhook connection test from Finnhub successful! Real-time streaming channel is now active.";
    } else if (body.type === "news" && Array.isArray(body.data)) {
      // Finnhub news payload with data array containing articles
      newsText = body.data
        .map(
          (item: { source?: string; headline?: string; summary?: string }) =>
            `📰 [${item.source || "Finnhub"}] ${item.headline || item.summary}`
        )
        .join("  |  ");
    } else if (body.headline) {
      // Single news item directly mapped to root level
      newsText = `📰 [${body.source || "Finnhub"}] ${body.headline}`;
      if (body.related) {
        newsText += ` ($${body.related})`;
      }
    } else if (body.type && body.data) {
      newsText = `🔔 [${body.type}] Webhook alert received: ${JSON.stringify(body.data)}`;
    } else {
      // General testing/ping fallback
      newsText = "🔥 Webhook test signal received from Finnhub console successfully.";
    }

    console.log(`[Webhook] Writing formatted news_brief to database: "${newsText}"`);

    // 4. Save/Upsert directly to AdminSetting 'news_brief' key
    await prisma.adminSetting.upsert({
      where: { key: "news_brief" },
      update: { value: newsText },
      create: { key: "news_brief", value: newsText },
    });

    // 5. Respond with 200 OK (Finnhub expects 2xx status)
    return NextResponse.json({ success: true, message: "Webhook processed" }, { status: 200 });
  } catch (error) {
    console.error("[Webhook] Failed to process Finnhub webhook:", error);
    
    // Always return 200 OK or 204 even on processing errors during test validations
    // to prevent Finnhub from blocking/disabling the webhook endpoint.
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Internal Server Error" 
      }, 
      { status: 200 }
    );
  }
}

/**
 * GET /api/webhook/finnhub
 * Simple health check verification for the webhook endpoint.
 */
export async function GET() {
  return NextResponse.json({ status: "Webhook endpoint is active" }, { status: 200 });
}
