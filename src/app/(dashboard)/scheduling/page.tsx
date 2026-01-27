"use client";

import { useState, useMemo } from "react";
import { useClients, useUpdateClient } from "@/hooks/use-clients";
import { Client, ClientStatus, ScheduledAppointment, SchedulingProgress } from "@/types/client";
import { SchedulingTable } from "@/components/scheduling/scheduling-table";
import { SchedulingDetails } from "@/components/scheduling/scheduling-details";
import { SchedulingCommunicationsModal } from "@/components/scheduling/scheduling-communications-modal";
import { FinalizeModal } from "@/components/scheduling/finalize-modal";
import CreateClientModal from "@/components/scheduling/create-client-modal";
import SimplePracticeIdModal from "@/components/scheduling/simple-practice-id-modal";
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
  const [createClientModalClientId, setCreateClientModalClientId] = useState<string | null>(null);

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

  // Get client for create client modal
  const createClientModalClient = useMemo(() => {
    if (!createClientModalClientId) return null;
    return filteredClients.find((c) => c.id === createClientModalClientId) || null;
  }, [createClientModalClientId, filteredClients]);

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

  // Reset multiple progress steps at once (used for undo operations to avoid race conditions)
  const handleResetProgressSteps = async (
    clientId: string,
    steps: SchedulingProgressStep[]
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

    // Reset all specified steps
    for (const step of steps) {
      (progress as unknown as Record<string, boolean | string | undefined>)[step] = false;
      // Clear the timestamp as well
      (progress as unknown as Record<string, boolean | string | undefined>)[`${step}At`] = undefined;
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
        title: "Progress reset",
        message: `Reset ${steps.length} step(s) successfully`,
      });
      refetch();
    } catch (error) {
      addToast({
        type: "error",
        title: "Reset failed",
        message: "Failed to reset progress. Please try again.",
      });
    }
  };

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

  // Handle create client button click - opens create client modal
  const handleCreateClientClick = (clientId: string) => {
    setCreateClientModalClientId(clientId);
  };

  // Handle upload screener button click - launches Puppeteer to upload PDF
  const handleUploadScreener = async (clientId: string) => {
    const client = filteredClients.find((c) => c.id === clientId);

    if (!client?.simplePracticeId) {
      addToast({
        type: "error",
        title: "Simple Practice ID Required",
        message: "Please create the client in Simple Practice first to capture their ID.",
      });
      return;
    }

    if (!client?.screenerPdfData) {
      addToast({
        type: "error",
        title: "Screener PDF Required",
        message: "Please generate the screener PDF first.",
      });
      return;
    }

    addToast({
      type: "info",
      title: "Opening Browser",
      message: "Launching Puppeteer to upload screener...",
    });

    try {
      const response = await fetch('/api/simple-practice/upload-screener', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      });

      const data = await response.json();

      if (data.success && data.screenerUploaded) {
        addToast({
          type: "success",
          title: "Screener Uploaded",
          message: "The screener PDF has been uploaded to Simple Practice.",
        });
      } else if (data.success && !data.screenerUploaded) {
        addToast({
          type: "warning",
          title: "Upload Incomplete",
          message: data.error || "The upload was not completed successfully.",
        });
      } else {
        addToast({
          type: "error",
          title: "Upload Failed",
          message: data.error || "Failed to upload screener.",
        });
      }

      // Refresh client data to show updated status
      refetch();
    } catch (error: any) {
      console.error('[SchedulingPage] Upload screener error:', error);
      addToast({
        type: "error",
        title: "Upload Error",
        message: error.message || "An error occurred while uploading.",
      });
    }
  };

  // Handle create appointment button click - launches Puppeteer to navigate to client profile
  const handleCreateAppointment = async (clientId: string) => {
    const client = filteredClients.find((c) => c.id === clientId);

    if (!client?.simplePracticeId) {
      addToast({
        type: "error",
        title: "Simple Practice ID Required",
        message: "Please create the client in Simple Practice first.",
      });
      return;
    }

    if (!client?.scheduledAppointment) {
      addToast({
        type: "error",
        title: "Appointment Details Required",
        message: "No appointment details found for this client.",
      });
      return;
    }

    addToast({
      type: "info",
      title: "Opening Browser",
      message: "Launching browser to create appointment...",
    });

    try {
      const response = await fetch('/api/simple-practice/create-appointment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      });

      const data = await response.json();

      if (data.success) {
        addToast({
          type: "success",
          title: "Browser Closed",
          message: "Returned to intake app.",
        });
        refetch();
      } else {
        addToast({
          type: "error",
          title: "Error",
          message: data.error || "Failed to open browser.",
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "An error occurred.";
      console.error('[SchedulingPage] Create appointment error:', error);
      addToast({
        type: "error",
        title: "Error",
        message: errorMessage,
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

  // Handle Simple Practice ID saved
  const handleSimplePracticeIdSaved = async (clientId: string, simplePracticeId: string) => {
    console.log('[SchedulingPage] handleSimplePracticeIdSaved called', { clientId, simplePracticeId });

    try {
      console.log('[SchedulingPage] Calling updateClient mutation...');
      await updateClient.mutateAsync({
        id: clientId,
        data: {
          simplePracticeId: simplePracticeId || null,
        },
      });
      console.log('[SchedulingPage] ✓ updateClient mutation successful');

      if (simplePracticeId) {
        addToast({
          type: "success",
          title: "Simple Practice ID saved",
          message: `Client ID ${simplePracticeId} has been linked.`,
        });
      } else {
        addToast({
          type: "success",
          title: "Simple Practice ID cleared",
          message: "Client creation has been undone.",
        });
      }
      refetch();
    } catch (error) {
      console.error('[SchedulingPage] ✗ Error updating client:', error);
      addToast({
        type: "error",
        title: "Save failed",
        message: "Failed to update Simple Practice ID. Please try again.",
      });
      throw error; // Re-throw so calling code knows it failed
    }
  };

  // Handle scheduling notes update
  const handleSchedulingNotesUpdate = async (clientId: string, notes: string) => {
    try {
      await updateClient.mutateAsync({
        id: clientId,
        data: {
          schedulingNotes: notes,
        },
      });
      refetch();
    } catch (error) {
      addToast({
        type: "error",
        title: "Update failed",
        message: "Failed to update scheduling notes.",
      });
    }
  };

  // Handle create client success - called from CreateClientModal
  const handleCreateClientSuccess = async (simplePracticeId: string, method: 'puppeteer' | 'extension') => {
    if (!createClientModalClientId) return;

    if (method === 'puppeteer') {
      // Puppeteer auto-captured the ID, save it and mark complete
      await handleSimplePracticeIdSaved(createClientModalClientId, simplePracticeId);
      await handleProgressUpdate(createClientModalClientId, 'clientCreated', true);
      setCreateClientModalClientId(null);
    } else {
      // Extension method - close create modal and keep client ID in state for manual ID modal
      setCreateClientModalClientId(null);
      // The CreateClientModal will show an alert, user will manually enter ID
    }
  };

  // Handle move to outreach
  const handleMoveToOutreach = async (clientId: string, reason: string) => {
    try {
      await updateClient.mutateAsync({
        id: clientId,
        data: {
          status: "pending_outreach",
          schedulingNotes: reason,
          // Clear scheduling-related fields
          scheduledAppointment: undefined,
          schedulingProgress: undefined,
        },
      });
      addToast({
        type: "success",
        title: "Moved to Outreach",
        message: "Client has been moved back to the outreach workflow.",
      });
      setSelectedClientId(null);
      refetch();
    } catch (error) {
      addToast({
        type: "error",
        title: "Move failed",
        message: "Failed to move client to outreach. Please try again.",
      });
      throw error;
    }
  };

  // Handle move to referral
  const handleMoveToReferral = async (clientId: string, reason: string) => {
    try {
      await updateClient.mutateAsync({
        id: clientId,
        data: {
          status: "pending_referral",
          schedulingNotes: reason,
          referralReason: reason,
          // Clear scheduling-related fields
          scheduledAppointment: undefined,
          schedulingProgress: undefined,
        },
      });
      addToast({
        type: "success",
        title: "Moved to Referral",
        message: "Client has been moved to the referral workflow.",
      });
      setSelectedClientId(null);
      refetch();
    } catch (error) {
      addToast({
        type: "error",
        title: "Move failed",
        message: "Failed to move client to referral. Please try again.",
      });
      throw error;
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
              onCreateClient={handleCreateClientClick}
              onUploadScreener={handleUploadScreener}
              onCreateAppointment={handleCreateAppointment}
            />
          )}
        </div>

        {/* BOTTOM SECTION: Client Details (~55% height) */}
        <div className="flex-1 bg-gray-50 overflow-y-auto p-6">
          {selectedClient ? (
            <SchedulingDetails
              client={selectedClient}
              onProgressUpdate={handleProgressUpdate}
              onResetProgressSteps={handleResetProgressSteps}
              onSimplePracticeIdSaved={handleSimplePracticeIdSaved}
              onSchedulingNotesUpdate={handleSchedulingNotesUpdate}
              onFinalize={handleFinalizeClick}
              onOpenCommunicationsModal={() => setCommunicationsModalClientId(selectedClient.id)}
              onMoveToOutreach={handleMoveToOutreach}
              onMoveToReferral={handleMoveToReferral}
              onRefetch={refetch}
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

      {/* Create Client Modal */}
      {createClientModalClient && (
        <CreateClientModal
          client={createClientModalClient}
          isOpen={!!createClientModalClient}
          onClose={() => setCreateClientModalClientId(null)}
          onSuccess={handleCreateClientSuccess}
          onBrowserClosed={() => {
            // Refetch data when browser closes, even if no ID was captured
            // This picks up any partial changes (PDF generation, etc.)
            console.log('[SchedulingPage] Browser closed, refetching data...');
            refetch();
          }}
        />
      )}
    </div>
  );
}
