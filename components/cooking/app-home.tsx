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

type SettleEntry = {
  id: number;
  date: string;
  delta: number;
  source: string;
  meta: Record<string, any> | null;
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
  unit: string;
  settle_delta: number;
  created_at: string;
};

type UseResult = {
  date: string;
  rows: { name: string; amount: number; unit: string }[];
  fixedItems: { name: string; amount: number }[];
  total: number;
};

type PayResult = {
  type: "支出" | "収入";
  category: string;
  date: string;
  amount: number;
  payer?: string;
  forWhom?: string;
  note?: string;
  settleDelta?: number;
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

function sourceLabel(source: string) {
  if (source === "payment") return "支出";
  if (source === "food_use" || source === "food.use" || source === "food_use_group") return "食材使用";
  if (source === "food_use_correction" || source === "food.use_correction") return "修正";
  return source;
}

function settleMessage(total: number) {
  const rounded = Math.round(total);
  if (rounded > 0) return `なつに返金： ${rounded} 円`;
  if (rounded < 0) return `たかに返金： ${Math.abs(rounded)} 円`;
  return "貸し借りなし！";
}

function settleDeltaLabel(delta: number): string {
  const abs = Math.round(Math.abs(delta)).toLocaleString();
  if (delta > 0) return `${abs}円`;
  if (delta < 0) return `${abs}円`;
  return "0円";
}

type AddItemDraft = {
  _key: string;
  name: string;
  price: string;
  volume: string;
  unit: string;
  remain: string;
  purchaseDate: string;
  note: string;
};
function blankDraft(): AddItemDraft {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { _key: Math.random().toString(36).slice(2), name: "", price: "", volume: "", unit: "個", remain: "", purchaseDate: today, note: "" };
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

  // 支出・収入 記録結果
  const [payResult, setPayResult] = useState<PayResult | null>(null);

  // LINE LIFF
  const [liffOwner, setLiffOwner] = useState<"なつ" | "たか" | null>(null);
  const [liffReady, setLiffReady] = useState(false);
  const [liffError, setLiffError] = useState<string | null>(null);

  // 精算表示
  const [settleTotal, setSettleTotal] = useState<number>(0);
  const [settleMonthKey, setSettleMonthKey] = useState<string>("");
  const [settleDetailOpen, setSettleDetailOpen] = useState(false);
  const [settleDetailItems, setSettleDetailItems] = useState<SettleEntry[]>([]);
  const [settleDetailLoading, setSettleDetailLoading] = useState(false);

  // 使用（food.list）
  const [useDate, setUseDate] = useState<string>("");
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [useRows, setUseRows] = useState<{ item_id: string; useAmount: string }[]>([
    { item_id: "", useAmount: "" },
    { item_id: "", useAmount: "" },
    { item_id: "", useAmount: "" },
    { item_id: "", useAmount: "" },
  ]);
  const [useOut, setUseOut] = useState<string>("");

  // 使用食材 記録結果
  const [useResult, setUseResult] = useState<UseResult | null>(null);

  // 固定費チェックボックス（項目名→チェック状態）
  const [fixedChecked, setFixedChecked] = useState<Record<string, boolean>>({
    調味料: true,
    水道代: true,
    電気代: true,
    ガス代: true,
  });

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

  // 家計簿専用owner（LIFFが有効な場合はLIFF優先、未認証時は手動トグル）
  const kakeiboOwnerJa = liffOwner ?? ownerJa;
  const kakeiboOwnerDb = kakeiboOwnerJa === "なつ" ? "natsu" : "taka";

  // 家計簿表示フィルタ
  const [kakeiboViewMode, setKakeiboViewMode] = useState<"支出" | "収入">("支出");

  // 食材情報修正
  const [editId, setEditId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ name: string; remain: string; volume: string; price: string; note: string; purchaseDate: string } | null>(null);

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
  const [addItems, setAddItems] = useState<AddItemDraft[]>(() => [blankDraft()]);
  // 削除確認
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  // LIFF初期化
  useEffect(() => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    if (!liffId) {
      setLiffError("LIFF IDが設定されていません");
      setLiffReady(true);
      return;
    }
    (async () => {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId });
        if (!liff.isInClient()) {
          setLiffError("このアプリはLINEアプリからのみ利用できます");
          setLiffReady(true);
          return;
        }
        if (!liff.isLoggedIn()) { liff.login(); return; }
        const profile = await liff.getProfile();
        const natsuId = process.env.NEXT_PUBLIC_LIFF_NATSU_USER_ID;
        const takaId = process.env.NEXT_PUBLIC_LIFF_TAKA_USER_ID;
        if (profile.userId === natsuId) setLiffOwner("なつ");
        else if (profile.userId === takaId) setLiffOwner("たか");
        else setLiffError("このLINEアカウントにはアクセス権限がありません");
        setLiffReady(true);
      } catch (e) {
        console.error("LIFF init error:", e);
        setLiffError("初期化に失敗しました。再度お試しください");
        setLiffReady(true);
      }
    })();
  }, []);

  // LIFFユーザーが確定したら ownerJa / payPayer を同期
  useEffect(() => {
    if (liffOwner) {
      setOwnerJa(liffOwner);
      setPayPayer(liffOwner);
    }
  }, [liffOwner]);

  useEffect(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
  
    const today = `${yyyy}-${mm}-${dd}`;
    const monthKey = `${yyyy}-${mm}`;
  
    if (!payDate) setPayDate(today);
    if (!useDate) setUseDate(today);
    setAddItems((prev) => prev.map((d, i) => i === 0 && !d.purchaseDate ? { ...d, purchaseDate: today } : d));
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
  }, [tab, ownerDb, manageMonthKey, kakeiboMonthKey, useHistoryMonthKey, kakeiboOwnerDb]);

  // 精算バッジは settleMonthKey 変更時に常時更新
  useEffect(() => {
    void loadSettle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settleMonthKey]);

  async function loadFoods() {
    setUseOut("読み込み中");
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
    setUseHistoryOut("読み込み中");
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
    setManageOut("読み込み中");
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

  async function loadSettle(): Promise<number> {
    try {
      const res = await apiGet<{ ok: boolean; total: number }>(
        `/api/settle/get?month=${encodeURIComponent(settleMonthKey)}`
      );
      const total = Number(res.total) || 0;
      setSettleTotal(total);
      return total;
    } catch {
      return settleTotal;
    }
  }

  async function loadSettleDetail() {
    setSettleDetailLoading(true);
    try {
      const res = await apiGet<{ ok: boolean; items: SettleEntry[] }>(
        `/api/settle/list?month=${encodeURIComponent(settleMonthKey)}`
      );
      setSettleDetailItems(res.items ?? []);
    } catch {
      setSettleDetailItems([]);
    } finally {
      setSettleDetailLoading(false);
    }
  }

  async function loadKakeibo() {
    setKakeiboOut("読み込み中");
    try {
      const qs = new URLSearchParams();
      qs.set("owner", kakeiboOwnerDb);
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
    setPayOut("送信中");
    setPayResult(null);
    try {
      const amount = Number(payAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        setPayOut("ERROR: 金額が不正");
        return;
      }
      const oldSettle = settleTotal;
      await apiPost<any>("/api/payment/add", {
        category: payCategory,
        date: payDate,
        amount,
        payer: payPayer,
        forWhom: payForWhom,
        note: payNote,
      });
      const newSettle = await loadSettle();
      setPayResult({
        type: "支出",
        category: payCategory,
        date: payDate,
        amount,
        payer: payPayer,
        forWhom: payForWhom,
        note: payNote,
        settleDelta: newSettle - oldSettle,
      });
      setPayOut("");
      setPayAmount("");
      setPayNote("");
    } catch (e: any) {
      setPayOut(String(e?.message ?? e));
    }
  }

  // --- 収入記録 ---
  async function submitIncome() {
    setIncomeOut("送信中");
    setPayResult(null);
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
      await apiPost<any>("/api/kakeibo/add", {
        owner: ownerDb,
        category: incomeCategory,
        date: payDate,
        amount,
        note: incomeNote,
      });
      setPayResult({
        type: "収入",
        category: incomeCategory,
        date: payDate,
        amount,
        note: incomeNote,
      });
      setIncomeOut("");
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
    for (const fi of FIXED_ITEMS[ownerDb]) {
      if (fixedChecked[fi.name]) total += fi.amount;
    }
    return Math.round(total);
  }, [foods, useRows, ownerDb, fixedChecked]);

  const useHistoryByDate = useMemo(() => {
    const dateMap = new Map<string, Map<string, UseLogEntry[]>>();
    for (const log of useHistoryItems) {
      const date = fmtYmd(log.use_date);
      // 分単位のcreated_atでセッションをグループ化（同一送信分をまとめる）
      const sessKey = log.created_at ? log.created_at.slice(0, 16) : date;
      if (!dateMap.has(date)) dateMap.set(date, new Map());
      const sessMap = dateMap.get(date)!;
      if (!sessMap.has(sessKey)) sessMap.set(sessKey, []);
      sessMap.get(sessKey)!.push(log);
    }
    return Array.from(dateMap.entries()).map(([date, sessMap]) => {
      const sessions = Array.from(sessMap.entries()).map(([key, logs]) => ({
        key,
        logs,
        sessionTotal: logs.reduce((s, l) => s + Number(l.settle_delta), 0),
      }));
      return {
        date,
        sessions,
        dayTotal: sessions.reduce((s, sess) => s + sess.sessionTotal, 0),
      };
    });
  }, [useHistoryItems]);

  // 精算詳細：食材使用も含めて各エントリを個別表示→日毎カード構造
  const settleDetailProcessed = useMemo(() => {
    const all = [...settleDetailItems].sort((a, b) => b.date.localeCompare(a.date));
    const byDate = new Map<string, { entries: SettleEntry[]; dayTotal: number }>();
    for (const e of all) {
      const date = fmtYmd(e.date);
      if (!byDate.has(date)) byDate.set(date, { entries: [], dayTotal: 0 });
      byDate.get(date)!.entries.push(e);
      byDate.get(date)!.dayTotal += e.delta;
    }
    return Array.from(byDate.entries()).map(([date, v]) => ({ date, ...v }));
  }, [settleDetailItems]);

  // 家計簿：日毎グループ
  const kakeiboByDate = useMemo(() => {
    const filtered = kakeiboItems.filter((e) =>
      kakeiboViewMode === "支出" ? e.entry_type === "expense" : e.entry_type === "income"
    );
    const map = new Map<string, { entries: KakeiboEntry[]; dayTotal: number }>();
    for (const entry of filtered) {
      const date = fmtYmd(entry.date);
      if (!map.has(date)) map.set(date, { entries: [], dayTotal: 0 });
      map.get(date)!.entries.push(entry);
      map.get(date)!.dayTotal += entry.amount;
    }
    return Array.from(map.entries()).map(([date, v]) => ({ date, ...v }));
  }, [kakeiboItems, kakeiboViewMode]);

  async function submitUse() {
    setUseOut("送信中");
    try {
      const rows = useRows
        .map((r) => ({ item_id: r.item_id, useAmount: Number(r.useAmount) }))
        .filter((r) => r.item_id && Number.isFinite(r.useAmount) && r.useAmount > 0);

      const fixed_items = FIXED_ITEMS[ownerDb].filter((fi) => fixedChecked[fi.name]);

      if (!useDate) {
        setUseOut("ERROR: 日付が未入力");
        return;
      }
      if (rows.length === 0 && fixed_items.length === 0) {
        setUseOut("ERROR: 具材と使用量を入力");
        return;
      }

      await apiPost<any>("/api/food/use", {
        owner: ownerDb,
        date: useDate,
        rows,
        fixed_items,
      });

      const submittedRows = useRows
        .map((r) => {
          const food = foods.find((f) => f.item_id === r.item_id);
          const amt = Number(r.useAmount);
          if (!food || !Number.isFinite(amt) || amt <= 0) return null;
          return { name: food.name, amount: Math.round((food.amountPerUnit || 0) * amt), unit: food.unit };
        })
        .filter((r): r is { name: string; amount: number; unit: string } => r !== null);
      setUseResult({
        date: useDate,
        rows: submittedRows,
        fixedItems: FIXED_ITEMS[ownerDb].filter((fi) => fixedChecked[fi.name]),
        total: useTotal,
      });
      setUseOut("");
      // 更新
      await loadFoods();
      await loadSettle();
      setUseRows([
        { item_id: "", useAmount: "" },
        { item_id: "", useAmount: "" },
        { item_id: "", useAmount: "" },
        { item_id: "", useAmount: "" },
      ]);
    } catch (e: any) {
      setUseOut(String(e?.message ?? e));
    }
  }

  // --- 管理：追加 ---
  function updateDraft(key: string, field: keyof Omit<AddItemDraft, "_key">, value: string) {
    setAddItems((prev) => prev.map((d) => (d._key === key ? { ...d, [field]: value } : d)));
  }
  function removeDraft(key: string) {
    setAddItems((prev) => {
      if (prev.length <= 1) return [blankDraft()];
      return prev.filter((d) => d._key !== key);
    });
  }
  function addMoreDraft() {
    setAddItems((prev) => [...prev, blankDraft()]);
  }
  async function submitAddFood() {
    setManageOut("追加中");
    try {
      const items = addItems.map((d) => ({
        name: d.name.trim(),
        price: Number(d.price),
        volume: Number(d.volume),
        unit: d.unit,
        remain: Number(d.remain),
        purchaseDate: d.purchaseDate,
        note: d.note,
      }));
      for (const item of items) {
        if (!item.name) return setManageOut("ERROR: 具材名が空");
        if (!Number.isFinite(item.price) || item.price <= 0) return setManageOut("ERROR: 金額が不正");
        if (!Number.isFinite(item.volume) || item.volume <= 0) return setManageOut("ERROR: 内容量が不正");
        if (!Number.isFinite(item.remain) || item.remain < 0) return setManageOut("ERROR: 残量が不正");
        if (!item.purchaseDate) return setManageOut("ERROR: 購入日が空");
      }
      await apiPost<any>("/api/food/manage/add", { owner: ownerDb, items });
      setAddOpen(false);
      setAddItems([blankDraft()]);
      setManageOut("");
      await loadManage();
      await loadFoods();
    } catch (e: any) {
      setManageOut(String(e?.message ?? e));
    }
  }

  // --- LIFF アクセスゲート ---
  if (!liffReady) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-emerald-50 to-white">
        <div className="text-center text-slate-500">
          <div className="text-4xl">🍲</div>
          <div className="mt-3 text-sm">読み込み中...</div>
        </div>
      </div>
    );
  }

  if (liffError) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-emerald-50 to-white px-6">
        <div className="text-center">
          <div className="text-4xl">⚠️</div>
          <div className="mt-4 text-base font-extrabold text-slate-700">{liffError}</div>
          <div className="mt-2 text-sm text-slate-500">LINEアプリから開いてください</div>
        </div>
      </div>
    );
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
              <div className="text-sm font-extrabold tracking-tight">ごはんと家計簿のアプリ</div>
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
                setSettleDetailOpen(false);
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
          <div className="text-xs font-bold text-emerald-700">精算</div>
          <div className="mt-2 flex items-center gap-1.5">
            <MonthPicker value={settleMonthKey} onChange={setSettleMonthKey} compact />
            <Button
              size="sm"
              className="shrink-0 rounded-2xl bg-emerald-600 hover:bg-emerald-700"
              onClick={() => loadSettle()}
            >
              更新
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 rounded-2xl border-emerald-200 bg-white"
              onClick={async () => {
                if (!settleDetailOpen) {
                  await loadSettleDetail();
                }
                setSettleDetailOpen((v) => !v);
              }}
            >
              {settleDetailOpen ? "閉じる" : "詳細を見る"}
            </Button>
          </div>
          <div className="mt-3 text-lg font-extrabold">{settleMessage(settleTotal)}</div>
          {settleDetailOpen && (
            <div className="mt-3">
              {settleDetailLoading ? (
                <div className="text-xs text-slate-500">読み込み中...</div>
              ) : settleDetailItems.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
                  この月の明細はありません
                </div>
              ) : (
                <div className="grid gap-3">
                  {settleDetailProcessed.map(({ date, entries, dayTotal }) => (
                    <Card key={date} className="rounded-2xl border-emerald-100 bg-white/80 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-sm font-extrabold text-emerald-900">{date}</div>
                        <span className={cn("text-xs font-extrabold", dayTotal > 0 ? "text-red-600" : dayTotal < 0 ? "text-emerald-700" : "text-slate-500")}>
                          合計：{settleDeltaLabel(dayTotal)}
                        </span>
                      </div>
                      <div className="grid gap-1.5">
                        {entries.map((entry) => (
                          <div key={entry.id} className="flex items-center justify-between gap-2 rounded-xl border bg-white px-3 py-2 text-sm">
                            <div className="font-bold">
                              {sourceLabel(entry.source)}
                              {entry.meta?.item_name ? `（${entry.meta.item_name}）` : ""}
                            </div>
                            <span className={cn("shrink-0 font-extrabold", entry.delta > 0 ? "text-red-600" : entry.delta < 0 ? "text-emerald-700" : "text-slate-500")}>
                              {settleDeltaLabel(entry.delta)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
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

                <div className="grid grid-cols-[auto_1fr] gap-2">
                  <Field label="日付">
                    <Input
                      value={payDate}
                      onChange={(e) => setPayDate(e.target.value)}
                      type="date"
                      className="w-[130px] px-2 text-sm"
                    />
                  </Field>
                  <Field label="購入金額（円）">
                    <Input
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      inputMode="numeric"
                      placeholder="例：1200"
                    />
                  </Field>
                </div>

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
                {payResult && (
                  <div className="col-span-full mt-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <div className="mb-3 text-sm font-extrabold text-emerald-700">✅ 記録完了</div>
                    <PayResultCard result={payResult} />
                  </div>
                )}
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
                {payResult && (
                  <div className="col-span-full mt-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <div className="mb-3 text-sm font-extrabold text-emerald-700">✅ 記録完了</div>
                    <PayResultCard result={payResult} />
                  </div>
                )}
              </div>
            )}
          </Section>
        )}

        {tab === "use" && (
          <Section title="🍳 2人で使った食材">
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

            {/* 固定費チェックボックス */}
            <div className="mt-3 grid gap-2 rounded-2xl border border-emerald-100 bg-white/70 p-3">
              {FIXED_ITEMS[ownerDb].map(({ name, amount }) => (
                <label key={name} className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={fixedChecked[name] ?? true}
                    onChange={(e) =>
                      setFixedChecked((v) => ({ ...v, [name]: e.target.checked }))
                    }
                    className="h-4 w-4 rounded accent-emerald-600"
                  />
                  <span className="text-sm font-bold text-slate-700">
                    {name}：{amount} 円
                  </span>
                </label>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {useRows.map((r, idx) => {
                const selectedFood = foods.find((f) => f.item_id === r.item_id);
                return (
                  <Card key={idx} className="rounded-2xl border-emerald-100 bg-white/80 p-3">
                    <div className="grid gap-2">
                      <div>
                        <div className="text-xs font-bold text-slate-500">具材</div>
                        <select
                          className="mt-1 w-full rounded-xl border px-2 py-1.5 text-sm"
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
                        <div className="mt-1 flex items-center gap-1">
                          <Input
                            className="h-8 min-w-0 text-sm"
                            value={r.useAmount}
                            onChange={(e) => {
                              const v = e.target.value;
                              setUseRows((prev) => prev.map((x, i) => (i === idx ? { ...x, useAmount: v } : x)));
                            }}
                            placeholder="量"
                          />
                          {selectedFood && (
                            <span className="shrink-0 text-xs text-slate-500">{selectedFood.unit}</span>
                          )}
                          <Button
                            variant="outline"
                            className="h-8 shrink-0 rounded-xl px-2 text-xs"
                            onClick={() => setUseRows((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            ✕
                          </Button>
                        </div>
                      </div>
                    </div>

                    <RowHint foods={foods} itemId={r.item_id} useAmount={r.useAmount} />
                  </Card>
                );
              })}

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
              {useResult && (
                <div className="col-span-full mt-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <div className="mb-3 text-sm font-extrabold text-emerald-700">✅ 記録完了</div>
                  <div className="grid gap-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">日付</span>
                      <span className="font-bold">{useResult.date}</span>
                    </div>
                    {useResult.rows.map((r) => (
                      <div key={r.name} className="flex justify-between">
                        <span className="text-slate-500">{r.name}</span>
                        <span className="font-bold">{r.amount.toLocaleString()} 円</span>
                      </div>
                    ))}
                    {useResult.fixedItems.map((f) => (
                      <div key={f.name} className="flex justify-between">
                        <span className="text-slate-500">{f.name}</span>
                        <span className="font-bold">{f.amount.toLocaleString()} 円</span>
                      </div>
                    ))}
                    <div className="mt-1 flex justify-between rounded-xl bg-white px-3 py-2">
                      <span className="text-slate-500">合計</span>
                      <span className="font-extrabold text-emerald-700">{useResult.total.toLocaleString()} 円</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 使用履歴 */}
            <div className="mt-6">
              <div className="mb-3 flex flex-wrap items-start gap-3">
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
                <div className="flex items-start gap-2">
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
              </div>

              {useHistoryItems.length === 0 && !useHistoryOut ? (
                <div className="rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-600">
                  この月の使用記録はありません
                </div>
              ) : useHistoryViewMode === "日毎" ? (
                /* 日毎ビュー（日付 → 回 → 食材） */
                <div className="grid gap-3">
                  {useHistoryByDate.map(({ date, sessions, dayTotal }) => (
                    <Card key={date} className="rounded-3xl border-emerald-100 bg-white/80 p-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="font-extrabold text-emerald-900">{date}</div>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-extrabold text-emerald-800">
                          計 {Math.abs(dayTotal).toLocaleString()} 円
                        </span>
                      </div>
                      <div className="grid gap-3">
                        {sessions.map(({ key, logs, sessionTotal }) => (
                          <Card key={key} className="rounded-2xl border-slate-100 bg-slate-50 p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <div className="text-xs font-bold text-slate-500">
                                {key.length >= 16 ? key.slice(11, 16) : "使用"}
                              </div>
                              <span className="text-xs font-extrabold text-emerald-700">
                                {Math.abs(sessionTotal).toLocaleString()} 円
                              </span>
                            </div>
                            <div className="grid gap-2">
                              {logs.map((log: UseLogEntry) => (
                                <div key={log.id} className="rounded-xl border bg-white p-3">
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
                                        <Button variant="outline" className="rounded-2xl"
                                          onClick={() => { setUseLogEditId(null); setUseLogEditValues(null); }}>
                                          キャンセル
                                        </Button>
                                        <Button className="ml-auto rounded-2xl bg-emerald-600 hover:bg-emerald-700"
                                          onClick={async () => {
                                            setUseHistoryOut("保存中");
                                            try {
                                              const newAmount = Number(useLogEditValues?.use_amount);
                                              if (!Number.isFinite(newAmount) || newAmount <= 0) { setUseHistoryOut("ERROR: 使用量が不正"); return; }
                                              await apiPost("/api/food/use-history/update", { id: log.id, use_date: useLogEditValues?.use_date, use_amount: newAmount });
                                              setUseLogEditId(null); setUseLogEditValues(null);
                                              await loadUseHistory(); await loadFoods(); await loadSettle();
                                            } catch (e: any) { setUseHistoryOut(String(e?.message ?? e)); }
                                          }}>
                                          保存
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between gap-2">
                                      <div>
                                        <div className="font-bold">{log.item_name}</div>
                                        <div className="text-xs text-slate-500">
                                          使用量：{log.use_amount}{log.unit ? ` ${log.unit}` : ""} ・ {Math.abs(log.settle_delta).toLocaleString()} 円
                                        </div>
                                      </div>
                                      <div className="flex shrink-0 gap-2">
                                        <Button variant="outline" className="h-8 rounded-2xl text-xs"
                                          onClick={() => { setUseLogEditId(log.id); setUseLogEditValues({ use_date: fmtYmd(log.use_date), use_amount: String(log.use_amount) }); }}>
                                          修正
                                        </Button>
                                        {pendingDelete === `useHistory:${log.id}` ? (
                                          <div className="flex items-center gap-1">
                                            <span className="text-xs text-slate-600">削除しますか？</span>
                                            <Button className="h-7 rounded-xl bg-red-500 text-xs text-white hover:bg-red-600"
                                              onClick={async () => {
                                                setPendingDelete(null);
                                                setUseHistoryOut("削除中");
                                                try {
                                                  await apiPost("/api/food/use-history/delete", { id: log.id });
                                                  await loadUseHistory(); await loadFoods(); await loadSettle();
                                                  setUseHistoryOut("");
                                                } catch (e: any) { setUseHistoryOut(String(e?.message ?? e)); }
                                              }}>はい</Button>
                                            <Button variant="outline" className="h-7 rounded-xl text-xs" onClick={() => setPendingDelete(null)}>いいえ</Button>
                                          </div>
                                        ) : (
                                          <Button variant="outline" className="h-8 rounded-2xl text-xs border-red-200 text-red-600 hover:bg-red-50"
                                            onClick={() => setPendingDelete(`useHistory:${log.id}`)}>
                                            削除
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </Card>
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
                                setUseHistoryOut("保存中");
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
                            {fmtYmd(log.use_date)} ・ 使用量：{log.use_amount}{log.unit ? ` ${log.unit}` : ""} ・ 単価：{Math.round(log.amount_per_unit * 1000) / 1000} 円
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
                            {pendingDelete === `useHistory:${log.id}` ? (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-slate-600">削除しますか？</span>
                                <Button className="h-7 rounded-xl bg-red-500 text-xs text-white hover:bg-red-600"
                                  onClick={async () => {
                                    setPendingDelete(null);
                                    setUseHistoryOut("削除中");
                                    try {
                                      await apiPost("/api/food/use-history/delete", { id: log.id });
                                      await loadUseHistory();
                                      await loadFoods();
                                      await loadSettle();
                                      setUseHistoryOut("");
                                    } catch (e: any) {
                                      setUseHistoryOut(String(e?.message ?? e));
                                    }
                                  }}>はい</Button>
                                <Button variant="outline" className="h-7 rounded-xl text-xs" onClick={() => setPendingDelete(null)}>いいえ</Button>
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                className="h-8 rounded-2xl text-xs border-red-200 text-red-600 hover:bg-red-50"
                                onClick={() => setPendingDelete(`useHistory:${log.id}`)}
                              >
                                削除
                              </Button>
                            )}
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
          <Section title="🥬 食材管理">
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
                className={addOpen ? "ml-auto rounded-2xl" : "ml-auto rounded-2xl bg-emerald-600 hover:bg-emerald-700"}
                variant={addOpen ? "outline" : "default"}
                onClick={() => { if (addOpen) { setAddOpen(false); setAddItems([blankDraft()]); } else { setAddOpen(true); } }}
              >
                {addOpen ? "キャンセル" : "＋ 食材を追加"}
              </Button>
            </div>

            {addOpen && (
              <Card className="mt-4 rounded-3xl border-emerald-100 bg-white/85 p-4">
                <div className="grid gap-3">
                  {addItems.map((draft) => (
                    <Card key={draft._key} className="rounded-2xl border-slate-200 bg-slate-50/60 p-3">
                      <div className="grid gap-2">
                        {(
                          [
                            { label: "具材名", field: "name" as const, placeholder: "例：にんじん", type: "text" },
                            { label: "購入日", field: "purchaseDate" as const, placeholder: "", type: "date" },
                            { label: "金額（円）", field: "price" as const, placeholder: "例：300", type: "text" },
                            { label: "内容量", field: "volume" as const, placeholder: "例：3 / 250", type: "text" },
                            { label: "残量", field: "remain" as const, placeholder: "例：3 / 120", type: "text" },
                          ] as { label: string; field: keyof Omit<AddItemDraft, "_key" | "unit" | "note">; placeholder: string; type: string }[]
                        ).map(({ label, field, placeholder, type }) => (
                          <div key={field} className="flex items-center gap-2">
                            <span className="w-20 shrink-0 text-sm text-slate-600">{label}</span>
                            <Input
                              className="flex-1"
                              type={type}
                              value={draft[field]}
                              onChange={(e) => updateDraft(draft._key, field, e.target.value)}
                              placeholder={placeholder}
                            />
                          </div>
                        ))}
                        <div className="flex items-center gap-2">
                          <span className="w-20 shrink-0 text-sm text-slate-600">単位</span>
                          <select
                            className="flex-1 rounded-2xl border px-3 py-2 text-sm"
                            value={draft.unit}
                            onChange={(e) => updateDraft(draft._key, "unit", e.target.value)}
                          >
                            <option value="個">個</option>
                            <option value="g">g</option>
                            <option value="ml">ml</option>
                            <option value="枚">枚</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-20 shrink-0 text-sm text-slate-600">備考</span>
                          <Input
                            className="flex-1"
                            value={draft.note}
                            onChange={(e) => updateDraft(draft._key, "note", e.target.value)}
                            placeholder="例：特売（任意）"
                          />
                        </div>
                        <div className="flex justify-end pt-1">
                          <Button variant="outline" className="h-7 rounded-xl text-xs" onClick={() => removeDraft(draft._key)}>
                            キャンセル
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" className="rounded-2xl" onClick={addMoreDraft}>
                      さらに追加する
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
                  <div className="text-sm font-extrabold text-emerald-800">🟢 使用可能な食材</div>
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
                          {pendingDelete === `manage:${it.item_id}` ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-slate-600">削除しますか？</span>
                              <Button className="h-7 rounded-xl bg-red-500 text-xs text-white hover:bg-red-600"
                                onClick={async () => {
                                  setPendingDelete(null);
                                  setManageOut("削除中");
                                  try {
                                    await apiPost("/api/food/manage/delete", { owner: ownerDb, itemIds: [it.item_id] });
                                    await loadManage();
                                    await loadFoods();
                                    setManageOut("");
                                  } catch (e: any) {
                                    setManageOut(String(e?.message ?? e));
                                  }
                                }}>はい</Button>
                              <Button variant="outline" className="h-7 rounded-xl text-xs" onClick={() => setPendingDelete(null)}>いいえ</Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              className="h-9 rounded-2xl text-xs"
                              onClick={() => setPendingDelete(`manage:${it.item_id}`)}
                            >
                              削除
                            </Button>
                          )}
                          {editId === it.item_id ? (
                            <div className="mt-3 grid gap-2 w-full">
                              {(
                                [
                                  { label: "名称", field: "name" as const, type: "text", inputMode: undefined },
                                  { label: "購入日", field: "purchaseDate" as const, type: "date", inputMode: undefined },
                                  { label: "残量", field: "remain" as const, type: "text", inputMode: "decimal" as const },
                                  { label: "内容量", field: "volume" as const, type: "text", inputMode: "decimal" as const },
                                  { label: "価格", field: "price" as const, type: "text", inputMode: "decimal" as const },
                                  { label: "備考", field: "note" as const, type: "text", inputMode: undefined },
                                ]
                              ).map(({ label, field, type, inputMode }) => (
                                <div key={field} className="flex items-center gap-2">
                                  <span className="w-14 shrink-0 text-sm text-slate-600">{label}</span>
                                  <Input
                                    className="flex-1"
                                    type={type}
                                    inputMode={inputMode}
                                    value={editValues?.[field] ?? ""}
                                    onChange={(e) => setEditValues((v) => v ? { ...v, [field]: e.target.value } : v)}
                                  />
                                </div>
                              ))}

                              <div className="flex gap-2 pt-1">
                                <Button
                                  variant="outline"
                                  className="rounded-2xl"
                                  onClick={() => { setEditId(null); setEditValues(null); }}
                                >
                                  キャンセル
                                </Button>

                                <Button
                                  className="ml-auto rounded-2xl bg-emerald-600 hover:bg-emerald-700"
                                  onClick={async () => {
                                    try {
                                      await apiPost("/api/food/manage/update", {
                                        owner: ownerDb,
                                        item_id: it.item_id,
                                        name: editValues?.name,
                                        purchaseDate: editValues?.purchaseDate,
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
                                  name: it.name ?? "",
                                  purchaseDate: fmtYmd(it.purchaseDate),
                                  remain: String(it.remain ?? 0),
                                  volume: String(it.volume ?? 1),
                                  price: String(Math.round((it.amountPerUnit * (it.volume ?? 1)) * 1000) / 1000),
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
                  <div className="text-sm font-extrabold text-amber-800">🟠 使用済み</div>
                  <div className="text-xs text-slate-500">{manageDeleted.length} 件</div>
                </div>

                {manageDeleted.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">削除はありません</div>
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
                                    setManageOut("復元中");
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
          <Section title="📒 家計簿" subtitle={`${kakeiboOwnerJa}の家計簿`}>
            {/* コントロール行 */}
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800">
                👤 {kakeiboOwnerJa}
              </div>
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
                <div className={cn(
                  "rounded-2xl px-3 py-2 text-sm font-extrabold",
                  kakeiboTotal >= 0 ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
                )}>
                  収支：{kakeiboTotal >= 0 ? "+" : ""}{kakeiboTotal.toLocaleString()} 円
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              {kakeiboByDate.length === 0 && !kakeiboOut ? (
                <div className="rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-600">
                  この月の記録はありません
                </div>
              ) : (
                kakeiboByDate.map(({ date, entries, dayTotal }) => (
                  <Card key={date} className="rounded-3xl border-emerald-100 bg-white/80 p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="font-extrabold text-emerald-900">{date}</div>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-extrabold text-emerald-800">
                        計 {dayTotal.toLocaleString()} 円
                      </span>
                    </div>
                    <div className="grid gap-2">
                  {entries.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border bg-white p-3">
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
                          {pendingDelete === `kakeibo:${entry.id}` ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-slate-600">削除しますか？</span>
                              <Button className="h-7 rounded-xl bg-red-500 text-xs text-white hover:bg-red-600"
                                onClick={async () => {
                                  setPendingDelete(null);
                                  setKakeiboOut("削除中");
                                  try {
                                    await apiPost("/api/kakeibo/delete", { id: entry.id });
                                    await loadKakeibo();
                                    setKakeiboOut("");
                                  } catch (e: any) {
                                    setKakeiboOut(String(e?.message ?? e));
                                  }
                                }}>はい</Button>
                              <Button variant="outline" className="h-7 rounded-xl text-xs" onClick={() => setPendingDelete(null)}>いいえ</Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              className="h-8 rounded-2xl text-xs border-red-200 text-red-600 hover:bg-red-50"
                              onClick={() => setPendingDelete(`kakeibo:${entry.id}`)}
                            >
                              削除
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  ))}
                    </div>
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
                setSettleDetailOpen(false);
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

function PayResultCard({ result }: { result: PayResult }) {
  const rows: { label: string; value: string; highlight?: boolean }[] = [
    { label: "種別", value: result.type },
    { label: "日付", value: result.date },
    { label: "カテゴリー", value: result.category },
    { label: "金額", value: `${result.amount.toLocaleString()} 円` },
    ...(result.payer ? [{ label: "支払い", value: `${result.payer} → ${result.forWhom}` }] : []),
    ...(result.note ? [{ label: "備考", value: result.note }] : []),
  ];
  return (
    <div className="grid gap-1.5">
      {rows.map((r) => (
        <div key={r.label} className="flex justify-between text-sm">
          <span className="text-slate-500">{r.label}</span>
          <span className="font-bold">{r.value}</span>
        </div>
      ))}
      {result.settleDelta !== undefined && result.settleDelta !== 0 && (
        <div className="mt-1 flex justify-between rounded-xl bg-white px-3 py-2 text-sm">
          <span className="text-slate-500">精算への影響</span>
          <span className={cn("font-extrabold", result.settleDelta > 0 ? "text-emerald-700" : "text-red-600")}>
            {result.settleDelta > 0 ? "+" : ""}{result.settleDelta.toLocaleString()} 円
          </span>
        </div>
      )}
    </div>
  );
}

const LOADING_TEXTS = ["送信中", "読み込み中", "削除中", "追加中", "保存中", "復元中"];

function MonoBox({ text }: { text: string }) {
  if (!text) return null;
  if (LOADING_TEXTS.includes(text)) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
        <span>{text}</span>
      </div>
    );
  }
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
    <div className="flex w-fit rounded-2xl bg-slate-100 p-1">
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
  compact = false,
}: {
  value: string;
  onChange: (v: string) => void;
  allowAll?: boolean;
  compact?: boolean;
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

  const selectClass = compact
    ? "rounded-xl border px-1.5 py-1 text-xs"
    : "rounded-2xl border px-3 py-2 text-sm";

  return (
    <div className={compact ? "flex gap-1" : "flex gap-2"}>
      <select
        className={selectClass}
        value={selectedYear}
        onChange={(e) => handleYear(e.target.value)}
      >
        {allowAll && <option value="">すべて</option>}
        {years.map((y) => (
          <option key={y} value={String(y)}>{y}年</option>
        ))}
      </select>
      <select
        className={cn(selectClass, "disabled:opacity-40")}
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

const FIXED_ITEMS: Record<"natsu" | "taka", { name: string; amount: number }[]> = {
  natsu: [
    { name: "調味料", amount: 30 },
    { name: "水道代", amount: 70 },
    { name: "電気代", amount: 500 },
  ],
  taka: [
    { name: "調味料", amount: 30 },
    { name: "水道代", amount: 67 },
    { name: "電気代", amount: 140 },
    { name: "ガス代", amount: 110 },
  ],
};

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
