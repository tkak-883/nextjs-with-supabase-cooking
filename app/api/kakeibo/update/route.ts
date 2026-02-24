export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/kakeibo/update
// body: { id, item?, date?, amount?, category?, note? }
// entry_type は変更不可（支出→収入の種別変更はここでは行わない）
export async function POST(req: Request) {
  try {
    const supabase = createAdminClient();
    const body = await req.json();

    const id = body?.id;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const updates: Record<string, any> = {};
    if (body.item !== undefined) updates.item = String(body.item).trim();
    if (body.date !== undefined) updates.date = String(body.date).trim();
    if (body.category !== undefined) updates.category = String(body.category).trim();
    if (body.note !== undefined) updates.note = String(body.note);
    if (body.amount !== undefined) {
      const amt = Number(body.amount);
      if (!Number.isFinite(amt) || amt <= 0)
        return NextResponse.json({ error: "amount invalid" }, { status: 400 });
      updates.amount = amt;
    }

    if (Object.keys(updates).length === 0)
      return NextResponse.json({ error: "no fields to update" }, { status: 400 });

    // kakeibo_entriesを更新
    const { error } = await supabase
      .from("kakeibo_entries")
      .update(updates)
      .eq("id", id);

    if (error) throw error;

    // 対応するsettle_entryがあれば連動更新（amount・dateが変わった場合のみ影響）
    if (updates.amount !== undefined || updates.date !== undefined) {
      const { data: settle } = await supabase
        .from("settle_entries")
        .select("id, meta, delta, date")
        .eq("source", "payment")
        .filter("meta->>kakeibo_id", "eq", String(id))
        .maybeSingle();

      if (settle) {
        const { payer, forWhom } = settle.meta ?? {};
        const newAmt = updates.amount ?? 0;
        const settleUpdates: Record<string, any> = {};

        if (updates.date !== undefined) {
          settleUpdates.date = updates.date;
        }

        if (updates.amount !== undefined && payer && forWhom) {
          let newDelta = 0;
          if (payer === "なつ" && forWhom === "たか") newDelta = newAmt;
          if (payer === "たか" && forWhom === "なつ") newDelta = -newAmt;
          if (payer === "なつ" && forWhom === "共有") newDelta = Math.round(newAmt * 0.5);
          if (payer === "たか" && forWhom === "共有") newDelta = -Math.round(newAmt * 0.5);
          settleUpdates.delta = newDelta;
        }

        if (Object.keys(settleUpdates).length > 0) {
          const { error: settleError } = await supabase
            .from("settle_entries")
            .update(settleUpdates)
            .eq("id", settle.id);
          if (settleError) throw settleError;
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
