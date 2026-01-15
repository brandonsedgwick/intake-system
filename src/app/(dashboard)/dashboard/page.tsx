import { StatsCards } from "@/components/dashboard/stats-cards";
import { PendingActionsTable } from "@/components/dashboard/pending-actions-table";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { SyncStatus } from "@/components/dashboard/sync-status";

export default function DashboardPage() {
  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            Welcome back! Here&apos;s what&apos;s happening today.
          </p>
        </div>
        <div className="w-80">
          <SyncStatus />
        </div>
      </div>

      <StatsCards />

      <div className="grid grid-cols-3 gap-6 mt-8">
        <div className="col-span-2">
          <PendingActionsTable />
        </div>
        <div>
          <RecentActivity />
        </div>
      </div>
    </div>
  );
}
