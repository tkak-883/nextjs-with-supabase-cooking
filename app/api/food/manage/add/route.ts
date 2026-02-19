import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type AddItem = {
  name: string;
  price: number | string;
  volume: number | string;
  unit: string;
  remain: number | string;
  purchaseDate: string; // "YYYY-MM-DD"
  note?: string;
};

function genItemId_() {
  // {YYYYMMDDHHMMSSmmm}-{rand}
  const d = new Date();
  const pad = (n: number, w: number) => String(n).padStart(w, "0");
  const ts =
    d.getFullYear() +
    pad(d.getMonth() + 1, 2) +
    pad(d.getDate(), 2) +
    pad(d.getHours(), 2) +
    pad(d.getMinutes(), 2) +
    pad(d.getSeconds(), 2) +
    pad(d.getMilliseconds(), 3);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${ts}-${rand}`;
}

function toDbOwner(ownerParam: string) {
  const o = (ownerParam || "").trim();
  if (o === "なつ" || o === "natsu") return "natsu";
  if (o === "たか" || o === "taka") return "taka";
  return null;
}

export async function POST(req: Request) {
  try {
    const supabase = createAdminClient();
    const body = await req.json();

    const ownerParam = body?.owner;
    const items: AddItem[] = body?.items;

    const owner = toDbOwner(ownerParam);
    if (!owner) {
      return NextResponse.json(
        { error: "owner must be なつ/たか (or natsu/taka)" },
        { status: 400 }
      );
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items required" }, { status: 400 });
    }

    const inserted: { item_id: string; amountPerUnit: number }[] = [];

    for (const x of items) {
      const name = String(x?.name ?? "").trim();
      const unit = String(x?.unit ?? "").trim();
      const purchaseDate = String(x?.purchaseDate ?? "").trim();
      const note = String(x?.note ?? "");

      const price = Number(x?.price);
      const volume = Number(x?.volume);
      const remain = Number(x?.remain);

      if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
      if (!unit) return NextResponse.json({ error: "unit required" }, { status: 400 });
      if (!purchaseDate) return NextResponse.json({ error: "purchaseDate required" }, { status: 400 });

      if (!Number.isFinite(price) || price <= 0) {
        return NextResponse.json({ error: "price must be > 0" }, { status: 400 });
      }
      if (!Number.isFinite(volume) || volume <= 0) {
        return NextResponse.json({ error: "volume must be > 0" }, { status: 400 });
      }
      if (!Number.isFinite(remain) || remain < 0) {
        return NextResponse.json({ error: "remain must be >= 0" }, { status: 400 });
      }

      const item_id = genItemId_();
      const amountPerUnit = price / volume;

      const { error } = await supabase.from("food_items").insert({
        owner,
        item_id,
        name,
        volume,
        price,
        unit,
        amount_per_unit: amountPerUnit,
        remain,
        purchase_date: purchaseDate,
        note,
      });

      if (error) throw error;

      inserted.push({ item_id, amountPerUnit });
    }

    return NextResponse.json({ ok: true, owner: ownerParam, inserted });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
