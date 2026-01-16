"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Home,
  Inbox,
  Users,
  Mail,
  Calendar,
  Link2,
  User,
  FileText,
  Settings,
  LogOut,
  Building2,
  Clock,
} from "lucide-react";
import { useClients } from "@/hooks/use-clients";

const secondaryNavigation = [
  { name: "Availability", href: "/availability", icon: Clock },
  { name: "Clinicians", href: "/clinicians", icon: User },
  { name: "Templates", href: "/templates", icon: FileText },
  { name: "Referral Clinics", href: "/referral-clinics", icon: Building2 },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { data: clients } = useClients();

  // Calculate dynamic badge counts based on client statuses
  const badgeCounts = useMemo(() => {
    if (!clients) return { inbox: 0, outreach: 0, scheduling: 0, referrals: 0 };

    const inbox = clients.filter(
      (c) => c.status === "new" || c.status === "pending_evaluation"
    ).length;

    const outreach = clients.filter(
      (c) =>
        c.status === "pending_outreach" ||
        c.status === "outreach_sent" ||
        c.status === "follow_up_1" ||
        c.status === "follow_up_2"
    ).length;

    const scheduling = clients.filter(
      (c) => c.status === "ready_to_schedule" || c.status === "replied"
    ).length;

    const referrals = clients.filter(
      (c) => c.status === "pending_referral"
    ).length;

    return { inbox, outreach, scheduling, referrals };
  }, [clients]);

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: Home },
    { name: "Inbox", href: "/inbox", icon: Inbox, badge: badgeCounts.inbox },
    { name: "Clients", href: "/clients", icon: Users },
    { name: "Outreach", href: "/outreach", icon: Mail, badge: badgeCounts.outreach },
    { name: "Scheduling", href: "/scheduling", icon: Calendar, badge: badgeCounts.scheduling },
    { name: "Referrals", href: "/referrals", icon: Link2, badge: badgeCounts.referrals },
  ];

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <div>
            <h1 className="font-semibold text-gray-900">Intake System</h1>
            <p className="text-xs text-gray-500">Therapy Practice</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                active
                  ? "bg-blue-50 text-blue-700 border-l-3 border-blue-600"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
                    item.name === "Inbox"
                      ? "bg-red-500 text-white"
                      : item.name === "Outreach"
                      ? "bg-yellow-500 text-white"
                      : item.name === "Referrals"
                      ? "bg-amber-500 text-white"
                      : "bg-green-500 text-white"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        <div className="pt-4 mt-4 border-t border-gray-200 space-y-1">
          {secondaryNavigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
            {session?.user?.name
              ?.split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2) || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 text-sm truncate">
              {session?.user?.name || "User"}
            </p>
            <p className="text-xs text-gray-500">Admin</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            title="Sign out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
