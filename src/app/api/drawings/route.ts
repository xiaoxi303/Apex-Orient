import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET: Fetch drawings for a specific stock symbol and timeframe.
 * Query parameters: symbol (string), timeframe (string)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get("symbol");
    const timeframe = searchParams.get("timeframe");

    if (!symbol || !timeframe) {
      return NextResponse.json(
        { success: false, error: "Missing symbol or timeframe query parameters" },
        { status: 400 }
      );
    }

    const drawing = await prisma.drawing.findUnique({
      where: {
        symbol_timeframe: { symbol, timeframe },
      },
    });

    return NextResponse.json({
      success: true,
      drawingData: drawing ? drawing.drawingData : [],
    });
  } catch (error) {
    console.error("Failed to fetch drawings:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * POST: Create or update drawings for a specific stock symbol and timeframe.
 * Body parameters: symbol (string), timeframe (string), drawingData (Array/Json)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { symbol, timeframe, drawingData } = body;

    if (!symbol || !timeframe || drawingData === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing symbol, timeframe, or drawingData in request body" },
        { status: 400 }
      );
    }

    // Upsert drawings using composite unique key
    const updatedDrawing = await prisma.drawing.upsert({
      where: {
        symbol_timeframe: { symbol, timeframe },
      },
      update: {
        drawingData: drawingData,
      },
      create: {
        symbol,
        timeframe,
        drawingData: drawingData,
      },
    });

    return NextResponse.json({
      success: true,
      drawing: updatedDrawing,
    });
  } catch (error) {
    console.error("Failed to upsert drawings:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
