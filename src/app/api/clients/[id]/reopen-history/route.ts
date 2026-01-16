import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { caseReopenHistoryDbApi } from "@/lib/api/prisma-db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/clients/[id]/reopen-history - Get reopen history for a client
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const history = await caseReopenHistoryDbApi.getByClientId(id);

    return NextResponse.json(history);
  } catch (error) {
    console.error("Error fetching reopen history:", error);
    return NextResponse.json(
      { error: "Failed to fetch reopen history" },
      { status: 500 }
    );
  }
}
