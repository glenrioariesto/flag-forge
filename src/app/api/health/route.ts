import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "flag-forge",
    timestamp: new Date().toISOString(),
  });
}
