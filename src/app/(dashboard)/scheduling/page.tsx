"use client";

import { useState, useMemo } from "react";
import { useClients, useUpdateClient } from "@/hooks/use-clients";
import { Client, ClientStatus, ScheduledAppointment, SchedulingProgress } from "@/types/client";
import { SchedulingTable } from "@/components/scheduling/scheduling-table";
import { SchedulingDetails } from "@/components/scheduling/scheduling-details";
import { SchedulingCommunicationsModal } from "@/components/scheduling/scheduling-communications-modal";
import { FinalizeModal } from "@/components/scheduling/finalize-modal";
import { formatDate, cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import {
  Search,
  Calendar,
  AlertCircle,
  Loader2,
} from "lucide-react";

// Scheduling workflow statuses
const SCHEDULING_STATUSES: ClientStatus[] = [
  "awaiting_scheduling",
  "ready_to_schedule",
];

export default function SchedulingPage() {
  const { data: clients, isLoading, refetch } = useClients();
  const updateClient = useUpdateClient();
  const { addToast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [communicationsModalClientId, setCommunicationsModalClientId] = useState<string | null>(null);
  const [finalizeModalClientId, setFinalizeModalClientId] = useState<string | null>(null);

  // Filter clients in scheduling workflow
  const schedulingClients = useMemo(() => {
    if (!clients) return [];
    return clients.filter((c) => SCHEDULING_STATUSES.includes(c.status));
  }, [clients]);

  // Apply search filter
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return schedulingClients;
    const query = searchQuery.toLowerCase();
    return schedulingClients.filter(
      (c) =>
        c.firstName.toLowerCase().includes(query) ||
        c.lastName.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query)
    );
  }, [schedulingClients, searchQuery]);

  // Get selected client
  const selectedClient = useMemo(() => {
    if (!selectedClientId) return filteredClients[0] || null;
    return filteredClients.find((c) => c.id === selectedClientId) || filteredClients[0] || null;
  }, [selectedClientId, filteredClients]);

  // Get client for communications modal
  const communicationsModalClient = useMemo(() => {
    if (!communicationsModalClientId) return null;
    return filteredClients.find((c) => c.id === communicationsModalClientId) || null;
  }, [communicationsModalClientId, filteredClients]);

  // Get client for finalize modal
  const finalizeModalClient = useMemo(() => {
    if (!finalizeModalClientId) return null;
    return filteredClients.find((c) => c.id === finalizeModalClientId) || null;
  }, [finalizeModalClientId, filteredClients]);

  // Count by status
  const statusCounts = useMemo(() => {
    const awaiting = schedulingClients.filter(
      (c) => c.status === "awaiting_scheduling"
    ).length;
    const scheduled = schedulingClients.filter(
      (c) => c.status === "ready_to_schedule"
    ).length;
    return { awaiting, scheduled };
  }, [schedulingClients]);

  // Handle progress update
  type SchedulingProgressStep = "clientCreated" | "screenerUploaded" | "appointmentCreated" | "finalized";

  const handleProgressUpdate = async (
    clientId: string,
    step: SchedulingProgressStep,
    value: boolean
  ) => {
    const client = filteredClients.find((c) => c.id === clientId);
    if (!client) return;

    // Parse existing progress or create new
    let progress: SchedulingProgress;
    try {
      progress = client.schedulingProgress
        ? JSON.parse(client.schedulingProgress)
        : {
            clientCreated: false,
            screenerUploaded: false,
            appointmentCreated: false,
            finalized: false,
          };
    } catch {
      progress = {
        clientCreated: false,
        screenerUploaded: false,
        appointmentCreated: false,
        finalized: false,
      };
    }

    // Update the step using type assertion via unknown
    (progress as unknown as Record<string, boolean | string | undefined>)[step] = value;
    if (value) {
      (progress as unknown as Record<string, boolean | string | undefined>)[`${step}At`] = new Date().toISOString();
    }

    try {
      await updateClient.mutateAsync({
        id: clientId,
        data: {
          schedulingProgress: JSON.stringify(progress),
        },
      });
      addToast({
        type: "success",
        title: "Progress updated",
        message: `${step.replace(/([A-Z])/g, " $1").toLowerCase()} marked as ${value ? "complete" : "incomplete"}`,
      });
      refetch();
    } catch (error) {
      addToast({
        type: "error",
        title: "Update failed",
        message: "Failed to update progress. Please try again.",
      });
    }
  };

  // Handle finalize button click - opens finalize modal
  const handleFinalizeClick = (clientId: string) => {
    setFinalizeModalClientId(clientId);
  };

  // Handle actual finalize - sends email and updates status to awaiting_paperwork
  const handleActualFinalize = async (clientId: string) => {
    const client = filteredClients.find((c) => c.id === clientId);
    if (!client) return;

    // Parse and update progress
    let progress: SchedulingProgress;
    try {
      progress = client.schedulingProgress
        ? JSON.parse(client.schedulingProgress)
        : {
            clientCreated: false,
            screenerUploaded: false,
            appointmentCreated: false,
            finalized: false,
          };
    } catch {
      progress = {
        clientCreated: false,
        screenerUploaded: false,
        appointmentCreated: false,
        finalized: false,
      };
    }

    progress.finalized = true;
    progress.finalizedAt = new Date().toISOString();

    try {
      await updateClient.mutateAsync({
        id: clientId,
        data: {
          schedulingProgress: JSON.stringify(progress),
          status: "awaiting_paperwork", // Move to paperwork workflow
        },
      });
      addToast({
        type: "success",
        title: "Client finalized",
        message: "Email sent. Client moved to Awaiting Paperwork.",
      });
      refetch();
    } catch (error) {
      addToast({
        type: "error",
        title: "Finalize failed",
        message: "Failed to finalize client. Please try again.",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-green-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900">Scheduling</h1>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
              <span className="text-gray-600">
                {statusCounts.awaiting} Awaiting Scheduling
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span className="text-gray-600">
                {statusCounts.scheduled} Ready to Schedule
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>
      </header>

      {/* Two Horizontal Sections */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TOP SECTION: Client Table (~45% height) */}
        <div className="h-[45%] border-b bg-white flex flex-col overflow-hidden">
          {filteredClients.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">
                  No clients in scheduling
                </h3>
                <p className="text-sm text-gray-500">
                  Clients will appear here when moved to scheduling from outreach
                </p>
              </div>
            </div>
          ) : (
            <SchedulingTable
              clients={filteredClients}
              selectedClientId={selectedClient?.id || null}
              onSelectClient={setSelectedClientId}
              onProgressUpdate={handleProgressUpdate}
              onFinalize={handleFinalizeClick}
            />
          )}
        </div>

        {/* BOTTOM SECTION: Client Details (~55% height) */}
        <div className="flex-1 bg-gray-50 overflow-y-auto p-6">
          {selectedClient ? (
            <SchedulingDetails
              client={selectedClient}
              onProgressUpdate={handleProgressUpdate}
              onFinalize={handleFinalizeClick}
              onOpenCommunicationsModal={() => setCommunicationsModalClientId(selectedClient.id)}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">
                  No client selected
                </h3>
                <p className="text-sm text-gray-500">
                  Select a client from the table above to view details
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Communications Modal */}
      {communicationsModalClient && (
        <SchedulingCommunicationsModal
          client={communicationsModalClient}
          isOpen={!!communicationsModalClient}
          onClose={() => setCommunicationsModalClientId(null)}
        />
      )}

      {/* Finalize Modal */}
      {finalizeModalClient && (
        <FinalizeModal
          client={finalizeModalClient}
          isOpen={!!finalizeModalClient}
          onClose={() => setFinalizeModalClientId(null)}
          onFinalize={async () => {
            await handleActualFinalize(finalizeModalClient.id);
          }}
          isLoading={updateClient.isPending}
        />
      )}
    </div>
  );
}
