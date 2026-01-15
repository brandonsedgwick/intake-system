"use client";

import { useClients, useFollowUpsDue } from "@/hooks/use-clients";
import { Users, Mail, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import Link from "next/link";

export function StatsCards() {
  const { data: clients, isLoading } = useClients();
  const { data: followUpsDue } = useFollowUpsDue();

  // Calculate stats from real data
  const newCount = clients?.filter((c) => c.status === "new").length || 0;
  const pendingOutreach = clients?.filter((c) => c.status === "pending_outreach").length || 0;
  const followUpsCount = followUpsDue?.length || 0;
  const readyToSchedule = clients?.filter((c) => c.status === "ready_to_schedule" || c.status === "replied").length || 0;

  const stats = [
    {
      name: "New Submissions",
      value: newCount,
      change: "Needs evaluation",
      changeType: newCount > 0 ? "warning" : "positive",
      icon: Users,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      href: "/clients?status=new",
    },
    {
      name: "Pending Outreach",
      value: pendingOutreach,
      change: "Ready to send",
      changeType: pendingOutreach > 0 ? "warning" : "positive",
      icon: Mail,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      href: "/clients?status=pending_outreach",
    },
    {
      name: "Follow-ups Due",
      value: followUpsCount,
      change: followUpsCount > 0 ? "Action needed" : "All caught up",
      changeType: followUpsCount > 0 ? "warning" : "positive",
      icon: AlertCircle,
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600",
      href: "/clients?followUpsDue=true",
    },
    {
      name: "Ready to Schedule",
      value: readyToSchedule,
      change: "Awaiting scheduling",
      changeType: "positive",
      icon: CheckCircle,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      href: "/clients?status=ready_to_schedule",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white rounded-xl p-6 border border-gray-200 animate-pulse"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="h-4 bg-gray-200 rounded w-24 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-12"></div>
              </div>
              <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-6">
      {stats.map((stat) => {
        const Icon = stat.icon;

        return (
          <Link
            key={stat.name}
            href={stat.href}
            className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-lg transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">{stat.name}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {stat.value}
                </p>
              </div>
              <div
                className={`w-12 h-12 ${stat.iconBg} rounded-lg flex items-center justify-center`}
              >
                <Icon className={`w-6 h-6 ${stat.iconColor}`} />
              </div>
            </div>
            <p
              className={`text-xs mt-3 flex items-center gap-1 ${
                stat.changeType === "positive"
                  ? "text-green-600"
                  : stat.changeType === "warning"
                    ? "text-yellow-600"
                    : "text-gray-600"
              }`}
            >
              {stat.change}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
