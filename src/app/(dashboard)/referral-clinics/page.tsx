"use client";

import { ReferralClinicsConfig } from "@/components/settings/referral-clinics-config";

export default function ReferralClinicsPage() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Referral Clinics</h1>
        <p className="text-gray-600">
          Manage clinics for client referrals
        </p>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <ReferralClinicsConfig />
      </div>
    </div>
  );
}
