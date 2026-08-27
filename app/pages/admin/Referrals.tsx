import { AdminResourcePage } from "@/admin/components/RemoteResourcePage";

export default function AdminReferrals() {
  return (
    <AdminResourcePage
      resource="referrals"
      title="Referral Management"
      description="Live affiliate, commission, and payout records fetched from your authenticated admin API."
    />
  );
}
