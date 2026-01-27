import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { clientsDbApi, auditLogDbApi } from "@/lib/api/prisma-db";
import { generateScreenerPDF, saveScreenerPDF, ClientDataForPDF } from "@/lib/services/pdf-screener";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/clients/[id] - Get a single client
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const client = await clientsDbApi.getById(id);

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json(client);
  } catch (error) {
    console.error("Error fetching client:", error);
    return NextResponse.json(
      { error: "Failed to fetch client" },
      { status: 500 }
    );
  }
}

// PATCH /api/clients/[id] - Update a client
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Get existing client for audit log
    const existingClient = await clientsDbApi.getById(id);
    if (!existingClient) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const updatedClient = await clientsDbApi.update(id, body);

    if (!updatedClient) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Auto-generate PDF when client moves to scheduling
    // Only generate if:
    // 1. Status is changing to awaiting_scheduling
    // 2. Previous status was not already awaiting_scheduling
    // 3. Client doesn't already have a PDF generated
    if (
      body.status === "awaiting_scheduling" &&
      existingClient.status !== "awaiting_scheduling" &&
      !existingClient.screenerPdfData
    ) {
      console.log("[Client Update] Client moved to scheduling, generating PDF...");
      try {
        // Prepare client data for PDF
        const clientDataForPDF: ClientDataForPDF = {
          id: updatedClient.id,
          firstName: updatedClient.firstName,
          lastName: updatedClient.lastName,
          email: updatedClient.email,
          phone: updatedClient.phone,
          dateOfBirth: updatedClient.dateOfBirth,
          age: updatedClient.age,
          paymentType: updatedClient.paymentType,
          insuranceProvider: updatedClient.insuranceProvider,
          insuranceMemberId: updatedClient.insuranceMemberId,
          presentingConcerns: updatedClient.presentingConcerns,
          suicideAttemptRecent: updatedClient.suicideAttemptRecent,
          psychiatricHospitalization: updatedClient.psychiatricHospitalization,
          additionalInfo: updatedClient.additionalInfo,
        };

        // Generate and save PDF
        const { pdfBase64, generatedAt } = await generateScreenerPDF(clientDataForPDF);
        await saveScreenerPDF(id, pdfBase64, generatedAt);
        console.log("[Client Update] ✓ PDF generated and saved successfully");
      } catch (pdfError) {
        // Log the error but don't fail the update - PDF can be generated manually later
        console.error("[Client Update] Failed to auto-generate PDF:", pdfError);
      }
    }

    // Log the action
    await auditLogDbApi.log({
      userId: session.user?.email || "unknown",
      userEmail: session.user?.email || "unknown",
      action: "update",
      entityType: "client",
      entityId: id,
      previousValue: JSON.stringify(existingClient),
      newValue: JSON.stringify(updatedClient),
    });

    return NextResponse.json(updatedClient);
  } catch (error) {
    console.error("Error updating client:", error);
    return NextResponse.json(
      { error: "Failed to update client" },
      { status: 500 }
    );
  }
}
