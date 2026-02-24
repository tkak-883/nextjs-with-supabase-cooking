export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function toDbOwner(o: string) {
  if (o === "なつ" || o === "natsu") return "natsu";
  if (o === "たか" || o === "taka") return "taka";
  return null;
}

// GET /api/food/use-history?owner=natsu&month=2026-02
export async function GET(req: Request) {
  try {
    const supabase = createAdminClient();
    const url = new URL(req.url);

    const owner = toDbOwner(url.searchParams.get("owner") ?? "");
    if (!owner) return NextResponse.json({ error: "owner invalid" }, { status: 400 });

    const month = (url.searchParams.get("month") ?? "").trim();

    let query = supabase
      .from("food_use_logs")
      .select("id,owner,use_date,item_id,item_name,use_amount,amount_per_unit,unit,settle_delta,created_at")
      .eq("owner", owner)
      .order("use_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [yStr, mStr] = month.split("-");
      const y = Number(yStr);
      const m = Number(mStr);
      const start = `${yStr}-${mStr.padStart(2, "0")}-01`;
      const nextM = m === 12 ? 1 : m + 1;
      const nextY = m === 12 ? y + 1 : y;
      const end = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
      query = query.gte("use_date", start).lt("use_date", end);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ ok: true, items: data ?? [] });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
