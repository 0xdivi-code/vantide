import { AdminResourcePage } from "@/admin/components/RemoteResourcePage";

export default function AdminKyc() {
  return (
    <AdminResourcePage
      resource="kyc"
      title="KYC Management"
      description="Live verification cases and compliance records fetched from your authenticated admin API."
    />
  );
}
