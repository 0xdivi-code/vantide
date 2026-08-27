import { AdminResourcePage } from "@/admin/components/RemoteResourcePage";

export default function AdminTreasury() {
  return (
    <AdminResourcePage
      resource="treasury"
      title="Treasury"
      description="Live wallet balances and transfer records fetched from your authenticated admin API."
    />
  );
}
