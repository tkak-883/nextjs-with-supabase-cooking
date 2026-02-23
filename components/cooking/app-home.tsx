"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TabKey = "payment" | "use" | "manage" | "kakeibo";

type FoodItem = {
  name: string;
  item_id: string;
  unit: string;
  remain: number;
  amountPerUnit: number;
};

type KakeiboEntry = {
  id: number;
  owner: string;
  item: string;
  date: string;
  amount: number;
  category: string;
  entry_type: "expense" | "income";
  expense?: string | null;
  note?: string;
};

type UseLogEntry = {
  id: number;
  owner: string;
  use_date: string;
  item_id: string;
  item_name: string;
  use_amount: number;
  amount_per_unit: number;
  settle_delta: number;
};

type ManageItem = {
  name: string;
  item_id: string;
  unit: string;
  remain?: number;
  volume?: number;
  amountPerUnit: number;
  purchaseDate?: string;
  deleteDate?: string;
  monthKey?: string;
  note?: string;
  price?: number;
};

const TABS: { key: TabKey; label: string; emoji: string }[] = [
  { key: "payment", label: "支出・収入", emoji: "🧾" },
  { key: "use", label: "使用", emoji: "🍳" },
  { key: "manage", label: "食材", emoji: "🥬" },
  { key: "kakeibo", label: "家計簿", emoji: "📒" },
];

function cn(...xs: (string | false | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

//function ymdToday() {
  //const d = new Date();
  //const yyyy = d.getFullYear();
  //const mm = String(d.getMonth() + 1).padStart(2, "0");
  //const dd = String(d.getDate()).padStart(2, "0");
  //return `${yyyy}-${mm}-${dd}`;
//}

function monthKeyOf(ymd: string) {
  return (ymd || "").slice(0, 7);
}

function fmtYmd(s?: string) {
  if (!s) return "";
  return String(s).slice(0, 10);
}

function settleMessage(total: number) {
  if (total > 0) return `たかがなつに ${total} 円返す`;
  if (total < 0) return `なつがたかに ${Math.abs(total)} 円返す`;
  return "貸し借りなし！";
}

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPost<T>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text);
  return JSON.parse(text);
}

