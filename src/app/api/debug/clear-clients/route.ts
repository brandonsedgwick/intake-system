import { NextResponse } from "next/server";
import { clientsDbApi } from "@/lib/api/prisma-db";

// DELETE /api/debug/clear-clients
// Clears all client entries from the database for debugging/testing
export async function DELETE() {
  try {
    const count = await clientsDbApi.deleteAll();

    return NextResponse.json({
      success: true,
      message: `Deleted ${count} clients from the database`,
      count
    });
  } catch (error) {
    console.error("Error clearing clients:", error);
    return NextResponse.json(
      { error: "Failed to clear clients" },
      { status: 500 }
    );
  }
}
