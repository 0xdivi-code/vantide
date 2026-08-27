import { AdminResourcePage } from "@/admin/components/RemoteResourcePage";

export default function AdminSupport() {
  return (
    <AdminResourcePage
      resource="support"
      title="Support Center"
      description="Live support cases and conversation records fetched from your authenticated admin API."
    />
  );
}
