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

    let dateStart = "";
    let dateEnd = "";

    let query = supabase
      .from("kakeibo_entries")
      .select("id,owner,item,date,amount,category,expense,entry_type,note,created_at")
      .eq("owner", owner)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [yStr, mStr] = month.split("-");
      const y = Number(yStr);
      const m = Number(mStr);
      dateStart = `${yStr}-${mStr.padStart(2, "0")}-01`;
      const nextM = m === 12 ? 1 : m + 1;
      const nextY = m === 12 ? y + 1 : y;
      dateEnd = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
      query = query.gte("date", dateStart).lt("date", dateEnd);
    }

    const { data, error } = await query;
    if (error) throw error;

    // settle_entriesからpayer/forWhomを結合
    const settleByKakeiboId = new Map<string, { payer: string; forWhom: string }>();
    {
      let settleQuery = supabase
        .from("settle_entries")
        .select("meta")
        .eq("source", "payment");
      if (dateStart && dateEnd) {
        settleQuery = settleQuery.gte("date", dateStart).lt("date", dateEnd);
      }
      const { data: settleData } = await settleQuery;
      for (const s of settleData ?? []) {
        if (s.meta?.kakeibo_id != null) {
          settleByKakeiboId.set(String(s.meta.kakeibo_id), {
            payer: s.meta.payer ?? "",
            forWhom: s.meta.forWhom ?? "",
          });
        }
      }
    }

    const items = (data ?? []).map((r) => ({
      ...r,
      payer: settleByKakeiboId.get(String(r.id))?.payer ?? null,
      forWhom: settleByKakeiboId.get(String(r.id))?.forWhom ?? null,
    }));

    const totalExpense = items
      .filter((r) => r.entry_type === "expense")
      .reduce((s, r) => s + Number(r.amount), 0);
    const totalIncome = items
      .filter((r) => r.entry_type === "income")
      .reduce((s, r) => s + Number(r.amount), 0);
    const total = totalIncome - totalExpense;

    return NextResponse.json({
      ok: true,
      items,
      totalExpense: Math.round(totalExpense),
      totalIncome: Math.round(totalIncome),
      total: Math.round(total),
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
