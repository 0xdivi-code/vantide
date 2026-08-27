import { AdminResourcePage } from "@/admin/components/RemoteResourcePage";

export default function AdminSecurity() {
  return (
    <AdminResourcePage
      resource="security"
      title="Security Center"
      description="Live access, alert, and audit records fetched from your authenticated admin API."
    />
  );
}
