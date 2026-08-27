import { AdminResourcePage } from "@/admin/components/RemoteResourcePage";

export default function AdminFunding() {
  return (
    <AdminResourcePage
      resource="funding"
      title="Deposits & Withdrawals"
      description="Live deposit, withdrawal, and funding records fetched from your authenticated admin API."
    />
  );
}
