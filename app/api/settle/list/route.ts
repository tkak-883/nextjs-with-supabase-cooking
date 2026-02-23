export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/settle/list?month=2026-02
export async function GET(req: Request) {
  try {
    const supabase = createAdminClient();
    const url = new URL(req.url);
    const month = (url.searchParams.get("month") ?? "").trim();

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "month required (YYYY-MM)" }, { status: 400 });
    }

    const [yStr, mStr] = month.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    const start = `${yStr}-${mStr.padStart(2, "0")}-01`;
    const nextM = m === 12 ? 1 : m + 1;
    const nextY = m === 12 ? y + 1 : y;
    const end = `${nextY}-${String(nextM).padStart(2, "0")}-01`;

    const { data, error } = await supabase
      .from("settle_entries")
      .select("id,date,delta,source,meta,created_at")
      .gte("date", start)
      .lt("date", end)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ ok: true, items: data ?? [] });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
