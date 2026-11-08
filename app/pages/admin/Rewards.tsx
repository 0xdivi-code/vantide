import { AdminResourcePage } from "@/admin/components/RemoteResourcePage";

export default function AdminRewards() {
  return (
    <AdminResourcePage
      resource="rewards"
      title="Rewards System"
      description="Administrative reward records. No campaign distribution or on-chain payout workflow is connected."
    />
  );
}
