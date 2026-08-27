import { AdminResourcePage } from "@/admin/components/RemoteResourcePage";

export default function AdminRewards() {
  return (
    <AdminResourcePage
      resource="rewards"
      title="Rewards System"
      description="Live campaign and distribution records fetched from your authenticated admin API."
    />
  );
}
