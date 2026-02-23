import AppHome from "@/components/cooking/app-home";

const VALID_TABS = ["payment", "use", "manage", "kakeibo"] as const;
type TabKey = (typeof VALID_TABS)[number];

export default async function Page(props: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await props.searchParams;
  const page = params?.page ?? "";
  const initialTab: TabKey = (VALID_TABS as readonly string[]).includes(page)
    ? (page as TabKey)
    : "payment";

  return <AppHome initialTab={initialTab} />;
}
