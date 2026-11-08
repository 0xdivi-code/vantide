import { AdminResourcePage } from "@/admin/components/RemoteResourcePage";

export default function AdminSecurity() {
  return (
    <AdminResourcePage
      resource="security"
      title="Security Center"
      description="Administrative security records. These rows are not live login telemetry; only actual API mutations in /audit are authoritative."
    />
  );
}
