# 食材精算アプリ

2人用の食材管理・支払い記録・月次精算を一元管理するWebアプリです。Next.js + Supabase で構築し、LINEミニアプリUIを想定したモバイルファーストの設計になっています。

## 機能概要

| タブ | 機能 |
|------|------|
| 支払い | 家計簿への支出・収入記録、精算額の自動計算 |
| 使用 | 在庫からの食材使用記録、残量の自動更新 |
| 食材 | 食材の追加・修正・削除・復元（在庫管理） |
| 家計簿 | 月別の支出・収入一覧と集計 |

### 精算ロジック

- 一方が食材を購入した場合、もう一方が「使用」することで使用量 × 単価が精算差分として計算される
- 支払いタブで立替記録をすると、精算額に反映される
- 月別の精算状況をまとめて確認できる

## 技術スタック

- **フロントエンド**: Next.js 19 (App Router) + TypeScript
- **UI**: Tailwind CSS + shadcn/ui + Radix UI
- **データベース**: Supabase (PostgreSQL)
- **API**: Next.js Route Handlers
- **LINE連携**: LINE LIFF SDK（設定対応済み）
- **デプロイ**: Vercel 対応

## データベース構造

### `food_items` — 現役の食材

| カラム | 型 | 説明 |
|--------|----|------|
| owner | text | 購入者（natsu / taka） |
| item_id | text | ユニークID |
| name | text | 食材名 |
| price | numeric | 購入総額 |
| volume | numeric | 内容量 |
| unit | text | 単位 |
| remain | numeric | 残量 |
| amount_per_unit | numeric | 単価（price / volume） |
| purchase_date | date | 購入日 |
| note | text | 備考 |

### `food_deleted` — 削除済みの食材

food_items と同様のカラム構成に加えて `delete_date`（削除日）を持つ。復元機能で food_items に戻せる。

### `kakeibo_entries` — 家計簿記録

| カラム | 型 | 説明 |
|--------|----|------|
| id | uuid | プライマリキー |
| owner | text | 記録者 |
| item | text | 品目・カテゴリ名 |
| date | date | 日付 |
| amount | numeric | 金額 |
| entry_type | text | expense / income |
| expense | text | 支出者 |
| for_whom | text | 誰のための支出か |
| note | text | メモ |

### `settle_entries` — 精算履歴

| カラム | 型 | 説明 |
|--------|----|------|
| id | uuid | プライマリキー |
| date | date | 日付 |
| delta | numeric | 精算差分（正: natsu→taka、負: taka→natsu） |
| source | text | payment / food.use / manual |
| meta | jsonb | 元データの参照情報 |

### `food_use_logs` — 食材使用履歴

| カラム | 型 | 説明 |
|--------|----|------|
| id | uuid | プライマリキー |
| owner | text | 使用者 |
| use_date | date | 使用日 |
| item_id | text | 食材ID |
| item_name | text | 食材名（スナップショット） |
| use_amount | numeric | 使用量 |
| amount_per_unit | numeric | 単価（スナップショット） |
| unit | text | 単位 |
| settle_delta | numeric | 精算差分 |

## API エンドポイント

### 支払い
| メソッド | パス | 説明 |
|----------|------|------|
| POST | `/api/payment/add` | 支払い記録・家計簿追加・精算更新 |

### 食材管理
| メソッド | パス | 説明 |
|----------|------|------|
| GET | `/api/food/manage/list` | 食材一覧（月別フィルタ対応） |
| POST | `/api/food/manage/add` | 食材追加 |
| PUT | `/api/food/manage/update` | 食材修正 |
| DELETE | `/api/food/manage/delete` | 食材削除 |
| POST | `/api/food/manage/restore` | 削除済み食材の復元 |

### 食材使用
| メソッド | パス | 説明 |
|----------|------|------|
| POST | `/api/food/use` | 食材使用記録・残量更新・精算更新 |
| GET | `/api/food/use-history` | 使用履歴一覧 |
| PUT | `/api/food/use-history/update` | 使用履歴修正 |
| DELETE | `/api/food/use-history/delete` | 使用履歴削除 |

### 家計簿
| メソッド | パス | 説明 |
|----------|------|------|
| GET | `/api/kakeibo/list` | 家計簿一覧（月別） |
| POST | `/api/kakeibo/add` | 家計簿追加 |
| PUT | `/api/kakeibo/update` | 家計簿修正 |
| DELETE | `/api/kakeibo/delete` | 家計簿削除 |

### 精算
| メソッド | パス | 説明 |
|----------|------|------|
| GET | `/api/settle/list` | 精算一覧 |
| GET | `/api/settle/get` | 当月精算額取得 |
| GET | `/api/settle/month` | 月別精算 |
| POST | `/api/settle/add` | 手動精算追加 |

## セットアップ

### 1. リポジトリのクローン

```bash
git clone <このリポジトリのURL>
cd nextjs-with-supabase-cooking
npm install
```

### 2. Supabase プロジェクトの作成

[Supabase](https://supabase.com) でプロジェクトを作成し、上記のテーブルを作成します。

### 3. 環境変数の設定

`.env.local` を作成し、以下を設定します：

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# LINE LIFF連携（任意）
NEXT_PUBLIC_LIFF_ID=your-liff-id
NEXT_PUBLIC_LIFF_NATSU_USER_ID=line-user-id-for-natsu
NEXT_PUBLIC_LIFF_TAKA_USER_ID=line-user-id-for-taka
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

`http://localhost:3000` でアクセスできます。

## デプロイ（Vercel）

1. Vercel にリポジトリを接続
2. 環境変数を Vercel のプロジェクト設定に追加
3. デプロイ実行

## 注意事項

- 現在は Supabase の Admin Client（Service Role Key）を使用しているため、**本番運用前に RLS（Row Level Security）の設定を推奨します**
- LINE LIFF 統合は環境変数の準備が済んでいますが、本格的な統合は未実装です
