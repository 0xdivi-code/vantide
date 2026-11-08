import { AdminResourcePage } from "@/admin/components/RemoteResourcePage";

export default function AdminSupport() {
  return (
    <AdminResourcePage
      resource="support"
      title="Support Center"
      description="Administrative support records. No external ticketing provider or customer message delivery is connected."
    />
  );
}
