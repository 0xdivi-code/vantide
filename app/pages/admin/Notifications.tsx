import { AdminResourcePage } from "@/admin/components/RemoteResourcePage";

export default function AdminNotifications() {
  return (
    <AdminResourcePage
      resource="notifications"
      title="Notification Center"
      description="Administrative notification records. No delivery worker is connected, and a row does not prove that a message was sent."
    />
  );
}
