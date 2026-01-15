import { NextRequest, NextResponse } from "next/server";
import { checkAdminAccess } from "@/lib/auth/admin";
import { referralClinicsConfigApi, auditLogApi } from "@/lib/api/google-sheets";

// GET /api/referral-clinics/config - Get referral clinics config (custom fields)
export async function GET() {
  try {
    const { isAdmin, session, error } = await checkAdminAccess();

    if (!isAdmin) {
      return NextResponse.json({ error }, { status: error === "Unauthorized" ? 401 : 403 });
    }

    const config = await referralClinicsConfigApi.getConfig(session!.accessToken!);

    return NextResponse.json(config);
  } catch (error) {
    console.error("Error fetching referral clinics config:", error);
    return NextResponse.json(
      { error: "Failed to fetch referral clinics config" },
      { status: 500 }
    );
  }
}

// PUT /api/referral-clinics/config - Update custom fields configuration
export async function PUT(request: NextRequest) {
  try {
    const { isAdmin, session, error } = await checkAdminAccess();

    if (!isAdmin) {
      return NextResponse.json({ error }, { status: error === "Unauthorized" ? 401 : 403 });
    }

    const body = await request.json();

    if (!body.customFields || !Array.isArray(body.customFields)) {
      return NextResponse.json(
        { error: "Missing customFields array" },
        { status: 400 }
      );
    }

    // Get previous config for audit
    const previousConfig = await referralClinicsConfigApi.getConfig(session!.accessToken!);

    const updatedConfig = await referralClinicsConfigApi.saveCustomFields(
      session!.accessToken!,
      body.customFields
    );

    // Log the action
    await auditLogApi.log(session!.accessToken!, {
      userId: session!.user?.email || "unknown",
      userEmail: session!.user?.email || "unknown",
      action: "update",
      entityType: "settings",
      entityId: "referral_clinics_config",
      previousValue: JSON.stringify(previousConfig),
      newValue: JSON.stringify(updatedConfig),
    });

    return NextResponse.json(updatedConfig);
  } catch (error) {
    console.error("Error updating referral clinics config:", error);
    return NextResponse.json(
      { error: "Failed to update referral clinics config" },
      { status: 500 }
    );
  }
}
