"use client";

import { useQuery } from "@tanstack/react-query";
import { Users, Mail, Calendar, Link2, Settings, UserCheck, FileText, LucideIcon } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";

interface ActivityEntry {
  id: string;
  timestamp: string;
  userEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  newValue?: string;
}

interface ActivityDisplay {
  id: string;
  message: string;
  time: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}

function getActivityDisplay(entry: ActivityEntry): ActivityDisplay {
  const actionMappings: Record<string, { icon: LucideIcon; iconBg: string; iconColor: string; getMessage: (entry: ActivityEntry) => string }> = {
    "client_created": {
      icon: Users,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      getMessage: (e) => `New client created: ${e.newValue || e.entityId}`,
    },
    "form_sync": {
      icon: Users,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      getMessage: (e) => `Form response synced: ${e.newValue || "New submission"}`,
    },
    "client_updated": {
      icon: UserCheck,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      getMessage: (e) => `Client updated: ${e.newValue || e.entityId}`,
    },
    "email_sent": {
      icon: Mail,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      getMessage: (e) => `Email sent to ${e.newValue || "client"}`,
    },
    "email_received": {
      icon: Mail,
      iconBg: "bg-yellow-100",
      iconColor: "text-yellow-600",
      getMessage: (e) => `Reply received from ${e.newValue || "client"}`,
    },
    "scheduled": {
      icon: Calendar,
      iconBg: "bg-teal-100",
      iconColor: "text-teal-600",
      getMessage: (e) => `Appointment scheduled for ${e.newValue || "client"}`,
    },
    "referred": {
      icon: Link2,
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      getMessage: (e) => `Referral sent for ${e.newValue || "client"}`,
    },
    "template_updated": {
      icon: FileText,
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600",
      getMessage: (e) => `Email template updated: ${e.newValue || e.entityId}`,
    },
    "settings_updated": {
      icon: Settings,
      iconBg: "bg-gray-100",
      iconColor: "text-gray-600",
      getMessage: (e) => `Settings updated by ${e.userEmail}`,
    },
  };

  const mapping = actionMappings[entry.action] || {
    icon: Users,
    iconBg: "bg-gray-100",
    iconColor: "text-gray-600",
    getMessage: (e: ActivityEntry) => `${e.action}: ${e.entityType} ${e.entityId}`,
  };

  return {
    id: entry.id,
    message: mapping.getMessage(entry),
    time: formatRelativeTime(entry.timestamp),
    icon: mapping.icon,
    iconBg: mapping.iconBg,
    iconColor: mapping.iconColor,
  };
}

export function RecentActivity() {
  const { data: activities, isLoading } = useQuery<ActivityEntry[]>({
    queryKey: ["activity"],
    queryFn: async () => {
      const response = await fetch("/api/activity");
      if (!response.ok) {
        throw new Error("Failed to fetch activity");
      }
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const displayActivities = activities?.map(getActivityDisplay) || [];

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Recent Activity</h2>
        <div
          className="w-2 h-2 bg-green-500 rounded-full animate-pulse"
          title="Real-time updates"
        ></div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-500">Loading...</p>
        </div>
      ) : displayActivities.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <p>No recent activity.</p>
          <p className="text-sm mt-1">Activity will appear here as you use the system.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 max-h-96 overflow-auto">
          {displayActivities.map((activity) => {
            const Icon = activity.icon;

            return (
              <div
                key={activity.id}
                className="px-6 py-4 hover:bg-gray-50 transition-colors border-l-3 border-transparent hover:border-blue-500"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 ${activity.iconBg} rounded-full flex items-center justify-center flex-shrink-0`}
                  >
                    <Icon className={`w-4 h-4 ${activity.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">{activity.message}</p>
                    <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
