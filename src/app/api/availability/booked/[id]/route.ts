import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";

// DELETE - Remove a booked slot
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    // Check if the booked slot exists
    const existingSlot = await prisma.bookedSlot.findUnique({
      where: { id },
    });

    if (!existingSlot) {
      return NextResponse.json(
        { error: "Booked slot not found" },
        { status: 404 }
      );
    }

    // Delete the booked slot
    await prisma.bookedSlot.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting booked slot:", error);
    return NextResponse.json(
      { error: "Failed to delete booked slot" },
      { status: 500 }
    );
  }
}
