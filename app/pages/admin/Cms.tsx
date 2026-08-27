import { AdminResourcePage } from "@/admin/components/RemoteResourcePage";

export default function AdminCms() {
  return (
    <AdminResourcePage
      resource="cms"
      title="Content Management"
      description="Live announcements, pages, and publishing records fetched from your authenticated admin API."
    />
  );
}
