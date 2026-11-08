import { AdminResourcePage } from "@/admin/components/RemoteResourcePage";

export default function AdminFunding() {
  return (
    <AdminResourcePage
      resource="funding"
      title="Deposits & Withdrawals"
      description="Administrative funding records only. These rows are not Orderly/wallet ledger entries and cannot approve deposits or withdrawals."
    />
  );
}
