import { AdminResourcePage } from "@/admin/components/RemoteResourcePage";

export default function AdminSystem() {
  return (
    <AdminResourcePage
      resource="system"
      title="System Status"
      description="Administrative system flags and status records. These rows are not live service telemetry or exchange kill switches."
      pollInterval={60_000}
    />
  );
}
