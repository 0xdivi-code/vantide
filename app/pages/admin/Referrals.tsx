import { AdminResourcePage } from "@/admin/components/RemoteResourcePage";

export default function AdminReferrals() {
  return (
    <AdminResourcePage
      resource="referrals"
      title="Referral Management"
      description="Administrative referral records. These rows are not the live Orderly affiliate ledger and cannot pay commissions."
    />
  );
}
