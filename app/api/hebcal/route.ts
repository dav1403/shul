import { NextRequest, NextResponse } from "next/server";
import { getHebcalData } from "@/lib/hebcal/client";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const geonameIdStr = searchParams.get("geonameid");

  if (!geonameIdStr) {
    return NextResponse.json({ error: "geonameid requis" }, { status: 400 });
  }

  const geonameId = parseInt(geonameIdStr, 10);
  if (isNaN(geonameId)) {
    return NextResponse.json({ error: "geonameid invalide" }, { status: 400 });
  }

  const data = await getHebcalData(geonameId);
  return NextResponse.json(data, {
    headers: { "Cache-Control": "s-maxage=21600, stale-while-revalidate" },
  });
}
