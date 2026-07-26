import { NextResponse } from "next/server";

import { createSupabaseServiceRoleClient, hasSupabaseServiceRoleConfig } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const noCacheHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Content-Type": "application/json",
};

export async function GET() {
  const timestamp = new Date().toISOString();

  if (!hasSupabaseServiceRoleConfig()) {
    return NextResponse.json(
      {
        status: "degraded",
        timestamp,
        version: process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0",
        services: {
          database: "not_configured",
        },
      },
      { headers: noCacheHeaders, status: 200 },
    );
  }

  const supabase = createSupabaseServiceRoleClient();
  let dbStatus = "connected";

  try {
    const { error } = await supabase!.from("room_types").select("id").limit(1);
    if (error) {
      dbStatus = "error";
    }
  } catch {
    dbStatus = "error";
  }

  return NextResponse.json(
    {
      status: dbStatus === "connected" ? "healthy" : "degraded",
      timestamp,
      version: process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0",
      services: {
        database: dbStatus,
      },
    },
    { headers: noCacheHeaders, status: 200 },
  );
}
