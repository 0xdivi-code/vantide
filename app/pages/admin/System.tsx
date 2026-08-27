import { AdminResourcePage } from "@/admin/components/RemoteResourcePage";

export default function AdminSystem() {
  return (
    <AdminResourcePage
      resource="system"
      title="System Status"
      description="Live service health, deployment, and platform status fetched from your authenticated admin API."
      pollInterval={60_000}
    />
  );
}
