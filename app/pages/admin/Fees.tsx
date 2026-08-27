import { AdminResourcePage } from "@/admin/components/RemoteResourcePage";

export default function AdminFees() {
  return (
    <AdminResourcePage
      resource="fees"
      title="Fee Management"
      description="Live fee programs, tiers, and promotions fetched from your authenticated admin API."
    />
  );
}
