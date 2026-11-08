import { AdminResourcePage } from "@/admin/components/RemoteResourcePage";

export default function AdminFees() {
  return (
    <AdminResourcePage
      resource="fees"
      title="Fee Management"
      description="Administrative fee records only. These rows do not read or change Orderly broker fee tiers, commissions, or on-chain revenue routing."
    />
  );
}
