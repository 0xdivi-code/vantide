import { AdminResourcePage } from "@/admin/components/RemoteResourcePage";
import { TreasuryVaultPanel } from "@/admin/components/TreasuryVaultPanel";

export default function AdminTreasury() {
  return (
    <div className="space-y-10">
      <TreasuryVaultPanel />
      <div className="border-t border-white/10 pt-4">
        <AdminResourcePage
          resource="treasury"
          title="Treasury database records"
          description="Separate administrative records from your authenticated admin API. These rows are not live wallet balances and cannot deposit, withdraw, or route Orderly revenue."
        />
      </div>
    </div>
  );
}
