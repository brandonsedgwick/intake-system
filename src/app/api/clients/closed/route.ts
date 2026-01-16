import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { clientsDbApi } from "@/lib/api/prisma-db";
import { ClosedFromWorkflow } from "@/types/client";

// GET /api/clients/closed - Get all closed clients, optionally filtered by workflow
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workflow = searchParams.get("workflow") as ClosedFromWorkflow | null;
    const limit = parseInt(searchParams.get("limit") || "50");

    // Get closed clients (the API already sorts by closedDate desc)
    let closedClients = await clientsDbApi.getClosed(workflow || undefined);

    // Apply limit
    closedClients = closedClients.slice(0, limit);

    return NextResponse.json(closedClients);
  } catch (error) {
    console.error("Error fetching closed clients:", error);
    return NextResponse.json(
      { error: "Failed to fetch closed clients" },
      { status: 500 }
    );
  }
}
