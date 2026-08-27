import { AdminResourcePage } from "@/admin/components/RemoteResourcePage";

export default function AdminNotifications() {
  return (
    <AdminResourcePage
      resource="notifications"
      title="Notification Center"
      description="Live delivery history and notification records fetched from your authenticated admin API."
    />
  );
}
