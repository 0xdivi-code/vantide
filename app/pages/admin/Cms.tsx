import { AdminResourcePage } from "@/admin/components/RemoteResourcePage";

export default function AdminCms() {
  return (
    <AdminResourcePage
      resource="cms"
      title="Content Management"
      description="Administrative content records. No public rendering or publishing pipeline is connected to these rows."
    />
  );
}
