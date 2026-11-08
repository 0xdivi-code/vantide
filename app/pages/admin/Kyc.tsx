import { AdminResourcePage } from "@/admin/components/RemoteResourcePage";

export default function AdminKyc() {
  return (
    <AdminResourcePage
      resource="kyc"
      title="KYC Management"
      description="Administrative KYC records only. No identity provider or compliance decision workflow is connected."
    />
  );
}