export default function AppHome({ initialTab = "payment" }: { initialTab?: TabKey }) {
  const [tab, setTab] = useState<TabKey>(initialTab);

  // 共通（ユーザー）
  const [ownerJa, setOwnerJa] = useState<"なつ" | "たか">("なつ");
  const ownerDb = ownerJa === "なつ" ? "natsu" : "taka";

  // 支払い
  const [payCategory, setPayCategory] = useState("食材");
  const [payDate, setPayDate] = useState<string>("");
  const [payAmount, setPayAmount] = useState<string>("");
  const [payPayer, setPayPayer] = useState<"なつ" | "たか">("なつ");
  const [payForWhom, setPayForWhom] = useState<"なつ" | "たか" | "共有">("共有");
  const [payNote, setPayNote] = useState("");
  const [payOut, setPayOut] = useState<string>("");

  // 支出・収入モード切替
  const [payMode, setPayMode] = useState<"支出" | "収入">("支出");

  // 収入フォーム
  const [incomeAmount, setIncomeAmount] = useState<string>("");
  const [incomeCategory, setIncomeCategory] = useState("給与");
  const [incomeNote, setIncomeNote] = useState("");
  const [incomeOut, setIncomeOut] = useState<string>("");

  // 精算表示
  const [settleTotal, setSettleTotal] = useState<number>(0);
  const [settleMonthKey, setSettleMonthKey] = useState<string>("");
  const settleMonthLabel = useMemo(() => settleMonthKey, [settleMonthKey]);

  // 使用（food.list）
  const [useDate, setUseDate] = useState<string>("");
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [useRows, setUseRows] = useState<{ item_id: string; useAmount: string }[]>([
    { item_id: "", useAmount: "" },
    { item_id: "", useAmount: "" },
    { item_id: "", useAmount: "" },
  ]);
  const [useOut, setUseOut] = useState<string>("");

  // 使用履歴
  const [useHistoryItems, setUseHistoryItems] = useState<UseLogEntry[]>([]);
  const [useHistoryMonthKey, setUseHistoryMonthKey] = useState<string>("");
  const [useHistoryOut, setUseHistoryOut] = useState<string>("");
  const [useHistoryViewMode, setUseHistoryViewMode] = useState<"日毎" | "一覧">("日毎");
  const [useLogEditId, setUseLogEditId] = useState<number | null>(null);
  const [useLogEditValues, setUseLogEditValues] = useState<{ use_date: string; use_amount: string } | null>(null);

  // 家計簿
  const [kakeiboMonthKey, setKakeiboMonthKey] = useState<string>("");
  const [kakeiboItems, setKakeiboItems] = useState<KakeiboEntry[]>([]);
  const [kakeiboTotal, setKakeiboTotal] = useState<number>(0);
  const [kakeiboTotalExpense, setKakeiboTotalExpense] = useState<number>(0);
  const [kakeiboTotalIncome, setKakeiboTotalIncome] = useState<number>(0);
  const [kakeiboOut, setKakeiboOut] = useState<string>("");
  const [kakeiboEditId, setKakeiboEditId] = useState<number | null>(null);
  const [kakeiboEditValues, setKakeiboEditValues] = useState<{
    item: string;
    date: string;
    amount: string;
    category: string;
    note: string;
  } | null>(null);

  // 家計簿表示フィルタ
  const [kakeiboViewMode, setKakeiboViewMode] = useState<"支出" | "収入">("支出");

  // 食材情報修正
  const [editId, setEditId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ remain: number; volume: number; price: number; note: string } | null>(null);

  // 管理（manage.list）
  const [manageMonthKey, setManageMonthKey] = useState<string>("");
  const [manageMonths, setManageMonths] = useState<string[]>([]);
  const [manageItems, setManageItems] = useState<ManageItem[]>([]);
  const [manageDeleted, setManageDeleted] = useState<ManageItem[]>([]);
  const [manageOut, setManageOut] = useState<string>("");

  // 復元フォーム
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [restoreRemain, setRestoreRemain] = useState<string>("");

  // 追加フォーム（管理）
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [addVolume, setAddVolume] = useState("");
  const [addUnit, setAddUnit] = useState("個");
  const [addRemain, setAddRemain] = useState("");
  const [addPurchaseDate, setAddPurchaseDate] = useState<string>("");
  const [addNote, setAddNote] = useState("");

  useEffect(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
  
    const today = `${yyyy}-${mm}-${dd}`;
    const monthKey = `${yyyy}-${mm}`;
  
    if (!payDate) setPayDate(today);
    if (!useDate) setUseDate(today);
    if (!addPurchaseDate) setAddPurchaseDate(today);
    if (!settleMonthKey) setSettleMonthKey(monthKey);
    if (!kakeiboMonthKey) setKakeiboMonthKey(monthKey);
    if (!useHistoryMonthKey) setUseHistoryMonthKey(monthKey);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  

  // --- 初期ロード（タブに応じて） ---
  useEffect(() => {
    if (tab === "use") { void loadFoods(); void loadUseHistory(); }
    if (tab === "manage") void loadManage();
    if (tab === "kakeibo") void loadKakeibo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, ownerDb, manageMonthKey, kakeiboMonthKey, useHistoryMonthKey]);

  // 精算バッジは settleMonthKey 変更時に常時更新
  useEffect(() => {
    void loadSettle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settleMonthKey]);

  async function loadFoods() {
    setUseOut("loading...");
    try {
      // owner=なつ/たか でもOKの実装にしてる前提。curlのときだけエンコード問題が出る。
      const res = await apiGet<{ ok: boolean; items: FoodItem[] }>(
        `/api/food/list?owner=${encodeURIComponent(ownerJa)}`
      );
      setFoods(res.items ?? []);
      setUseOut("");
    } catch (e: any) {
      setUseOut(String(e?.message ?? e));
    }
  }

  async function loadUseHistory() {
    setUseHistoryOut("loading...");
    try {
      const qs = new URLSearchParams();
      qs.set("owner", ownerDb);
      if (useHistoryMonthKey) qs.set("month", useHistoryMonthKey);
      const res = await apiGet<{ ok: boolean; items: UseLogEntry[] }>(
        `/api/food/use-history?${qs.toString()}`
      );
      setUseHistoryItems(res.items ?? []);
      setUseHistoryOut("");
    } catch (e: any) {
      setUseHistoryOut(String(e?.message ?? e));
    }
  }

  async function loadManage() {
    setManageOut("loading...");
    try {
      const qs = new URLSearchParams();
      qs.set("owner", ownerDb);
      if (manageMonthKey) qs.set("monthKey", manageMonthKey);

      const res = await apiGet<{
        ok: boolean;
        months: string[];
        items: ManageItem[];
        deleted: ManageItem[];
      }>(`/api/food/manage/list?${qs.toString()}`);

      setManageMonths(res.months ?? []);
      setManageItems(res.items ?? []);
      setManageDeleted(res.deleted ?? []);
      setManageOut("");
    } catch (e: any) {
      setManageOut(String(e?.message ?? e));
    }
  }

  async function loadSettle() {
    try {
      const res = await apiGet<{ ok: boolean; total: number }>(
        `/api/settle/get?month=${encodeURIComponent(settleMonthKey)}`
      );
      setSettleTotal(Number(res.total) || 0);
    } catch {
      // 失敗してもUIは落とさない（最優先は操作感）
    }
  }

  async function loadKakeibo() {
    setKakeiboOut("loading...");
    try {
      const qs = new URLSearchParams();
      qs.set("owner", ownerDb);
      if (kakeiboMonthKey) qs.set("month", kakeiboMonthKey);
      const res = await apiGet<{
        ok: boolean;
        items: KakeiboEntry[];
        total: number;
        totalExpense: number;
        totalIncome: number;
      }>(`/api/kakeibo/list?${qs.toString()}`);
      setKakeiboItems(res.items ?? []);
      setKakeiboTotal(res.total ?? 0);
      setKakeiboTotalExpense(res.totalExpense ?? 0);
      setKakeiboTotalIncome(res.totalIncome ?? 0);
      setKakeiboOut("");
    } catch (e: any) {
      setKakeiboOut(String(e?.message ?? e));
    }
  }

  // --- 支払い送信 ---
  async function submitPayment() {
    setPayOut("sending...");
    try {
      const amount = Number(payAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        setPayOut("ERROR: 金額が不正");
        return;
      }

      const res = await apiPost<any>("/api/payment/add", {
        category: payCategory,
        date: payDate,
        amount,
        payer: payPayer,
        forWhom: payForWhom,
        note: payNote,
      });

      setPayOut(JSON.stringify(res, null, 2));
      // 送信後に精算を更新
      await loadSettle();
      setPayAmount("");
      setPayNote("");
    } catch (e: any) {
      setPayOut(String(e?.message ?? e));
    }
  }

  // --- 収入記録 ---
  async function submitIncome() {
    setIncomeOut("sending...");
    try {
      const amount = Number(incomeAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        setIncomeOut("ERROR: 金額が不正");
        return;
      }
      if (!payDate) {
        setIncomeOut("ERROR: 日付が未入力");
        return;
      }
      const res = await apiPost<any>("/api/kakeibo/add", {
        owner: ownerDb,
        category: incomeCategory,
        date: payDate,
        amount,
        note: incomeNote,
      });
      setIncomeOut(JSON.stringify(res, null, 2));
      setIncomeAmount("");
      setIncomeNote("");
    } catch (e: any) {
      setIncomeOut(String(e?.message ?? e));
    }
  }

  // --- 使用送信 ---
  const useTotal = useMemo(() => {
    const map = new Map(foods.map((f) => [f.item_id, f]));
    let total = 0;
    for (const r of useRows) {
      const it = map.get(r.item_id);
      const amt = Number(r.useAmount);
      if (!it) continue;
      if (!Number.isFinite(amt) || amt <= 0) continue;
      total += (Number(it.amountPerUnit) || 0) * amt;
    }
    return Math.round(total);
  }, [foods, useRows]);

  const useHistoryByDate = useMemo(() => {
    const map = new Map<string, { logs: UseLogEntry[]; dayTotal: number }>();
    for (const log of useHistoryItems) {
      const date = fmtYmd(log.use_date);
      if (!map.has(date)) map.set(date, { logs: [], dayTotal: 0 });
      const entry = map.get(date)!;
      entry.logs.push(log);
      entry.dayTotal += Number(log.settle_delta);
    }
    return Array.from(map.entries()).map(([date, v]) => ({ date, ...v }));
  }, [useHistoryItems]);

  async function submitUse() {
    setUseOut("sending...");
    try {
      const rows = useRows
        .map((r) => ({ item_id: r.item_id, useAmount: Number(r.useAmount) }))
        .filter((r) => r.item_id && Number.isFinite(r.useAmount) && r.useAmount > 0);

      if (!useDate) {
        setUseOut("ERROR: 日付が未入力");
        return;
      }
      if (rows.length === 0) {
        setUseOut("ERROR: 具材と使用量を入力");
        return;
      }

      const res = await apiPost<any>("/api/food/use", {
        owner: ownerDb,
        date: useDate,
        rows,
      });

      setUseOut(JSON.stringify(res, null, 2));
      // 更新
      await loadFoods();
      await loadSettle();
      setUseRows([
        { item_id: "", useAmount: "" },
        { item_id: "", useAmount: "" },
        { item_id: "", useAmount: "" },
      ]);
    } catch (e: any) {
      setUseOut(String(e?.message ?? e));
    }
  }

  // --- 管理：追加 ---
  async function submitAddFood() {
    setManageOut("adding...");
    try {
      const price = Number(addPrice);
      const volume = Number(addVolume);
      const remain = Number(addRemain);

      if (!addName.trim()) return setManageOut("ERROR: 具材名が空");
      if (!Number.isFinite(price) || price <= 0) return setManageOut("ERROR: 金額が不正");
      if (!Number.isFinite(volume) || volume <= 0) return setManageOut("ERROR: 内容量が不正");
      if (!Number.isFinite(remain) || remain < 0) return setManageOut("ERROR: 残量が不正");
      if (!addPurchaseDate) return setManageOut("ERROR: 購入日が空");

      await apiPost<any>("/api/food/manage/add", {
        owner: ownerDb,
        items: [
          {
            name: addName,
            price,
            volume,
            unit: addUnit,
            remain,
            purchaseDate: addPurchaseDate,
            note: addNote,
          },
        ],
      });

      setAddOpen(false);
      setAddName("");
      setAddPrice("");
      setAddVolume("");
      setAddRemain("");
      setAddNote("");
      setManageOut("");
      await loadManage();
      await loadFoods();
    } catch (e: any) {
      setManageOut(String(e?.message ?? e));
    }
  }

  // --- UI 部品 ---
  return (
    <div className="min-h-dvh bg-gradient-to-b from-emerald-50 via-lime-50 to-white text-slate-900">
      {/* Top (PC) */}
      <header className="sticky top-0 z-20 hidden border-b bg-white/70 backdrop-blur md:block">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-500 text-white shadow-sm">
              🍲
            </div>
            <div>
              <div className="text-sm font-extrabold tracking-tight">ごはんと家計簿</div>
              <div className="text-xs text-slate-500">おいしく食べる</div>
            </div>
          </div>

        </div>

        <div className="mx-auto max-w-5xl px-4 pb-3">
          <nav className="flex gap-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                setTab(t.key);
                window.history.replaceState(null, "", `/?page=${t.key}`);
              }}
                className={cn(
                  "flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-bold transition",
                  tab === t.key
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                )}
              >
                <span>{t.emoji}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Mobile header */}
      <header className="sticky top-0 z-20 border-b bg-emerald-500 text-white shadow-sm md:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div>
            <div className="text-base font-extrabold">🍲 ごはんと家計簿</div>
            <div className="text-xs opacity-90">おいしく食べる</div>
          </div>

        </div>
      </header>

      {/* Body */}
      <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-5 md:pb-10">
        {/* Quick settle badge */}
        <Card className="mb-4 border-emerald-100 bg-white/70 p-4 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-emerald-700">今月の精算</div>
              <div className="mt-1 text-lg font-extrabold">{settleMessage(settleTotal)}</div>
              <div className="mt-1 text-xs text-slate-500">月キー：{settleMonthLabel}</div>
            </div>
            <div className="flex items-center gap-2">
              <MonthPicker value={settleMonthKey} onChange={setSettleMonthKey} />
              <Button
                className="rounded-2xl bg-emerald-600 hover:bg-emerald-700"
                onClick={() => loadSettle()}
              >
                更新
              </Button>
            </div>
          </div>
        </Card>

        {/* Tabs */}
        {tab === "payment" && (
          <Section
            title="🧾 支出・収入"
            subtitle={payMode === "支出" ? "家計簿＋精算に反映" : "家計簿のみに記録"}
          >
            {/* モード切替トグル */}
            <div className="mb-5 flex w-fit rounded-2xl bg-slate-100 p-1">
              <button
                className={cn(
                  "rounded-xl px-6 py-2 text-sm font-bold transition",
                  payMode === "支出"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                )}
                onClick={() => setPayMode("支出")}
              >
                支出
              </button>
              <button
                className={cn(
                  "rounded-xl px-6 py-2 text-sm font-bold transition",
                  payMode === "収入"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                )}
                onClick={() => setPayMode("収入")}
              >
                収入
              </button>
            </div>

            {/* 支出フォーム */}
            {payMode === "支出" && (
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="カテゴリー">
                  <select
                    className="w-full rounded-2xl border px-3 py-2"
                    value={payCategory}
                    onChange={(e) => setPayCategory(e.target.value)}
                  >
                    <option>食材</option>
                    <option>文具</option>
                    <option>家具・家電</option>
                    <option>その他</option>
                  </select>
                </Field>

                <Field label="日付">
                  <Input value={payDate} onChange={(e) => setPayDate(e.target.value)} type="date" />
                </Field>

                <Field label="購入金額（円）">
                  <Input
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    inputMode="numeric"
                    placeholder="例：1200"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="支払った人">
                    <select
                      className="w-full rounded-2xl border px-3 py-2"
                      value={payPayer}
                      onChange={(e) => setPayPayer(e.target.value as any)}
                    >
                      <option>なつ</option>
                      <option>たか</option>
                    </select>
                  </Field>
                  <Field label="誰の家（or共有）用？">
                    <select
                      className="w-full rounded-2xl border px-3 py-2"
                      value={payForWhom}
                      onChange={(e) => setPayForWhom(e.target.value as any)}
                    >
                      <option>なつ</option>
                      <option>たか</option>
                      <option>共有</option>
                    </select>
                  </Field>
                </div>

                <Field label="備考（任意）" className="md:col-span-2">
                  <Input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="空欄OK" />
                </Field>

                <div className="md:col-span-2">
                  <Button
                    className="w-full rounded-2xl bg-emerald-600 py-6 text-base font-extrabold hover:bg-emerald-700"
                    onClick={submitPayment}
                  >
                    支出を記録する
                  </Button>
                </div>

                <MonoBox text={payOut} />
              </div>
            )}

            {/* 収入フォーム */}
            {payMode === "収入" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <OwnerToggle value={ownerJa} onChange={setOwnerJa} />
                </div>
                <Field label="カテゴリー">
                  <select
                    className="w-full rounded-2xl border px-3 py-2"
                    value={incomeCategory}
                    onChange={(e) => setIncomeCategory(e.target.value)}
                  >
                    <option>給与</option>
                    <option>精算受取</option>
                    <option>副収入</option>
                    <option>その他</option>
                  </select>
                </Field>

                <Field label="日付">
                  <Input value={payDate} onChange={(e) => setPayDate(e.target.value)} type="date" />
                </Field>

                <Field label="金額（円）" className="md:col-span-2">
                  <Input
                    value={incomeAmount}
                    onChange={(e) => setIncomeAmount(e.target.value)}
                    inputMode="numeric"
                    placeholder="例：200000"
                  />
                </Field>

                <Field label="備考（任意）" className="md:col-span-2">
                  <Input value={incomeNote} onChange={(e) => setIncomeNote(e.target.value)} placeholder="空欄OK" />
                </Field>

                <div className="md:col-span-2">
                  <Button
                    className="w-full rounded-2xl bg-sky-600 py-6 text-base font-extrabold hover:bg-sky-700"
                    onClick={submitIncome}
                  >
                    収入を記録する
                  </Button>
                </div>

                <MonoBox text={incomeOut} />
              </div>
            )}
          </Section>
        )}

        {tab === "use" && (
          <Section title="🍳 2人で使った食材" subtitle="まとめて入力 → 合計 → 送信">
            <div className="flex flex-wrap items-end gap-3">
              <OwnerToggle value={ownerJa} onChange={setOwnerJa} />
              <Field label="日付" className="w-[180px]">
                <Input value={useDate} onChange={(e) => setUseDate(e.target.value)} type="date" />
              </Field>
              <Button
                variant="outline"
                className="rounded-2xl border-emerald-200 bg-white"
                onClick={() => loadFoods()}
              >
                食材を更新
              </Button>
              <div className="ml-auto rounded-2xl bg-emerald-50 px-4 py-2 text-sm font-extrabold text-emerald-800">
                合計：{useTotal} 円
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              {useRows.map((r, idx) => (
                <Card key={idx} className="rounded-3xl border-emerald-100 bg-white/80 p-4">
                  <div className="grid gap-3 md:grid-cols-[1fr_200px_120px]">
                    <div>
                      <div className="text-xs font-bold text-slate-500">具材</div>
                      <select
                        className="mt-1 w-full rounded-2xl border px-3 py-2"
                        value={r.item_id}
                        onChange={(e) => {
                          const v = e.target.value;
                          setUseRows((prev) => prev.map((x, i) => (i === idx ? { ...x, item_id: v } : x)));
                        }}
                      >
                        <option value="">（選択）</option>
                        {foods.map((f) => (
                          <option key={f.item_id} value={f.item_id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="text-xs font-bold text-slate-500">使用量</div>
                      <Input
                        className="mt-1"
                        value={r.useAmount}
                        onChange={(e) => {
                          const v = e.target.value;
                          setUseRows((prev) => prev.map((x, i) => (i === idx ? { ...x, useAmount: v } : x)));
                        }}
                        placeholder="例：0.5 / 120"
                      />
                    </div>

                    <div className="flex items-end justify-between gap-2">
                      <Button
                        variant="outline"
                        className="w-full rounded-2xl"
                        onClick={() => setUseRows((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        削除
                      </Button>
                    </div>
                  </div>

                  <RowHint foods={foods} itemId={r.item_id} useAmount={r.useAmount} />
                </Card>
              ))}

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="rounded-2xl border-emerald-200 bg-white"
                  onClick={() => setUseRows((prev) => [...prev, { item_id: "", useAmount: "" }])}
                >
                  ＋ 行を追加
                </Button>
                <Button
                  className="ml-auto rounded-2xl bg-emerald-600 hover:bg-emerald-700"
                  onClick={submitUse}
                >
                  送信
                </Button>
              </div>

              <MonoBox text={useOut} />
            </div>

            {/* 使用履歴 */}
            <div className="mt-6">
              <div className="mb-3 flex flex-wrap items-end gap-3">
                <div className="text-base font-extrabold tracking-tight">📋 使用履歴</div>
                {/* 表示モード切替 */}
                <div className="flex rounded-2xl bg-slate-100 p-1">
                  {(["日毎", "一覧"] as const).map((mode) => (
                    <button
                      key={mode}
                      className={cn(
                        "rounded-xl px-4 py-1.5 text-sm font-bold transition",
                        useHistoryViewMode === mode
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      )}
                      onClick={() => setUseHistoryViewMode(mode)}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs font-bold text-slate-600">月</Label>
                  <MonthPicker value={useHistoryMonthKey} onChange={setUseHistoryMonthKey} />
                </div>
                <Button
                  variant="outline"
                  className="rounded-2xl border-emerald-200 bg-white"
                  onClick={() => loadUseHistory()}
                >
                  更新
                </Button>
              </div>

              {useHistoryItems.length === 0 && !useHistoryOut ? (
                <div className="rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-600">
                  この月の使用記録はありません
                </div>
              ) : useHistoryViewMode === "日毎" ? (
                /* 日毎ビュー */
                <div className="grid gap-3">
                  {useHistoryByDate.map(({ date, logs, dayTotal }) => (
                    <Card key={date} className="rounded-3xl border-emerald-100 bg-white/80 p-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="font-extrabold text-emerald-900">{date}</div>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-extrabold text-emerald-800">
                          計 {Math.abs(dayTotal).toLocaleString()} 円
                        </span>
                      </div>
                      <div className="grid gap-2">
                        {logs.map((log) => (
                          <div key={log.id} className="rounded-2xl border bg-white p-3">
                            {useLogEditId === log.id ? (
                              <div className="grid gap-3">
                                <div className="grid gap-3 md:grid-cols-2">
                                  <Field label="日付">
                                    <Input
                                      type="date"
                                      value={useLogEditValues?.use_date ?? ""}
                                      onChange={(e) => setUseLogEditValues((v) => v ? { ...v, use_date: e.target.value } : v)}
                                    />
                                  </Field>
                                  <Field label={`使用量（${log.item_name}）`}>
                                    <Input
                                      inputMode="decimal"
                                      value={useLogEditValues?.use_amount ?? ""}
                                      onChange={(e) => setUseLogEditValues((v) => v ? { ...v, use_amount: e.target.value } : v)}
                                    />
                                  </Field>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    className="rounded-2xl"
                                    onClick={() => { setUseLogEditId(null); setUseLogEditValues(null); }}
                                  >
                                    キャンセル
                                  </Button>
                                  <Button
                                    className="ml-auto rounded-2xl bg-emerald-600 hover:bg-emerald-700"
                                    onClick={async () => {
                                      setUseHistoryOut("saving...");
                                      try {
                                        const newAmount = Number(useLogEditValues?.use_amount);
                                        if (!Number.isFinite(newAmount) || newAmount <= 0) {
                                          setUseHistoryOut("ERROR: 使用量が不正");
                                          return;
                                        }
                                        await apiPost("/api/food/use-history/update", {
                                          id: log.id,
                                          use_date: useLogEditValues?.use_date,
                                          use_amount: newAmount,
                                        });
                                        setUseLogEditId(null);
                                        setUseLogEditValues(null);
                                        await loadUseHistory();
                                        await loadFoods();
                                        await loadSettle();
                                      } catch (e: any) {
                                        setUseHistoryOut(String(e?.message ?? e));
                                      }
                                    }}
                                  >
                                    保存
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <div className="font-bold">{log.item_name}</div>
                                  <div className="text-xs text-slate-500">
                                    使用量：{log.use_amount} ・ {Math.abs(log.settle_delta).toLocaleString()} 円
                                  </div>
                                </div>
                                <div className="flex shrink-0 gap-2">
                                  <Button
                                    variant="outline"
                                    className="h-8 rounded-2xl text-xs"
                                    onClick={() => {
                                      setUseLogEditId(log.id);
                                      setUseLogEditValues({
                                        use_date: fmtYmd(log.use_date),
                                        use_amount: String(log.use_amount),
                                      });
                                    }}
                                  >
                                    修正
                                  </Button>
                                  <Button
                                    variant="outline"
                                    className="h-8 rounded-2xl text-xs border-red-200 text-red-600 hover:bg-red-50"
                                    onClick={async () => {
                                      setUseHistoryOut("deleting...");
                                      try {
                                        await apiPost("/api/food/use-history/delete", { id: log.id });
                                        await loadUseHistory();
                                        await loadFoods();
                                        await loadSettle();
                                        setUseHistoryOut("");
                                      } catch (e: any) {
                                        setUseHistoryOut(String(e?.message ?? e));
                                      }
                                    }}
                                  >
                                    削除
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                /* 一覧ビュー */
                <div className="grid gap-2">
                  {useHistoryItems.map((log) => (
                    <Card key={log.id} className="rounded-3xl border-emerald-100 bg-white/80 p-4">
                      {useLogEditId === log.id ? (
                        <div className="grid gap-3">
                          <div className="grid gap-3 md:grid-cols-2">
                            <Field label="日付">
                              <Input
                                type="date"
                                value={useLogEditValues?.use_date ?? ""}
                                onChange={(e) => setUseLogEditValues((v) => v ? { ...v, use_date: e.target.value } : v)}
                              />
                            </Field>
                            <Field label={`使用量（${log.item_name}）`}>
                              <Input
                                inputMode="decimal"
                                value={useLogEditValues?.use_amount ?? ""}
                                onChange={(e) => setUseLogEditValues((v) => v ? { ...v, use_amount: e.target.value } : v)}
                              />
                            </Field>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              className="rounded-2xl"
                              onClick={() => { setUseLogEditId(null); setUseLogEditValues(null); }}
                            >
                              キャンセル
                            </Button>
                            <Button
                              className="ml-auto rounded-2xl bg-emerald-600 hover:bg-emerald-700"
                              onClick={async () => {
                                setUseHistoryOut("saving...");
                                try {
                                  const newAmount = Number(useLogEditValues?.use_amount);
                                  if (!Number.isFinite(newAmount) || newAmount <= 0) {
                                    setUseHistoryOut("ERROR: 使用量が不正");
                                    return;
                                  }
                                  await apiPost("/api/food/use-history/update", {
                                    id: log.id,
                                    use_date: useLogEditValues?.use_date,
                                    use_amount: newAmount,
                                  });
                                  setUseLogEditId(null);
                                  setUseLogEditValues(null);
                                  await loadUseHistory();
                                  await loadFoods();
                                  await loadSettle();
                                } catch (e: any) {
                                  setUseHistoryOut(String(e?.message ?? e));
                                }
                              }}
                            >
                              保存
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-extrabold">{log.item_name}</div>
                            <span className="text-sm font-extrabold text-emerald-800">
                              {Math.abs(log.settle_delta).toLocaleString()} 円
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {fmtYmd(log.use_date)} ・ 使用量：{log.use_amount} ・ 単価：{Math.round(log.amount_per_unit * 1000) / 1000} 円
                          </div>
                          <div className="mt-2 flex gap-2">
                            <Button
                              variant="outline"
                              className="h-8 rounded-2xl text-xs"
                              onClick={() => {
                                setUseLogEditId(log.id);
                                setUseLogEditValues({
                                  use_date: fmtYmd(log.use_date),
                                  use_amount: String(log.use_amount),
                                });
                              }}
                            >
                              修正
                            </Button>
                            <Button
                              variant="outline"
                              className="h-8 rounded-2xl text-xs border-red-200 text-red-600 hover:bg-red-50"
                              onClick={async () => {
                                setUseHistoryOut("deleting...");
                                try {
                                  await apiPost("/api/food/use-history/delete", { id: log.id });
                                  await loadUseHistory();
                                  await loadFoods();
                                  await loadSettle();
                                  setUseHistoryOut("");
                                } catch (e: any) {
                                  setUseHistoryOut(String(e?.message ?? e));
                                }
                              }}
                            >
                              削除
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}

              <MonoBox text={useHistoryOut} />
            </div>
          </Section>
        )}

        {tab === "manage" && (
          <Section title="🥬 食材管理" subtitle="一覧 / 追加 / 月フィルタ（料理っぽく整理）">
            <div className="flex flex-wrap items-end gap-3">
              <OwnerToggle value={ownerJa} onChange={setOwnerJa} />
              <div className="grid gap-1">
                <Label className="text-xs font-bold text-slate-600">月フィルタ</Label>
                <MonthPicker value={manageMonthKey} onChange={setManageMonthKey} allowAll />
              </div>

              <Button
                variant="outline"
                className="rounded-2xl border-emerald-200 bg-white"
                onClick={() => loadManage()}
              >
                更新
              </Button>

              <Button
                className="ml-auto rounded-2xl bg-emerald-600 hover:bg-emerald-700"
                onClick={() => setAddOpen((v) => !v)}
              >
                ＋ 食材を追加
              </Button>
            </div>

            {addOpen && (
              <Card className="mt-4 rounded-3xl border-emerald-100 bg-white/85 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="具材名">
                    <Input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="例：にんじん" />
                  </Field>
                  <Field label="購入日">
                    <Input value={addPurchaseDate} onChange={(e) => setAddPurchaseDate(e.target.value)} type="date" />
                  </Field>

                  <Field label="金額（円）">
                    <Input value={addPrice} onChange={(e) => setAddPrice(e.target.value)} placeholder="例：300" />
                  </Field>
                  <Field label="内容量">
                    <Input value={addVolume} onChange={(e) => setAddVolume(e.target.value)} placeholder="例：3 / 250" />
                  </Field>

                  <Field label="単位">
                    <select
                      className="w-full rounded-2xl border px-3 py-2"
                      value={addUnit}
                      onChange={(e) => setAddUnit(e.target.value)}
                    >
                      <option value="個">個</option>
                      <option value="g">g</option>
                      <option value="ml">ml</option>
                      <option value="枚">枚</option>
                    </select>
                  </Field>
                  <Field label="残量">
                    <Input value={addRemain} onChange={(e) => setAddRemain(e.target.value)} placeholder="例：3 / 120" />
                  </Field>

                  <Field label="備考（任意）" className="md:col-span-2">
                    <Input value={addNote} onChange={(e) => setAddNote(e.target.value)} placeholder="例：特売" />
                  </Field>

                  <div className="md:col-span-2 flex gap-2">
                    <Button variant="outline" className="rounded-2xl" onClick={() => setAddOpen(false)}>
                      キャンセル
                    </Button>
                    <Button className="ml-auto rounded-2xl bg-emerald-600 hover:bg-emerald-700" onClick={submitAddFood}>
                      追加する
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Card className="rounded-3xl border-emerald-100 bg-white/80 p-4">
                <div className="mb-2 flex items-baseline justify-between">
                  <div className="text-sm font-extrabold text-emerald-800">🟢 冷蔵庫の食材</div>
                  <div className="text-xs text-slate-500">{manageItems.length} 件</div>
                </div>

                {manageItems.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
                    まだ食材がありません（右上の「追加」から入れてね）
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {manageItems.map((it) => (
                      <div key={it.item_id} className="rounded-2xl border bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-extrabold">{it.name}</div>
                          <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800">
                            残 {it.remain ?? "-"} {it.unit}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-600">
                          単価 {Math.round((it.amountPerUnit || 0) * 1000) / 1000} 円/{it.unit} ・ 購入日{" "}
                          {fmtYmd(it.purchaseDate)}
                        </div>

                        <div className="mt-2 flex gap-2">
                          <Button
                            variant="outline"
                            className="h-9 rounded-2xl text-xs"
                            onClick={async () => {
                              setManageOut("deleting...");
                              try {
                                await apiPost("/api/food/manage/delete", {
                                  owner: ownerDb,
                                  itemIds: [it.item_id],
                                });
                                await loadManage();
                                await loadFoods();
                                setManageOut("");
                              } catch (e: any) {
                                setManageOut(String(e?.message ?? e));
                              }
                            }}
                          >
                          削除
                          </Button>
                          {editId === it.item_id ? (
                            <div className="mt-3 grid gap-2">
                              <Input
                                value={String(editValues?.remain ?? "")}
                                placeholder="残量"
                                onChange={(e) => setEditValues((v) => v ? { ...v, remain: Number(e.target.value) } : v)}
                              />
                              <Input
                                value={String(editValues?.volume ?? "")}
                                placeholder="内容量"
                                onChange={(e) => setEditValues((v) => v ? { ...v, volume: Number(e.target.value) } : v)}
                              />
                              <Input
                                value={String(editValues?.price ?? "")}
                                placeholder="金額"
                                onChange={(e) => setEditValues((v) => v ? { ...v, price: Number(e.target.value) } : v)}
                              />
                              <Input
                                value={editValues?.note ?? ""}
                                placeholder="備考"
                                onChange={(e) => setEditValues((v) => v ? { ...v, note: e.target.value } : v)}
                              />

                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  onClick={() => { setEditId(null); setEditValues(null); }}
                                >
                                  キャンセル
                                </Button>

                                <Button
                                  className="bg-emerald-600 hover:bg-emerald-700"
                                  onClick={async () => {
                                    try {
                                      await apiPost("/api/food/manage/update", {
                                        owner: ownerDb,
                                        item_id: it.item_id,
                                        volume: editValues?.volume,
                                        remain: editValues?.remain,
                                        price: editValues?.price,
                                        note: editValues?.note,
                                      });
                                      setEditId(null);
                                      setEditValues(null);
                                      await loadManage();
                                      await loadFoods();
                                    } catch (e: any) {
                                      setManageOut(String(e?.message ?? e));
                                    }
                                  }}
                                >
                                  保存
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              className="h-9 rounded-2xl text-xs"
                              onClick={() => {
                                setEditId(it.item_id);
                                setEditValues({
                                  remain: it.remain ?? 0,
                                  volume: it.volume ?? 1,
                                  price: it.amountPerUnit * (it.volume ?? 1),
                                  note: it.note ?? "",
                                });
                              }}
                            >
                              修正
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card className="rounded-3xl border-emerald-100 bg-white/80 p-4">
                <div className="mb-2 flex items-baseline justify-between">
                  <div className="text-sm font-extrabold text-amber-800">🟠 最近使い切った</div>
                  <div className="text-xs text-slate-500">{manageDeleted.length} 件</div>
                </div>

                {manageDeleted.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">最近削除はありません</div>
                ) : (
                  <div className="grid gap-2">
                    {manageDeleted.map((it) => (
                      <div key={it.item_id} className="rounded-2xl border bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-extrabold">{it.name}</div>
                          <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">
                            削除 {fmtYmd(it.deleteDate)}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-600">
                          単価 {Math.round((it.amountPerUnit || 0) * 1000) / 1000} 円/{it.unit} ・ 購入日{" "}
                          {fmtYmd(it.purchaseDate)}
                        </div>

                        <div className="mt-2">
                          {restoreId === it.item_id ? (
                            <div className="grid gap-2">
                              <div className="flex items-center gap-2">
                                <Input
                                  className="h-9"
                                  inputMode="decimal"
                                  placeholder={`残量（${it.unit}）`}
                                  value={restoreRemain}
                                  onChange={(e) => setRestoreRemain(e.target.value)}
                                />
                                <span className="shrink-0 text-xs text-slate-500">{it.unit}</span>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  className="h-8 flex-1 rounded-2xl text-xs"
                                  onClick={() => { setRestoreId(null); setRestoreRemain(""); }}
                                >
                                  キャンセル
                                </Button>
                                <Button
                                  className="h-8 flex-1 rounded-2xl bg-emerald-600 text-xs hover:bg-emerald-700"
                                  onClick={async () => {
                                    const remain = Number(restoreRemain);
                                    if (!Number.isFinite(remain) || remain < 0) {
                                      setManageOut("ERROR: 残量を正しく入力してください");
                                      return;
                                    }
                                    setManageOut("restoring...");
                                    try {
                                      await apiPost("/api/food/manage/restore", {
                                        owner: ownerDb,
                                        itemId: it.item_id,
                                        remain,
                                      });
                                      setRestoreId(null);
                                      setRestoreRemain("");
                                      await loadManage();
                                      await loadFoods();
                                      setManageOut("");
                                    } catch (e: any) {
                                      setManageOut(String(e?.message ?? e));
                                    }
                                  }}
                                >
                                  確定
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              className="h-9 w-full rounded-2xl text-xs"
                              onClick={() => {
                                setRestoreId(it.item_id);
                                setRestoreRemain("");
                              }}
                            >
                              取消（復元）
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <MonoBox text={manageOut} />
          </Section>
        )}

        {tab === "kakeibo" && (
          <Section title="📒 家計簿" subtitle={`${ownerJa}の${kakeiboViewMode}一覧`}>
            {/* コントロール行 */}
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <OwnerToggle value={ownerJa} onChange={setOwnerJa} />
              <div className="flex rounded-2xl bg-slate-100 p-1">
                {(["支出", "収入"] as const).map((mode) => (
                  <button
                    key={mode}
                    className={cn(
                      "rounded-xl px-5 py-1.5 text-sm font-bold transition",
                      kakeiboViewMode === mode
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    )}
                    onClick={() => setKakeiboViewMode(mode)}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <div className="grid gap-1">
                <Label className="text-xs font-bold text-slate-600">月</Label>
                <MonthPicker value={kakeiboMonthKey} onChange={setKakeiboMonthKey} />
              </div>
              <Button
                variant="outline"
                className="rounded-2xl border-emerald-200 bg-white"
                onClick={() => loadKakeibo()}
              >
                更新
              </Button>
              <div className="ml-auto flex flex-wrap gap-2">
                <div className="rounded-2xl bg-red-50 px-3 py-2 text-sm font-extrabold text-red-700">
                  支出：{kakeiboTotalExpense.toLocaleString()} 円
                </div>
                <div className="rounded-2xl bg-sky-50 px-3 py-2 text-sm font-extrabold text-sky-700">
                  収入：{kakeiboTotalIncome.toLocaleString()} 円
                </div>
                <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-extrabold text-emerald-800">
                  収支：{Math.abs(kakeiboTotal).toLocaleString()} 円
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              {kakeiboItems.length === 0 && !kakeiboOut ? (
                <div className="rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-600">
                  この月の記録はありません
                </div>
              ) : (
                kakeiboItems
                  .filter((e) => kakeiboViewMode === "支出" ? e.entry_type === "expense" : e.entry_type === "income")
                  .map((entry) => (
                  <Card key={entry.id} className="rounded-3xl border-emerald-100 bg-white/80 p-4">
                    {kakeiboEditId === entry.id ? (
                      <div className="grid gap-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <Field label="購入品">
                            <Input
                              value={kakeiboEditValues?.item ?? ""}
                              onChange={(e) => setKakeiboEditValues((v) => v ? { ...v, item: e.target.value } : v)}
                            />
                          </Field>
                          <Field label="日付">
                            <Input
                              type="date"
                              value={kakeiboEditValues?.date ?? ""}
                              onChange={(e) => setKakeiboEditValues((v) => v ? { ...v, date: e.target.value } : v)}
                            />
                          </Field>
                          <Field label="金額（円）">
                            <Input
                              inputMode="numeric"
                              value={kakeiboEditValues?.amount ?? ""}
                              onChange={(e) => setKakeiboEditValues((v) => v ? { ...v, amount: e.target.value } : v)}
                            />
                          </Field>
                          <Field label="カテゴリー">
                            <select
                              className="w-full rounded-2xl border px-3 py-2"
                              value={kakeiboEditValues?.category ?? ""}
                              onChange={(e) => setKakeiboEditValues((v) => v ? { ...v, category: e.target.value } : v)}
                            >
                              <option>食材</option>
                              <option>文具</option>
                              <option>家具・家電</option>
                              <option>その他</option>
                            </select>
                          </Field>
                          <Field label="備考" className="md:col-span-2">
                            <Input
                              value={kakeiboEditValues?.note ?? ""}
                              onChange={(e) => setKakeiboEditValues((v) => v ? { ...v, note: e.target.value } : v)}
                            />
                          </Field>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            className="rounded-2xl"
                            onClick={() => { setKakeiboEditId(null); setKakeiboEditValues(null); }}
                          >
                            キャンセル
                          </Button>
                          <Button
                            className="ml-auto rounded-2xl bg-emerald-600 hover:bg-emerald-700"
                            onClick={async () => {
                              try {
                                await apiPost("/api/kakeibo/update", {
                                  id: entry.id,
                                  item: kakeiboEditValues?.item,
                                  date: kakeiboEditValues?.date,
                                  amount: Math.abs(Number(kakeiboEditValues?.amount)),
                                  category: kakeiboEditValues?.category,
                                  note: kakeiboEditValues?.note,
                                });
                                setKakeiboEditId(null);
                                setKakeiboEditValues(null);
                                await loadKakeibo();
                              } catch (e: any) {
                                setKakeiboOut(String(e?.message ?? e));
                              }
                            }}
                          >
                            保存
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold">{entry.item}</span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                              {entry.category}
                            </span>
                          </div>
                          <span className="text-base font-extrabold text-emerald-800">
                            {Math.abs(entry.amount).toLocaleString()} 円
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {fmtYmd(entry.date)}
                          {entry.note ? ` ・ ${entry.note}` : ""}
                        </div>
                        <div className="mt-2 flex gap-2">
                          <Button
                            variant="outline"
                            className="h-8 rounded-2xl text-xs"
                            onClick={() => {
                              setKakeiboEditId(entry.id);
                              setKakeiboEditValues({
                                item: entry.item,
                                date: fmtYmd(entry.date),
                                amount: String(Math.abs(entry.amount)),
                                category: entry.category,
                                note: entry.note ?? "",
                              });
                            }}
                          >
                            修正
                          </Button>
                          <Button
                            variant="outline"
                            className="h-8 rounded-2xl text-xs border-red-200 text-red-600 hover:bg-red-50"
                            onClick={async () => {
                              setKakeiboOut("deleting...");
                              try {
                                await apiPost("/api/kakeibo/delete", { id: entry.id });
                                await loadKakeibo();
                                setKakeiboOut("");
                              } catch (e: any) {
                                setKakeiboOut(String(e?.message ?? e));
                              }
                            }}
                          >
                            削除
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>

            <MonoBox text={kakeiboOut} />
          </Section>
        )}
      </main>

      {/* Bottom nav (Mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t bg-white/90 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-5xl grid-cols-4 px-2 py-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                window.history.replaceState(null, "", `/?page=${t.key}`);
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-xs font-bold",
                tab === t.key ? "bg-emerald-50 text-emerald-800" : "text-slate-600"
              )}
            >
              <span className="text-lg">{t.emoji}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function Section(props: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <div className="mb-3">
        <div className="text-xl font-extrabold tracking-tight">{props.title}</div>
        {props.subtitle && <div className="mt-1 text-sm text-slate-600">{props.subtitle}</div>}
      </div>
      {props.children}
    </section>
  );
}

function Field(props: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-1", props.className)}>
      <Label className="text-xs font-bold text-slate-600">{props.label}</Label>
      {props.children}
    </div>
  );
}

function MonoBox({ text }: { text: string }) {
  if (!text) return null;
  return (
    <Card className="mt-4 rounded-3xl border-slate-200 bg-slate-950 p-4 text-xs text-slate-100">
      <pre className="whitespace-pre-wrap">{text}</pre>
    </Card>
  );
}

function OwnerToggle({
  value,
  onChange,
}: {
  value: "なつ" | "たか";
  onChange: (v: "なつ" | "たか") => void;
}) {
  return (
    <div className="flex rounded-2xl bg-slate-100 p-1">
      {(["なつ", "たか"] as const).map((name) => (
        <button
          key={name}
          className={cn(
            "rounded-xl px-4 py-1.5 text-sm font-bold transition",
            value === name
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          )}
          onClick={() => onChange(name)}
        >
          {name}
        </button>
      ))}
    </div>
  );
}

function MonthPicker({
  value,
  onChange,
  allowAll = false,
}: {
  value: string;
  onChange: (v: string) => void;
  allowAll?: boolean;
}) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i); // 2年前〜2年後
  const months = ["01","02","03","04","05","06","07","08","09","10","11","12"];

  const selectedYear = value ? value.slice(0, 4) : "";
  const selectedMonth = value ? value.slice(5, 7) : "";

  function handleYear(y: string) {
    if (!y) { onChange(""); return; }
    const m = selectedMonth || String(new Date().getMonth() + 1).padStart(2, "0");
    onChange(`${y}-${m}`);
  }

  function handleMonth(m: string) {
    if (!selectedYear) return;
    onChange(`${selectedYear}-${m}`);
  }

  return (
    <div className="flex gap-2">
      <select
        className="rounded-2xl border px-3 py-2 text-sm"
        value={selectedYear}
        onChange={(e) => handleYear(e.target.value)}
      >
        {allowAll && <option value="">すべて</option>}
        {years.map((y) => (
          <option key={y} value={String(y)}>{y}年</option>
        ))}
      </select>
      <select
        className="rounded-2xl border px-3 py-2 text-sm disabled:opacity-40"
        value={selectedMonth}
        disabled={!selectedYear}
        onChange={(e) => handleMonth(e.target.value)}
      >
        {!selectedYear && <option value="">--月</option>}
        {months.map((m) => (
          <option key={m} value={m}>{Number(m)}月</option>
        ))}
      </select>
    </div>
  );
}

function RowHint({ foods, itemId, useAmount }: { foods: FoodItem[]; itemId: string; useAmount: string }) {
  const it = foods.find((x) => x.item_id === itemId);
  const amt = Number(useAmount);
  const sub =
    it && Number.isFinite(amt) && amt > 0 ? Math.round((Number(it.amountPerUnit) || 0) * amt) : 0;

  if (!it) return null;

  return (
    <div className="mt-3 grid gap-1 rounded-2xl bg-emerald-50 p-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-bold text-emerald-900">単価</span>
        <span className="font-extrabold text-emerald-900">
          {Math.round((it.amountPerUnit || 0) * 1000) / 1000} 円/{it.unit}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="font-bold text-emerald-900">残量</span>
        <span className="font-extrabold text-emerald-900">
          {it.remain} {it.unit}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="font-bold text-emerald-900">小計</span>
        <span className="font-extrabold text-emerald-900">{sub} 円</span>
      </div>
    </div>
  );
}
