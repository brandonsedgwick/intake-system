import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";

// GET - Fetch all booked slots
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const bookedSlots = await prisma.bookedSlot.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ bookedSlots });
  } catch (error) {
    console.error("Error fetching booked slots:", error);
    return NextResponse.json(
      { error: "Failed to fetch booked slots" },
      { status: 500 }
    );
  }
}

// POST - Create a new booked slot
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { slotId, day, time, clinician, clientId } = body;

    // Validate required fields
    if (!slotId || !day || !time || !clinician || !clientId) {
      return NextResponse.json(
        { error: "Missing required fields: slotId, day, time, clinician, clientId" },
        { status: 400 }
      );
    }

    // Check if this exact slot+clinician is already booked
    const existingBooking = await prisma.bookedSlot.findFirst({
      where: {
        slotId,
        clinician,
      },
    });

    if (existingBooking) {
      return NextResponse.json(
        { error: "This slot with this clinician is already booked" },
        { status: 409 }
      );
    }

    // Create the booked slot
    const bookedSlot = await prisma.bookedSlot.create({
      data: {
        slotId,
        day,
        time,
        clinician,
        clientId,
        bookedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({ bookedSlot }, { status: 201 });
  } catch (error) {
    console.error("Error creating booked slot:", error);
    return NextResponse.json(
      { error: "Failed to create booked slot" },
      { status: 500 }
    );
  }
}
