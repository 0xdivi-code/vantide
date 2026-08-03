import { useSyncExternalStore } from "react";
import {
  getAdminStoreVersion,
  subscribeAdminStore,
} from "@/admin/adminStore";

/**
 * Re-renders the consuming component whenever an admin override changes,
 * so config-driven UI (logo, menus, flags, ...) updates live without a
 * page reload.
 */
export function useConfigVersion(): number {
  return useSyncExternalStore(subscribeAdminStore, getAdminStoreVersion);
}
