export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function toDbOwner(o: string) {
  if (o === "なつ" || o === "natsu") return "natsu";
  if (o === "たか" || o === "taka") return "taka";
  return null;
}

// GET /api/kakeibo/list?owner=natsu&month=2026-02
export async function GET(req: Request) {
  try {
    const supabase = createAdminClient();
    const url = new URL(req.url);

    const ownerParam = url.searchParams.get("owner") ?? "";
    const owner = toDbOwner(ownerParam);
    if (!owner) return NextResponse.json({ error: "owner invalid" }, { status: 400 });

    const month = (url.searchParams.get("month") ?? "").trim(); // "YYYY-MM"

    let query = supabase
      .from("kakeibo_entries")
      .select("id,owner,item,date,amount,category,expense,note,created_at")
      .eq("owner", owner)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [yStr, mStr] = month.split("-");
      const y = Number(yStr);
      const m = Number(mStr);
      const start = `${yStr}-${mStr.padStart(2, "0")}-01`;
      const nextM = m === 12 ? 1 : m + 1;
      const nextY = m === 12 ? y + 1 : y;
      const end = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
      query = query.gte("date", start).lt("date", end);
    }

    const { data, error } = await query;
    if (error) throw error;

    const totalExpense = (data ?? [])
      .filter((r) => Number(r.amount) > 0)
      .reduce((s, r) => s + Number(r.amount), 0);
    const totalIncome = (data ?? [])
      .filter((r) => Number(r.amount) < 0)
      .reduce((s, r) => s + Math.abs(Number(r.amount)), 0);
    const total = totalExpense - totalIncome;

    return NextResponse.json({
      ok: true,
      items: data ?? [],
      totalExpense: Math.round(totalExpense),
      totalIncome: Math.round(totalIncome),
      total: Math.round(total),
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
