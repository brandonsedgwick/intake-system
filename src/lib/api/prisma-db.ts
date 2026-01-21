/**
 * Prisma Database API Layer
 *
 * This module provides the same API interface as google-sheets.ts but uses
 * SQLite via Prisma instead. Clients can switch between Google Sheets and
 * SQLite by importing from the appropriate module.
 *
 * Note: These APIs do NOT require accessToken since SQLite is local.
 * The accessToken parameter is kept for API compatibility but is ignored.
 */

import { prisma } from "@/lib/db/prisma";
import {
  parseJsonArray,
  parseJsonObject,
  stringifyJsonArray,
  stringifyJsonObject,
} from "@/lib/db/json-helpers";
import {
  Client,
  Clinician,
  AvailabilitySlot,
  EmailTemplate,
  TemplateSection,
  EvaluationCriteria,
  TextEvaluationRule,
  ReferralClinic,
  ReferralClinicsConfig,
  ReferralClinicCustomField,
  Communication,
  AuditLogEntry,
  CaseReopenHistory,
  ClientStatus,
  ClosedFromWorkflow,
  isClosedStatus,
} from "@/types/client";

// ============================================
// Clients API
// ============================================
export const clientsDbApi = {
  async getAll(): Promise<Client[]> {
    const clients = await prisma.client.findMany({
      orderBy: { createdAt: "desc" },
    });

    return clients.map((c) => dbClientToClient(c));
  },

  async getById(id: string): Promise<Client | null> {
    const c = await prisma.client.findUnique({ where: { id } });
    if (!c) return null;
    return dbClientToClient(c);
  },

  async getByStatus(status: ClientStatus): Promise<Client[]> {
    const clients = await prisma.client.findMany({
      where: { status },
      orderBy: { createdAt: "desc" },
    });
    return clients.map((c) => dbClientToClient(c));
  },

  async getByEmail(email: string): Promise<Client[]> {
    // SQLite doesn't support case-insensitive queries natively,
    // so we filter in JS after fetching
    const clients = await prisma.client.findMany({
      orderBy: { createdAt: "desc" },
    });
    const lowerEmail = email.toLowerCase();
    return clients
      .filter((c) => c.email.toLowerCase() === lowerEmail)
      .map((c) => dbClientToClient(c));
  },

  async getFollowUpsDue(): Promise<Client[]> {
    const now = new Date().toISOString();
    const clients = await prisma.client.findMany({
      where: {
        OR: [
          { status: "follow_up_1", nextFollowUpDue: { lte: now } },
          { status: "follow_up_2", nextFollowUpDue: { lte: now } },
          { status: "outreach_sent", nextFollowUpDue: { lte: now } },
        ],
      },
      orderBy: { nextFollowUpDue: "asc" },
    });
    return clients.map((c) => dbClientToClient(c));
  },

  async getClosed(workflow?: ClosedFromWorkflow): Promise<Client[]> {
    const closedStatuses = ["referred", "closed_no_contact", "closed_other", "completed", "duplicate"];
    const clients = await prisma.client.findMany({
      where: {
        status: { in: closedStatuses },
        ...(workflow ? { closedFromWorkflow: workflow } : {}),
      },
      orderBy: { closedDate: "desc" },
    });
    return clients.map((c) => dbClientToClient(c));
  },

  async create(data: Omit<Client, "id" | "createdAt" | "updatedAt">): Promise<Client> {
    const c = await prisma.client.create({
      data: {
        status: data.status,
        source: data.source,
        formResponseId: data.formResponseId || null,
        formTimestamp: data.formTimestamp || null,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone || null,
        age: data.age || null,
        paymentType: data.paymentType || null,
        insuranceProvider: data.insuranceProvider || null,
        insuranceMemberId: data.insuranceMemberId || null,
        preferredTimes: data.preferredTimes ? JSON.stringify(data.preferredTimes) : null,
        requestedClinician: data.requestedClinician || null,
        assignedClinician: data.assignedClinician || null,
        presentingConcerns: data.presentingConcerns || null,
        suicideAttemptRecent: data.suicideAttemptRecent || null,
        psychiatricHospitalization: data.psychiatricHospitalization || null,
        additionalInfo: data.additionalInfo || null,
        evaluationScore: data.evaluationScore ?? null,
        evaluationNotes: data.evaluationNotes || null,
        referralReason: data.referralReason || null,
        isDuplicate: data.isDuplicate ?? false,
        duplicateOfClientId: data.duplicateOfClientId || null,
        textEvaluationResult: data.textEvaluationResult || null,
        initialOutreachDate: data.initialOutreachDate || null,
        followUp1Date: data.followUp1Date || null,
        followUp2Date: data.followUp2Date || null,
        nextFollowUpDue: data.nextFollowUpDue || null,
        scheduledDate: data.scheduledDate || null,
        simplePracticeId: data.simplePracticeId || null,
        paperworkComplete: data.paperworkComplete ?? false,
        referralEmailSentAt: data.referralEmailSentAt || null,
        referralClinicNames: data.referralClinicNames || null,
        closedDate: data.closedDate || null,
        closedReason: data.closedReason || null,
        closedFromWorkflow: data.closedFromWorkflow || null,
        closedFromStatus: data.closedFromStatus || null,
      },
    });
    return dbClientToClient(c);
  },

  async update(id: string, updates: Partial<Client>): Promise<Client | null> {
    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) return null;

    const c = await prisma.client.update({
      where: { id },
      data: {
        status: updates.status ?? existing.status,
        source: updates.source ?? existing.source,
        formResponseId: updates.formResponseId !== undefined ? updates.formResponseId || null : existing.formResponseId,
        formTimestamp: updates.formTimestamp !== undefined ? updates.formTimestamp || null : existing.formTimestamp,
        firstName: updates.firstName ?? existing.firstName,
        lastName: updates.lastName ?? existing.lastName,
        email: updates.email ?? existing.email,
        phone: updates.phone !== undefined ? updates.phone || null : existing.phone,
        age: updates.age !== undefined ? updates.age || null : existing.age,
        paymentType: updates.paymentType !== undefined ? updates.paymentType || null : existing.paymentType,
        insuranceProvider: updates.insuranceProvider !== undefined ? updates.insuranceProvider || null : existing.insuranceProvider,
        insuranceMemberId: updates.insuranceMemberId !== undefined ? updates.insuranceMemberId || null : existing.insuranceMemberId,
        preferredTimes: updates.preferredTimes !== undefined
          ? updates.preferredTimes ? JSON.stringify(updates.preferredTimes) : null
          : existing.preferredTimes,
        requestedClinician: updates.requestedClinician !== undefined ? updates.requestedClinician || null : existing.requestedClinician,
        assignedClinician: updates.assignedClinician !== undefined ? updates.assignedClinician || null : existing.assignedClinician,
        presentingConcerns: updates.presentingConcerns !== undefined ? updates.presentingConcerns || null : existing.presentingConcerns,
        suicideAttemptRecent: updates.suicideAttemptRecent !== undefined ? updates.suicideAttemptRecent || null : existing.suicideAttemptRecent,
        psychiatricHospitalization: updates.psychiatricHospitalization !== undefined ? updates.psychiatricHospitalization || null : existing.psychiatricHospitalization,
        additionalInfo: updates.additionalInfo !== undefined ? updates.additionalInfo || null : existing.additionalInfo,
        evaluationScore: updates.evaluationScore !== undefined ? updates.evaluationScore ?? null : existing.evaluationScore,
        evaluationNotes: updates.evaluationNotes !== undefined ? updates.evaluationNotes || null : existing.evaluationNotes,
        referralReason: updates.referralReason !== undefined ? updates.referralReason || null : existing.referralReason,
        isDuplicate: updates.isDuplicate ?? existing.isDuplicate,
        duplicateOfClientId: updates.duplicateOfClientId !== undefined ? updates.duplicateOfClientId || null : existing.duplicateOfClientId,
        textEvaluationResult: updates.textEvaluationResult !== undefined ? updates.textEvaluationResult || null : existing.textEvaluationResult,
        initialOutreachDate: updates.initialOutreachDate !== undefined ? updates.initialOutreachDate || null : existing.initialOutreachDate,
        followUp1Date: updates.followUp1Date !== undefined ? updates.followUp1Date || null : existing.followUp1Date,
        followUp2Date: updates.followUp2Date !== undefined ? updates.followUp2Date || null : existing.followUp2Date,
        nextFollowUpDue: updates.nextFollowUpDue !== undefined ? updates.nextFollowUpDue || null : existing.nextFollowUpDue,
        scheduledDate: updates.scheduledDate !== undefined ? updates.scheduledDate || null : existing.scheduledDate,
        simplePracticeId: updates.simplePracticeId !== undefined ? updates.simplePracticeId || null : existing.simplePracticeId,
        paperworkComplete: updates.paperworkComplete ?? existing.paperworkComplete,
        referralEmailSentAt: updates.referralEmailSentAt !== undefined ? updates.referralEmailSentAt || null : existing.referralEmailSentAt,
        referralClinicNames: updates.referralClinicNames !== undefined ? updates.referralClinicNames || null : existing.referralClinicNames,
        closedDate: updates.closedDate !== undefined ? updates.closedDate || null : existing.closedDate,
        closedReason: updates.closedReason !== undefined ? updates.closedReason || null : existing.closedReason,
        closedFromWorkflow: updates.closedFromWorkflow !== undefined ? updates.closedFromWorkflow || null : existing.closedFromWorkflow,
        closedFromStatus: updates.closedFromStatus !== undefined ? updates.closedFromStatus || null : existing.closedFromStatus,
      },
    });
    return dbClientToClient(c);
  },

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.client.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  },

  async deleteAll(): Promise<number> {
    const result = await prisma.client.deleteMany();
    return result.count;
  },
};

// Helper to convert Prisma Client to app Client type
function dbClientToClient(c: {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  status: string;
  source: string;
  formResponseId: string | null;
  formTimestamp: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  age: string | null;
  paymentType: string | null;
  insuranceProvider: string | null;
  insuranceMemberId: string | null;
  preferredTimes: string | null;
  requestedClinician: string | null;
  assignedClinician: string | null;
  presentingConcerns: string | null;
  suicideAttemptRecent: string | null;
  psychiatricHospitalization: string | null;
  additionalInfo: string | null;
  evaluationScore: number | null;
  evaluationNotes: string | null;
  referralReason: string | null;
  isDuplicate: boolean;
  duplicateOfClientId: string | null;
  textEvaluationResult: string | null;
  initialOutreachDate: string | null;
  followUp1Date: string | null;
  followUp2Date: string | null;
  nextFollowUpDue: string | null;
  scheduledDate: string | null;
  simplePracticeId: string | null;
  paperworkComplete: boolean;
  referralEmailSentAt: string | null;
  referralClinicNames: string | null;
  closedDate: string | null;
  closedReason: string | null;
  closedFromWorkflow: string | null;
  closedFromStatus: string | null;
}): Client {
  return {
    id: c.id,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    status: c.status as ClientStatus,
    source: c.source as "google_form" | "manual",
    formResponseId: c.formResponseId || undefined,
    formTimestamp: c.formTimestamp || undefined,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone || undefined,
    age: c.age || undefined,
    paymentType: c.paymentType || undefined,
    insuranceProvider: c.insuranceProvider || undefined,
    insuranceMemberId: c.insuranceMemberId || undefined,
    preferredTimes: c.preferredTimes ? parseJsonArray<string>(c.preferredTimes) : undefined,
    requestedClinician: c.requestedClinician || undefined,
    assignedClinician: c.assignedClinician || undefined,
    presentingConcerns: c.presentingConcerns || undefined,
    suicideAttemptRecent: c.suicideAttemptRecent || undefined,
    psychiatricHospitalization: c.psychiatricHospitalization || undefined,
    additionalInfo: c.additionalInfo || undefined,
    evaluationScore: c.evaluationScore ?? undefined,
    evaluationNotes: c.evaluationNotes || undefined,
    referralReason: c.referralReason || undefined,
    isDuplicate: c.isDuplicate || undefined,
    duplicateOfClientId: c.duplicateOfClientId || undefined,
    textEvaluationResult: c.textEvaluationResult || undefined,
    initialOutreachDate: c.initialOutreachDate || undefined,
    followUp1Date: c.followUp1Date || undefined,
    followUp2Date: c.followUp2Date || undefined,
    nextFollowUpDue: c.nextFollowUpDue || undefined,
    scheduledDate: c.scheduledDate || undefined,
    simplePracticeId: c.simplePracticeId || undefined,
    paperworkComplete: c.paperworkComplete || undefined,
    referralEmailSentAt: c.referralEmailSentAt || undefined,
    referralClinicNames: c.referralClinicNames || undefined,
    closedDate: c.closedDate || undefined,
    closedReason: c.closedReason || undefined,
    closedFromWorkflow: c.closedFromWorkflow as ClosedFromWorkflow || undefined,
    closedFromStatus: c.closedFromStatus as ClientStatus || undefined,
  };
}

// ============================================
// Clinicians API
// ============================================
export const cliniciansDbApi = {
  async getAll(): Promise<Clinician[]> {
    const clinicians = await prisma.clinician.findMany({
      orderBy: { lastName: "asc" },
    });

    return clinicians.map((c) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      calendarId: c.calendarId || undefined,
      simplePracticeId: c.simplePracticeId || undefined,
      insurancePanels: parseJsonArray<string>(c.insurancePanels),
      specialties: parseJsonArray<string>(c.specialties),
      newClientCapacity: c.newClientCapacity,
      isAcceptingNew: c.isAcceptingNew,
      defaultSessionLength: c.defaultSessionLength,
    }));
  },

  async getById(id: string): Promise<Clinician | null> {
    const c = await prisma.clinician.findUnique({ where: { id } });
    if (!c) return null;

    return {
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      calendarId: c.calendarId || undefined,
      simplePracticeId: c.simplePracticeId || undefined,
      insurancePanels: parseJsonArray<string>(c.insurancePanels),
      specialties: parseJsonArray<string>(c.specialties),
      newClientCapacity: c.newClientCapacity,
      isAcceptingNew: c.isAcceptingNew,
      defaultSessionLength: c.defaultSessionLength,
    };
  },

  async create(
    clinician: Omit<Clinician, "id">
  ): Promise<Clinician> {
    const c = await prisma.clinician.create({
      data: {
        firstName: clinician.firstName,
        lastName: clinician.lastName,
        email: clinician.email,
        calendarId: clinician.calendarId || null,
        simplePracticeId: clinician.simplePracticeId || null,
        insurancePanels: stringifyJsonArray(clinician.insurancePanels),
        specialties: stringifyJsonArray(clinician.specialties),
        newClientCapacity: clinician.newClientCapacity,
        isAcceptingNew: clinician.isAcceptingNew,
        defaultSessionLength: clinician.defaultSessionLength,
      },
    });

    return {
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      calendarId: c.calendarId || undefined,
      simplePracticeId: c.simplePracticeId || undefined,
      insurancePanels: parseJsonArray<string>(c.insurancePanels),
      specialties: parseJsonArray<string>(c.specialties),
      newClientCapacity: c.newClientCapacity,
      isAcceptingNew: c.isAcceptingNew,
      defaultSessionLength: c.defaultSessionLength,
    };
  },

  async update(
    id: string,
    updates: Partial<Clinician>
  ): Promise<Clinician | null> {
    const existing = await prisma.clinician.findUnique({ where: { id } });
    if (!existing) return null;

    const c = await prisma.clinician.update({
      where: { id },
      data: {
        firstName: updates.firstName ?? existing.firstName,
        lastName: updates.lastName ?? existing.lastName,
        email: updates.email ?? existing.email,
        calendarId: updates.calendarId !== undefined ? updates.calendarId || null : existing.calendarId,
        simplePracticeId: updates.simplePracticeId !== undefined ? updates.simplePracticeId || null : existing.simplePracticeId,
        insurancePanels: updates.insurancePanels !== undefined
          ? stringifyJsonArray(updates.insurancePanels)
          : existing.insurancePanels,
        specialties: updates.specialties !== undefined
          ? stringifyJsonArray(updates.specialties)
          : existing.specialties,
        newClientCapacity: updates.newClientCapacity ?? existing.newClientCapacity,
        isAcceptingNew: updates.isAcceptingNew ?? existing.isAcceptingNew,
        defaultSessionLength: updates.defaultSessionLength ?? existing.defaultSessionLength,
      },
    });

    return {
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      calendarId: c.calendarId || undefined,
      simplePracticeId: c.simplePracticeId || undefined,
      insurancePanels: parseJsonArray<string>(c.insurancePanels),
      specialties: parseJsonArray<string>(c.specialties),
      newClientCapacity: c.newClientCapacity,
      isAcceptingNew: c.isAcceptingNew,
      defaultSessionLength: c.defaultSessionLength,
    };
  },

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.clinician.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  },

  async getAcceptingNew(): Promise<Clinician[]> {
    const all = await this.getAll();
    return all.filter((c) => c.isAcceptingNew && c.newClientCapacity > 0);
  },

  async getByInsurance(insuranceProvider: string): Promise<Clinician[]> {
    const accepting = await this.getAcceptingNew();
    return accepting.filter((c) =>
      c.insurancePanels.some(
        (panel) => panel.toLowerCase() === insuranceProvider.toLowerCase()
      )
    );
  },
};

// ============================================
// Availability API
// ============================================
export const availabilityDbApi = {
  async getAll(): Promise<AvailabilitySlot[]> {
    const slots = await prisma.availability.findMany({
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    return slots.map((s) => ({
      id: s.id,
      clinicianId: s.clinicianId,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      isRecurring: s.isRecurring,
      specificDate: s.specificDate || undefined,
      isBooked: s.isBooked,
      bookedClientId: s.bookedClientId || undefined,
    }));
  },

  async getByClinicianId(clinicianId: string): Promise<AvailabilitySlot[]> {
    const slots = await prisma.availability.findMany({
      where: { clinicianId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    return slots.map((s) => ({
      id: s.id,
      clinicianId: s.clinicianId,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      isRecurring: s.isRecurring,
      specificDate: s.specificDate || undefined,
      isBooked: s.isBooked,
      bookedClientId: s.bookedClientId || undefined,
    }));
  },

  async create(
    slot: Omit<AvailabilitySlot, "id">
  ): Promise<AvailabilitySlot> {
    const s = await prisma.availability.create({
      data: {
        clinicianId: slot.clinicianId,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isRecurring: slot.isRecurring,
        specificDate: slot.specificDate || null,
        isBooked: slot.isBooked,
        bookedClientId: slot.bookedClientId || null,
      },
    });

    return {
      id: s.id,
      clinicianId: s.clinicianId,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      isRecurring: s.isRecurring,
      specificDate: s.specificDate || undefined,
      isBooked: s.isBooked,
      bookedClientId: s.bookedClientId || undefined,
    };
  },

  async update(
    id: string,
    updates: Partial<AvailabilitySlot>
  ): Promise<AvailabilitySlot | null> {
    const existing = await prisma.availability.findUnique({ where: { id } });
    if (!existing) return null;

    const s = await prisma.availability.update({
      where: { id },
      data: {
        clinicianId: updates.clinicianId ?? existing.clinicianId,
        dayOfWeek: updates.dayOfWeek ?? existing.dayOfWeek,
        startTime: updates.startTime ?? existing.startTime,
        endTime: updates.endTime ?? existing.endTime,
        isRecurring: updates.isRecurring ?? existing.isRecurring,
        specificDate: updates.specificDate !== undefined ? updates.specificDate || null : existing.specificDate,
        isBooked: updates.isBooked ?? existing.isBooked,
        bookedClientId: updates.bookedClientId !== undefined ? updates.bookedClientId || null : existing.bookedClientId,
      },
    });

    return {
      id: s.id,
      clinicianId: s.clinicianId,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      isRecurring: s.isRecurring,
      specificDate: s.specificDate || undefined,
      isBooked: s.isBooked,
      bookedClientId: s.bookedClientId || undefined,
    };
  },

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.availability.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  },
};

// ============================================
// Template Sections API
// ============================================
export const templateSectionsDbApi = {
  async getAll(): Promise<TemplateSection[]> {
    const sections = await prisma.templateSection.findMany({
      orderBy: { order: "asc" },
    });

    return sections.map((s) => ({
      id: s.id,
      name: s.name,
      order: s.order,
      color: s.color as TemplateSection["color"],
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));
  },

  async getById(id: string): Promise<TemplateSection | null> {
    const s = await prisma.templateSection.findUnique({ where: { id } });
    if (!s) return null;

    return {
      id: s.id,
      name: s.name,
      order: s.order,
      color: s.color as TemplateSection["color"],
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  },

  async create(
    section: Omit<TemplateSection, "id" | "createdAt" | "updatedAt">
  ): Promise<TemplateSection> {
    const s = await prisma.templateSection.create({
      data: {
        name: section.name,
        order: section.order,
        color: section.color || null,
      },
    });

    return {
      id: s.id,
      name: s.name,
      order: s.order,
      color: s.color as TemplateSection["color"],
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  },

  async update(
    id: string,
    updates: Partial<Omit<TemplateSection, "id" | "createdAt" | "updatedAt">>
  ): Promise<TemplateSection | null> {
    const existing = await prisma.templateSection.findUnique({ where: { id } });
    if (!existing) return null;

    const s = await prisma.templateSection.update({
      where: { id },
      data: {
        name: updates.name ?? existing.name,
        order: updates.order ?? existing.order,
        color: updates.color !== undefined ? updates.color || null : existing.color,
      },
    });

    return {
      id: s.id,
      name: s.name,
      order: s.order,
      color: s.color as TemplateSection["color"],
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  },

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.templateSection.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  },

  async reorder(orderedIds: string[]): Promise<boolean> {
    try {
      await prisma.$transaction(
        orderedIds.map((id, index) =>
          prisma.templateSection.update({
            where: { id },
            data: { order: index },
          })
        )
      );
      return true;
    } catch {
      return false;
    }
  },
};

// ============================================
// Email Templates API
// ============================================
export const templatesDbApi = {
  async getAll(): Promise<EmailTemplate[]> {
    const templates = await prisma.emailTemplate.findMany({
      orderBy: [{ sectionId: "asc" }, { order: "asc" }, { name: "asc" }],
    });

    return templates.map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type as EmailTemplate["type"],
      subject: t.subject,
      body: t.body,
      bodyFormat: t.bodyFormat as EmailTemplate["bodyFormat"],
      isActive: t.isActive,
      isDefault: t.isDefault,
      sectionId: t.sectionId || undefined,
      order: t.order,
      updatedAt: t.updatedAt.toISOString(),
      updatedBy: t.updatedBy || undefined,
    }));
  },

  async getByType(type: EmailTemplate["type"]): Promise<EmailTemplate | null> {
    // Get the default template for this type, or first active one
    const t = await prisma.emailTemplate.findFirst({
      where: { type, isActive: true },
      orderBy: [{ isDefault: "desc" }],
    });
    if (!t) return null;

    return {
      id: t.id,
      name: t.name,
      type: t.type as EmailTemplate["type"],
      subject: t.subject,
      body: t.body,
      bodyFormat: t.bodyFormat as EmailTemplate["bodyFormat"],
      isActive: t.isActive,
      isDefault: t.isDefault,
      sectionId: t.sectionId || undefined,
      order: t.order,
      updatedAt: t.updatedAt.toISOString(),
      updatedBy: t.updatedBy || undefined,
    };
  },

  async getDefaultByType(type: EmailTemplate["type"]): Promise<EmailTemplate | null> {
    const t = await prisma.emailTemplate.findFirst({
      where: { type, isDefault: true },
    });
    if (!t) return null;

    return {
      id: t.id,
      name: t.name,
      type: t.type as EmailTemplate["type"],
      subject: t.subject,
      body: t.body,
      bodyFormat: t.bodyFormat as EmailTemplate["bodyFormat"],
      isActive: t.isActive,
      isDefault: t.isDefault,
      sectionId: t.sectionId || undefined,
      order: t.order,
      updatedAt: t.updatedAt.toISOString(),
      updatedBy: t.updatedBy || undefined,
    };
  },

  async getById(id: string): Promise<EmailTemplate | null> {
    const t = await prisma.emailTemplate.findUnique({ where: { id } });
    if (!t) return null;

    return {
      id: t.id,
      name: t.name,
      type: t.type as EmailTemplate["type"],
      subject: t.subject,
      body: t.body,
      bodyFormat: t.bodyFormat as EmailTemplate["bodyFormat"],
      isActive: t.isActive,
      isDefault: t.isDefault,
      sectionId: t.sectionId || undefined,
      order: t.order,
      updatedAt: t.updatedAt.toISOString(),
      updatedBy: t.updatedBy || undefined,
    };
  },

  async getBySectionId(sectionId: string | null): Promise<EmailTemplate[]> {
    const templates = await prisma.emailTemplate.findMany({
      where: { sectionId: sectionId },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });

    return templates.map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type as EmailTemplate["type"],
      subject: t.subject,
      body: t.body,
      bodyFormat: t.bodyFormat as EmailTemplate["bodyFormat"],
      isActive: t.isActive,
      isDefault: t.isDefault,
      sectionId: t.sectionId || undefined,
      order: t.order,
      updatedAt: t.updatedAt.toISOString(),
      updatedBy: t.updatedBy || undefined,
    }));
  },

  async create(
    template: Omit<EmailTemplate, "id" | "updatedAt">
  ): Promise<EmailTemplate> {
    const t = await prisma.emailTemplate.create({
      data: {
        name: template.name,
        type: template.type,
        subject: template.subject,
        body: template.body,
        bodyFormat: template.bodyFormat || "html",
        isActive: template.isActive,
        isDefault: template.isDefault || false,
        sectionId: template.sectionId || null,
        order: template.order || 0,
        updatedBy: template.updatedBy || null,
      },
    });

    return {
      id: t.id,
      name: t.name,
      type: t.type as EmailTemplate["type"],
      subject: t.subject,
      body: t.body,
      bodyFormat: t.bodyFormat as EmailTemplate["bodyFormat"],
      isActive: t.isActive,
      isDefault: t.isDefault,
      sectionId: t.sectionId || undefined,
      order: t.order,
      updatedAt: t.updatedAt.toISOString(),
      updatedBy: t.updatedBy || undefined,
    };
  },

  async update(
    id: string,
    updates: Partial<EmailTemplate>
  ): Promise<EmailTemplate | null> {
    const existing = await prisma.emailTemplate.findUnique({ where: { id } });
    if (!existing) return null;

    const t = await prisma.emailTemplate.update({
      where: { id },
      data: {
        name: updates.name ?? existing.name,
        type: updates.type ?? existing.type,
        subject: updates.subject ?? existing.subject,
        body: updates.body ?? existing.body,
        bodyFormat: updates.bodyFormat ?? existing.bodyFormat,
        isActive: updates.isActive ?? existing.isActive,
        isDefault: updates.isDefault ?? existing.isDefault,
        sectionId: updates.sectionId !== undefined ? updates.sectionId || null : existing.sectionId,
        order: updates.order ?? existing.order,
        updatedBy: updates.updatedBy !== undefined ? updates.updatedBy || null : existing.updatedBy,
      },
    });

    return {
      id: t.id,
      name: t.name,
      type: t.type as EmailTemplate["type"],
      subject: t.subject,
      body: t.body,
      bodyFormat: t.bodyFormat as EmailTemplate["bodyFormat"],
      isActive: t.isActive,
      isDefault: t.isDefault,
      sectionId: t.sectionId || undefined,
      order: t.order,
      updatedAt: t.updatedAt.toISOString(),
      updatedBy: t.updatedBy || undefined,
    };
  },

  async setDefault(id: string): Promise<EmailTemplate | null> {
    const template = await prisma.emailTemplate.findUnique({ where: { id } });
    if (!template) return null;

    // Transaction: unset current default for this type, set new default
    await prisma.$transaction([
      prisma.emailTemplate.updateMany({
        where: { type: template.type, isDefault: true },
        data: { isDefault: false },
      }),
      prisma.emailTemplate.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);

    return this.getById(id);
  },

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.emailTemplate.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  },

  async reorderInSection(sectionId: string | null, orderedIds: string[]): Promise<boolean> {
    try {
      await prisma.$transaction(
        orderedIds.map((id, index) =>
          prisma.emailTemplate.update({
            where: { id },
            data: { order: index, sectionId: sectionId },
          })
        )
      );
      return true;
    } catch {
      return false;
    }
  },
};

// ============================================
// Audit Log API
// ============================================
export const auditLogDbApi = {
  async log(
    entry: Omit<AuditLogEntry, "id" | "timestamp">
  ): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        userEmail: entry.userEmail,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        previousValue: entry.previousValue || null,
        newValue: entry.newValue || null,
        ipAddress: entry.ipAddress || null,
      },
    });
  },

  async getAll(): Promise<AuditLogEntry[]> {
    const logs = await prisma.auditLog.findMany({
      orderBy: { timestamp: "desc" },
    });

    return logs.map((l) => ({
      id: l.id,
      timestamp: l.timestamp.toISOString(),
      userId: l.userId,
      userEmail: l.userEmail,
      action: l.action,
      entityType: l.entityType as AuditLogEntry["entityType"],
      entityId: l.entityId,
      previousValue: l.previousValue || undefined,
      newValue: l.newValue || undefined,
      ipAddress: l.ipAddress || undefined,
    }));
  },

  async getByEntityId(entityId: string): Promise<AuditLogEntry[]> {
    const logs = await prisma.auditLog.findMany({
      where: { entityId },
      orderBy: { timestamp: "desc" },
    });

    return logs.map((l) => ({
      id: l.id,
      timestamp: l.timestamp.toISOString(),
      userId: l.userId,
      userEmail: l.userEmail,
      action: l.action,
      entityType: l.entityType as AuditLogEntry["entityType"],
      entityId: l.entityId,
      previousValue: l.previousValue || undefined,
      newValue: l.newValue || undefined,
      ipAddress: l.ipAddress || undefined,
    }));
  },

  async getRecent(limit: number = 50): Promise<AuditLogEntry[]> {
    const logs = await prisma.auditLog.findMany({
      orderBy: { timestamp: "desc" },
      take: limit,
    });

    return logs.map((l) => ({
      id: l.id,
      timestamp: l.timestamp.toISOString(),
      userId: l.userId,
      userEmail: l.userEmail,
      action: l.action,
      entityType: l.entityType as AuditLogEntry["entityType"],
      entityId: l.entityId,
      previousValue: l.previousValue || undefined,
      newValue: l.newValue || undefined,
      ipAddress: l.ipAddress || undefined,
    }));
  },
};

// ============================================
// Evaluation Criteria API
// ============================================
export const evaluationCriteriaDbApi = {
  async getAll(): Promise<EvaluationCriteria[]> {
    const criteria = await prisma.evaluationCriteria.findMany({
      orderBy: { priority: "asc" },
    });

    return criteria.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description || undefined,
      field: c.field as EvaluationCriteria["field"],
      operator: c.operator as EvaluationCriteria["operator"],
      value: c.value,
      action: c.action as EvaluationCriteria["action"],
      priority: c.priority,
      isActive: c.isActive,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));
  },

  async getActive(): Promise<EvaluationCriteria[]> {
    const criteria = await prisma.evaluationCriteria.findMany({
      where: { isActive: true },
      orderBy: { priority: "asc" },
    });

    return criteria.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description || undefined,
      field: c.field as EvaluationCriteria["field"],
      operator: c.operator as EvaluationCriteria["operator"],
      value: c.value,
      action: c.action as EvaluationCriteria["action"],
      priority: c.priority,
      isActive: c.isActive,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));
  },

  async getById(id: string): Promise<EvaluationCriteria | null> {
    const c = await prisma.evaluationCriteria.findUnique({ where: { id } });
    if (!c) return null;

    return {
      id: c.id,
      name: c.name,
      description: c.description || undefined,
      field: c.field as EvaluationCriteria["field"],
      operator: c.operator as EvaluationCriteria["operator"],
      value: c.value,
      action: c.action as EvaluationCriteria["action"],
      priority: c.priority,
      isActive: c.isActive,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  },

  async create(
    criteria: Omit<EvaluationCriteria, "id" | "createdAt" | "updatedAt">
  ): Promise<EvaluationCriteria> {
    const c = await prisma.evaluationCriteria.create({
      data: {
        name: criteria.name,
        description: criteria.description || null,
        field: criteria.field,
        operator: criteria.operator,
        value: criteria.value,
        action: criteria.action,
        priority: criteria.priority,
        isActive: criteria.isActive,
      },
    });

    return {
      id: c.id,
      name: c.name,
      description: c.description || undefined,
      field: c.field as EvaluationCriteria["field"],
      operator: c.operator as EvaluationCriteria["operator"],
      value: c.value,
      action: c.action as EvaluationCriteria["action"],
      priority: c.priority,
      isActive: c.isActive,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  },

  async update(
    id: string,
    updates: Partial<EvaluationCriteria>
  ): Promise<EvaluationCriteria | null> {
    const existing = await prisma.evaluationCriteria.findUnique({ where: { id } });
    if (!existing) return null;

    const c = await prisma.evaluationCriteria.update({
      where: { id },
      data: {
        name: updates.name ?? existing.name,
        description: updates.description !== undefined ? updates.description || null : existing.description,
        field: updates.field ?? existing.field,
        operator: updates.operator ?? existing.operator,
        value: updates.value ?? existing.value,
        action: updates.action ?? existing.action,
        priority: updates.priority ?? existing.priority,
        isActive: updates.isActive ?? existing.isActive,
      },
    });

    return {
      id: c.id,
      name: c.name,
      description: c.description || undefined,
      field: c.field as EvaluationCriteria["field"],
      operator: c.operator as EvaluationCriteria["operator"],
      value: c.value,
      action: c.action as EvaluationCriteria["action"],
      priority: c.priority,
      isActive: c.isActive,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  },

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.evaluationCriteria.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  },
};

// ============================================
// Text Evaluation Rules API
// ============================================
export const textEvaluationRulesDbApi = {
  async getAll(): Promise<TextEvaluationRule[]> {
    const rules = await prisma.textEvaluationRule.findMany({
      orderBy: { name: "asc" },
    });

    return rules.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category as TextEvaluationRule["category"],
      severity: r.severity as TextEvaluationRule["severity"],
      patterns: parseJsonArray<string>(r.patterns),
      isRegex: r.isRegex,
      negationWords: parseJsonArray<string>(r.negationWords),
      negationWindow: r.negationWindow,
      requiresLLM: r.requiresLLM,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  },

  async getActive(): Promise<TextEvaluationRule[]> {
    const rules = await prisma.textEvaluationRule.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });

    return rules.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category as TextEvaluationRule["category"],
      severity: r.severity as TextEvaluationRule["severity"],
      patterns: parseJsonArray<string>(r.patterns),
      isRegex: r.isRegex,
      negationWords: parseJsonArray<string>(r.negationWords),
      negationWindow: r.negationWindow,
      requiresLLM: r.requiresLLM,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  },

  async getById(id: string): Promise<TextEvaluationRule | null> {
    const r = await prisma.textEvaluationRule.findUnique({ where: { id } });
    if (!r) return null;

    return {
      id: r.id,
      name: r.name,
      category: r.category as TextEvaluationRule["category"],
      severity: r.severity as TextEvaluationRule["severity"],
      patterns: parseJsonArray<string>(r.patterns),
      isRegex: r.isRegex,
      negationWords: parseJsonArray<string>(r.negationWords),
      negationWindow: r.negationWindow,
      requiresLLM: r.requiresLLM,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  },

  async create(
    rule: Omit<TextEvaluationRule, "id" | "createdAt" | "updatedAt">
  ): Promise<TextEvaluationRule> {
    const r = await prisma.textEvaluationRule.create({
      data: {
        name: rule.name,
        category: rule.category,
        severity: rule.severity,
        patterns: stringifyJsonArray(rule.patterns),
        isRegex: rule.isRegex,
        negationWords: stringifyJsonArray(rule.negationWords),
        negationWindow: rule.negationWindow,
        requiresLLM: rule.requiresLLM,
        isActive: rule.isActive,
      },
    });

    return {
      id: r.id,
      name: r.name,
      category: r.category as TextEvaluationRule["category"],
      severity: r.severity as TextEvaluationRule["severity"],
      patterns: parseJsonArray<string>(r.patterns),
      isRegex: r.isRegex,
      negationWords: parseJsonArray<string>(r.negationWords),
      negationWindow: r.negationWindow,
      requiresLLM: r.requiresLLM,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  },

  async update(
    id: string,
    updates: Partial<TextEvaluationRule>
  ): Promise<TextEvaluationRule | null> {
    const existing = await prisma.textEvaluationRule.findUnique({ where: { id } });
    if (!existing) return null;

    const r = await prisma.textEvaluationRule.update({
      where: { id },
      data: {
        name: updates.name ?? existing.name,
        category: updates.category ?? existing.category,
        severity: updates.severity ?? existing.severity,
        patterns: updates.patterns !== undefined
          ? stringifyJsonArray(updates.patterns)
          : existing.patterns,
        isRegex: updates.isRegex ?? existing.isRegex,
        negationWords: updates.negationWords !== undefined
          ? stringifyJsonArray(updates.negationWords)
          : existing.negationWords,
        negationWindow: updates.negationWindow ?? existing.negationWindow,
        requiresLLM: updates.requiresLLM ?? existing.requiresLLM,
        isActive: updates.isActive ?? existing.isActive,
      },
    });

    return {
      id: r.id,
      name: r.name,
      category: r.category as TextEvaluationRule["category"],
      severity: r.severity as TextEvaluationRule["severity"],
      patterns: parseJsonArray<string>(r.patterns),
      isRegex: r.isRegex,
      negationWords: parseJsonArray<string>(r.negationWords),
      negationWindow: r.negationWindow,
      requiresLLM: r.requiresLLM,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  },

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.textEvaluationRule.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  },
};

// ============================================
// Referral Clinics API
// ============================================
export const referralClinicsDbApi = {
  async getAll(): Promise<ReferralClinic[]> {
    const clinics = await prisma.referralClinic.findMany({
      orderBy: { practiceName: "asc" },
    });

    return clinics.map((c) => ({
      id: c.id,
      practiceName: c.practiceName,
      address: c.address || undefined,
      phone: c.phone || undefined,
      email: c.email || undefined,
      specialties: parseJsonArray<string>(c.specialties),
      notes: c.notes || undefined,
      customFields: parseJsonObject<Record<string, string>>(c.customFields),
      isActive: c.isActive,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));
  },

  async getActive(): Promise<ReferralClinic[]> {
    const clinics = await prisma.referralClinic.findMany({
      where: { isActive: true },
      orderBy: { practiceName: "asc" },
    });

    return clinics.map((c) => ({
      id: c.id,
      practiceName: c.practiceName,
      address: c.address || undefined,
      phone: c.phone || undefined,
      email: c.email || undefined,
      specialties: parseJsonArray<string>(c.specialties),
      notes: c.notes || undefined,
      customFields: parseJsonObject<Record<string, string>>(c.customFields),
      isActive: c.isActive,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));
  },

  async getById(id: string): Promise<ReferralClinic | null> {
    const c = await prisma.referralClinic.findUnique({ where: { id } });
    if (!c) return null;

    return {
      id: c.id,
      practiceName: c.practiceName,
      address: c.address || undefined,
      phone: c.phone || undefined,
      email: c.email || undefined,
      specialties: parseJsonArray<string>(c.specialties),
      notes: c.notes || undefined,
      customFields: parseJsonObject<Record<string, string>>(c.customFields),
      isActive: c.isActive,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  },

  async create(
    clinic: Omit<ReferralClinic, "id" | "createdAt" | "updatedAt">
  ): Promise<ReferralClinic> {
    const c = await prisma.referralClinic.create({
      data: {
        practiceName: clinic.practiceName,
        address: clinic.address || null,
        phone: clinic.phone || null,
        email: clinic.email || null,
        specialties: stringifyJsonArray(clinic.specialties),
        notes: clinic.notes || null,
        customFields: stringifyJsonObject(clinic.customFields),
        isActive: clinic.isActive,
      },
    });

    return {
      id: c.id,
      practiceName: c.practiceName,
      address: c.address || undefined,
      phone: c.phone || undefined,
      email: c.email || undefined,
      specialties: parseJsonArray<string>(c.specialties),
      notes: c.notes || undefined,
      customFields: parseJsonObject<Record<string, string>>(c.customFields),
      isActive: c.isActive,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  },

  async update(
    id: string,
    updates: Partial<ReferralClinic>
  ): Promise<ReferralClinic | null> {
    const existing = await prisma.referralClinic.findUnique({ where: { id } });
    if (!existing) return null;

    const c = await prisma.referralClinic.update({
      where: { id },
      data: {
        practiceName: updates.practiceName ?? existing.practiceName,
        address: updates.address !== undefined ? updates.address || null : existing.address,
        phone: updates.phone !== undefined ? updates.phone || null : existing.phone,
        email: updates.email !== undefined ? updates.email || null : existing.email,
        specialties: updates.specialties !== undefined
          ? stringifyJsonArray(updates.specialties)
          : existing.specialties,
        notes: updates.notes !== undefined ? updates.notes || null : existing.notes,
        customFields: updates.customFields !== undefined
          ? stringifyJsonObject(updates.customFields)
          : existing.customFields,
        isActive: updates.isActive ?? existing.isActive,
      },
    });

    return {
      id: c.id,
      practiceName: c.practiceName,
      address: c.address || undefined,
      phone: c.phone || undefined,
      email: c.email || undefined,
      specialties: parseJsonArray<string>(c.specialties),
      notes: c.notes || undefined,
      customFields: parseJsonObject<Record<string, string>>(c.customFields),
      isActive: c.isActive,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  },

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.referralClinic.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  },
};

// ============================================
// Referral Clinics Config API
// ============================================
export const referralClinicsConfigDbApi = {
  async getConfig(): Promise<ReferralClinicsConfig> {
    const config = await prisma.referralClinicsConfig.findFirst();
    if (!config) {
      return { customFields: [], updatedAt: new Date().toISOString() };
    }

    return {
      customFields: parseJsonArray<ReferralClinicCustomField>(config.customFields),
      updatedAt: config.updatedAt.toISOString(),
    };
  },

  async saveCustomFields(
    customFields: ReferralClinicCustomField[]
  ): Promise<ReferralClinicsConfig> {
    const existing = await prisma.referralClinicsConfig.findFirst();

    if (existing) {
      const config = await prisma.referralClinicsConfig.update({
        where: { id: existing.id },
        data: {
          customFields: stringifyJsonArray(customFields),
        },
      });

      return {
        customFields: parseJsonArray<ReferralClinicCustomField>(config.customFields),
        updatedAt: config.updatedAt.toISOString(),
      };
    } else {
      const config = await prisma.referralClinicsConfig.create({
        data: {
          customFields: stringifyJsonArray(customFields),
        },
      });

      return {
        customFields: parseJsonArray<ReferralClinicCustomField>(config.customFields),
        updatedAt: config.updatedAt.toISOString(),
      };
    }
  },
};

// ============================================
// Settings API
// ============================================
export const settingsDbApi = {
  async getAll(): Promise<Record<string, string>> {
    const settings = await prisma.setting.findMany();
    const result: Record<string, string> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    return result;
  },

  async get(key: string): Promise<string | undefined> {
    const setting = await prisma.setting.findUnique({ where: { key } });
    return setting?.value;
  },

  async set(key: string, value: string): Promise<void> {
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  },

  async delete(key: string): Promise<boolean> {
    try {
      await prisma.setting.delete({ where: { key } });
      return true;
    } catch {
      return false;
    }
  },

  async getLLMSettings(): Promise<{
    textEvaluationLLMEnabled?: string;
    textEvaluationLLMThreshold?: string;
    googleCloudProject?: string;
    vertexAILocation?: string;
  }> {
    const settings = await this.getAll();
    return {
      textEvaluationLLMEnabled: settings.textEvaluationLLMEnabled,
      textEvaluationLLMThreshold: settings.textEvaluationLLMThreshold,
      googleCloudProject: settings.googleCloudProject,
      vertexAILocation: settings.vertexAILocation,
    };
  },
};

// ============================================
// Intake Fields API
// ============================================
export const intakeFieldsDbApi = {
  async getAll(): Promise<Array<{
    id: string;
    field: string;
    label: string;
    description: string;
    type: string;
    googleFormField: string | null;
    isRequired: boolean;
    isActive: boolean;
    order: number;
    createdAt: string;
    updatedAt: string;
  }>> {
    const fields = await prisma.intakeField.findMany({
      orderBy: { order: "asc" },
    });

    return fields.map((f) => ({
      id: f.id,
      field: f.field,
      label: f.label,
      description: f.description || "",
      type: f.type,
      googleFormField: f.googleFormField,
      isRequired: f.isRequired,
      isActive: f.isActive,
      order: f.order,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    }));
  },

  async getActive(): Promise<Array<{
    id: string;
    field: string;
    label: string;
    description: string;
    type: string;
    googleFormField: string | null;
    isRequired: boolean;
    isActive: boolean;
    order: number;
    createdAt: string;
    updatedAt: string;
  }>> {
    const fields = await prisma.intakeField.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
    });

    return fields.map((f) => ({
      id: f.id,
      field: f.field,
      label: f.label,
      description: f.description || "",
      type: f.type,
      googleFormField: f.googleFormField,
      isRequired: f.isRequired,
      isActive: f.isActive,
      order: f.order,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    }));
  },

  async create(field: {
    field: string;
    label: string;
    description?: string;
    type: string;
    googleFormField?: string;
    isRequired: boolean;
    isActive: boolean;
    order: number;
  }): Promise<{
    id: string;
    field: string;
    label: string;
    description: string;
    type: string;
    googleFormField: string | null;
    isRequired: boolean;
    isActive: boolean;
    order: number;
    createdAt: string;
    updatedAt: string;
  }> {
    const f = await prisma.intakeField.create({
      data: {
        field: field.field,
        label: field.label,
        description: field.description || null,
        type: field.type,
        googleFormField: field.googleFormField || null,
        isRequired: field.isRequired,
        isActive: field.isActive,
        order: field.order,
      },
    });

    return {
      id: f.id,
      field: f.field,
      label: f.label,
      description: f.description || "",
      type: f.type,
      googleFormField: f.googleFormField,
      isRequired: f.isRequired,
      isActive: f.isActive,
      order: f.order,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    };
  },

  async update(
    id: string,
    updates: Partial<{
      field: string;
      label: string;
      description: string;
      type: string;
      googleFormField: string | null;
      isRequired: boolean;
      isActive: boolean;
      order: number;
    }>
  ): Promise<{
    id: string;
    field: string;
    label: string;
    description: string;
    type: string;
    googleFormField: string | null;
    isRequired: boolean;
    isActive: boolean;
    order: number;
    createdAt: string;
    updatedAt: string;
  } | null> {
    const existing = await prisma.intakeField.findUnique({ where: { id } });
    if (!existing) return null;

    const f = await prisma.intakeField.update({
      where: { id },
      data: {
        field: updates.field ?? existing.field,
        label: updates.label ?? existing.label,
        description: updates.description !== undefined ? updates.description || null : existing.description,
        type: updates.type ?? existing.type,
        googleFormField: updates.googleFormField !== undefined ? updates.googleFormField : existing.googleFormField,
        isRequired: updates.isRequired ?? existing.isRequired,
        isActive: updates.isActive ?? existing.isActive,
        order: updates.order ?? existing.order,
      },
    });

    return {
      id: f.id,
      field: f.field,
      label: f.label,
      description: f.description || "",
      type: f.type,
      googleFormField: f.googleFormField,
      isRequired: f.isRequired,
      isActive: f.isActive,
      order: f.order,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    };
  },

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.intakeField.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  },
};

// ============================================
// Communications API
// ============================================
export const communicationsDbApi = {
  async getByClientId(clientId: string): Promise<Communication[]> {
    const comms = await prisma.communication.findMany({
      where: { clientId },
      orderBy: { timestamp: "desc" },
    });

    return comms.map((c) => ({
      id: c.id,
      clientId: c.clientId,
      timestamp: c.timestamp.toISOString(),
      direction: c.direction as Communication["direction"],
      type: c.type as Communication["type"],
      gmailMessageId: c.gmailMessageId || undefined,
      gmailThreadId: c.gmailThreadId || undefined,
      subject: c.subject,
      bodyPreview: c.bodyPreview,
      fullBody: c.fullBody || undefined,
      sentBy: c.sentBy || undefined,
    }));
  },

  async getAll(): Promise<Communication[]> {
    const comms = await prisma.communication.findMany({
      orderBy: { timestamp: "desc" },
    });

    return comms.map((c) => ({
      id: c.id,
      clientId: c.clientId,
      timestamp: c.timestamp.toISOString(),
      direction: c.direction as Communication["direction"],
      type: c.type as Communication["type"],
      gmailMessageId: c.gmailMessageId || undefined,
      gmailThreadId: c.gmailThreadId || undefined,
      subject: c.subject,
      bodyPreview: c.bodyPreview,
      fullBody: c.fullBody || undefined,
      sentBy: c.sentBy || undefined,
    }));
  },

  async create(
    communication: Omit<Communication, "id">
  ): Promise<Communication> {
    const c = await prisma.communication.create({
      data: {
        clientId: communication.clientId,
        timestamp: new Date(communication.timestamp),
        direction: communication.direction,
        type: communication.type,
        gmailMessageId: communication.gmailMessageId || null,
        gmailThreadId: communication.gmailThreadId || null,
        subject: communication.subject,
        bodyPreview: communication.bodyPreview,
        fullBody: communication.fullBody || null,
        sentBy: communication.sentBy || null,
      },
    });

    return {
      id: c.id,
      clientId: c.clientId,
      timestamp: c.timestamp.toISOString(),
      direction: c.direction as Communication["direction"],
      type: c.type as Communication["type"],
      gmailMessageId: c.gmailMessageId || undefined,
      gmailThreadId: c.gmailThreadId || undefined,
      subject: c.subject,
      bodyPreview: c.bodyPreview,
      fullBody: c.fullBody || undefined,
      sentBy: c.sentBy || undefined,
    };
  },

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.communication.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  },
};

// ============================================
// Case Reopen History API
// ============================================
export const caseReopenHistoryDbApi = {
  async create(data: {
    clientId: string;
    reopenedBy: string;
    reopenReason: string;
    previousStatus: ClientStatus;
    newStatus: ClientStatus;
    closedDate?: string;
    closedReason?: string;
    closedFromWorkflow?: ClosedFromWorkflow;
  }): Promise<CaseReopenHistory> {
    const record = await prisma.caseReopenHistory.create({
      data: {
        clientId: data.clientId,
        reopenedBy: data.reopenedBy,
        reopenReason: data.reopenReason,
        previousStatus: data.previousStatus,
        newStatus: data.newStatus,
        closedDate: data.closedDate || null,
        closedReason: data.closedReason || null,
        closedFromWorkflow: data.closedFromWorkflow || null,
      },
    });

    return {
      id: record.id,
      clientId: record.clientId,
      reopenedAt: record.reopenedAt.toISOString(),
      reopenedBy: record.reopenedBy,
      reopenReason: record.reopenReason,
      previousStatus: record.previousStatus as ClientStatus,
      newStatus: record.newStatus as ClientStatus,
      closedDate: record.closedDate || undefined,
      closedReason: record.closedReason || undefined,
      closedFromWorkflow: record.closedFromWorkflow as ClosedFromWorkflow || undefined,
    };
  },

  async getByClientId(clientId: string): Promise<CaseReopenHistory[]> {
    const records = await prisma.caseReopenHistory.findMany({
      where: { clientId },
      orderBy: { reopenedAt: "desc" },
    });

    return records.map((record) => ({
      id: record.id,
      clientId: record.clientId,
      reopenedAt: record.reopenedAt.toISOString(),
      reopenedBy: record.reopenedBy,
      reopenReason: record.reopenReason,
      previousStatus: record.previousStatus as ClientStatus,
      newStatus: record.newStatus as ClientStatus,
      closedDate: record.closedDate || undefined,
      closedReason: record.closedReason || undefined,
      closedFromWorkflow: record.closedFromWorkflow as ClosedFromWorkflow || undefined,
    }));
  },

  async getRecent(limit: number = 50): Promise<CaseReopenHistory[]> {
    const records = await prisma.caseReopenHistory.findMany({
      orderBy: { reopenedAt: "desc" },
      take: limit,
    });

    return records.map((record) => ({
      id: record.id,
      clientId: record.clientId,
      reopenedAt: record.reopenedAt.toISOString(),
      reopenedBy: record.reopenedBy,
      reopenReason: record.reopenReason,
      previousStatus: record.previousStatus as ClientStatus,
      newStatus: record.newStatus as ClientStatus,
      closedDate: record.closedDate || undefined,
      closedReason: record.closedReason || undefined,
      closedFromWorkflow: record.closedFromWorkflow as ClosedFromWorkflow || undefined,
    }));
  },
};

// ============================================
// Outreach Attempts API
// ============================================
import {
  OutreachAttempt,
  OutreachAttemptStatus,
  OutreachAttemptType,
} from "@/types/client";

export const outreachAttemptsDbApi = {
  async getByClientId(clientId: string): Promise<OutreachAttempt[]> {
    const attempts = await prisma.outreachAttempt.findMany({
      where: { clientId },
      orderBy: { attemptNumber: "asc" },
    });

    return attempts.map((a) => ({
      id: a.id,
      clientId: a.clientId,
      attemptNumber: a.attemptNumber,
      attemptType: a.attemptType as OutreachAttemptType,
      sentAt: a.sentAt?.toISOString(),
      status: a.status as OutreachAttemptStatus,
      emailSubject: a.emailSubject || undefined,
      emailPreview: a.emailPreview || undefined,
      gmailThreadId: a.gmailThreadId || undefined,
      gmailMessageId: a.gmailMessageId || undefined,
      responseDetected: a.responseDetected,
      responseDetectedAt: a.responseDetectedAt?.toISOString(),
      responseMessageId: a.responseMessageId || undefined,
      responseWindowEnd: a.responseWindowEnd?.toISOString(),
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    }));
  },

  async getById(id: string): Promise<OutreachAttempt | null> {
    const a = await prisma.outreachAttempt.findUnique({ where: { id } });
    if (!a) return null;

    return {
      id: a.id,
      clientId: a.clientId,
      attemptNumber: a.attemptNumber,
      attemptType: a.attemptType as OutreachAttemptType,
      sentAt: a.sentAt?.toISOString(),
      status: a.status as OutreachAttemptStatus,
      emailSubject: a.emailSubject || undefined,
      emailPreview: a.emailPreview || undefined,
      gmailThreadId: a.gmailThreadId || undefined,
      gmailMessageId: a.gmailMessageId || undefined,
      responseDetected: a.responseDetected,
      responseDetectedAt: a.responseDetectedAt?.toISOString(),
      responseMessageId: a.responseMessageId || undefined,
      responseWindowEnd: a.responseWindowEnd?.toISOString(),
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  },

  async create(data: {
    clientId: string;
    attemptNumber: number;
    attemptType: OutreachAttemptType;
    status?: OutreachAttemptStatus;
    sentAt?: string;
    emailSubject?: string;
    emailPreview?: string;
  }): Promise<OutreachAttempt> {
    const a = await prisma.outreachAttempt.create({
      data: {
        clientId: data.clientId,
        attemptNumber: data.attemptNumber,
        attemptType: data.attemptType,
        status: data.status || "pending",
        sentAt: data.sentAt ? new Date(data.sentAt) : null,
        emailSubject: data.emailSubject || null,
        emailPreview: data.emailPreview || null,
      },
    });

    return {
      id: a.id,
      clientId: a.clientId,
      attemptNumber: a.attemptNumber,
      attemptType: a.attemptType as OutreachAttemptType,
      sentAt: a.sentAt?.toISOString(),
      status: a.status as OutreachAttemptStatus,
      emailSubject: a.emailSubject || undefined,
      emailPreview: a.emailPreview || undefined,
      gmailThreadId: a.gmailThreadId || undefined,
      gmailMessageId: a.gmailMessageId || undefined,
      responseDetected: a.responseDetected,
      responseDetectedAt: a.responseDetectedAt?.toISOString(),
      responseMessageId: a.responseMessageId || undefined,
      responseWindowEnd: a.responseWindowEnd?.toISOString(),
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  },

  async update(
    id: string,
    updates: Partial<{
      status: OutreachAttemptStatus;
      sentAt: string;
      emailSubject: string;
      emailPreview: string;
    }>
  ): Promise<OutreachAttempt | null> {
    const existing = await prisma.outreachAttempt.findUnique({ where: { id } });
    if (!existing) return null;

    const a = await prisma.outreachAttempt.update({
      where: { id },
      data: {
        status: updates.status ?? existing.status,
        sentAt: updates.sentAt !== undefined
          ? new Date(updates.sentAt)
          : existing.sentAt,
        emailSubject: updates.emailSubject !== undefined
          ? updates.emailSubject || null
          : existing.emailSubject,
        emailPreview: updates.emailPreview !== undefined
          ? updates.emailPreview || null
          : existing.emailPreview,
      },
    });

    return {
      id: a.id,
      clientId: a.clientId,
      attemptNumber: a.attemptNumber,
      attemptType: a.attemptType as OutreachAttemptType,
      sentAt: a.sentAt?.toISOString(),
      status: a.status as OutreachAttemptStatus,
      emailSubject: a.emailSubject || undefined,
      emailPreview: a.emailPreview || undefined,
      gmailThreadId: a.gmailThreadId || undefined,
      gmailMessageId: a.gmailMessageId || undefined,
      responseDetected: a.responseDetected,
      responseDetectedAt: a.responseDetectedAt?.toISOString(),
      responseMessageId: a.responseMessageId || undefined,
      responseWindowEnd: a.responseWindowEnd?.toISOString(),
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  },

  async markAsSent(
    id: string,
    emailSubject: string,
    emailPreview: string
  ): Promise<OutreachAttempt | null> {
    return this.update(id, {
      status: "sent",
      sentAt: new Date().toISOString(),
      emailSubject,
      emailPreview: emailPreview.substring(0, 200),
    });
  },

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.outreachAttempt.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  },

  async deleteByClientId(clientId: string): Promise<number> {
    const result = await prisma.outreachAttempt.deleteMany({
      where: { clientId },
    });
    return result.count;
  },

  async initializeForClient(
    clientId: string,
    attemptCount: number = 3
  ): Promise<OutreachAttempt[]> {
    // First, get any existing attempts for this client
    const existingAttempts = await this.getByClientId(clientId);
    const existingAttemptNumbers = new Set(existingAttempts.map((a) => a.attemptNumber));

    const attempts: OutreachAttempt[] = [...existingAttempts];

    for (let i = 1; i <= attemptCount; i++) {
      // Skip if this attempt already exists
      if (existingAttemptNumbers.has(i)) {
        continue;
      }

      const attemptType: OutreachAttemptType =
        i === 1 ? "initial_outreach" : (`follow_up_${i - 1}` as OutreachAttemptType);

      const attempt = await this.create({
        clientId,
        attemptNumber: i,
        attemptType,
        status: "pending",
      });
      attempts.push(attempt);
    }

    // Sort by attempt number before returning
    return attempts.sort((a, b) => a.attemptNumber - b.attemptNumber);
  },

  async getNextPendingAttempt(clientId: string): Promise<OutreachAttempt | null> {
    const attempt = await prisma.outreachAttempt.findFirst({
      where: {
        clientId,
        status: "pending",
      },
      orderBy: { attemptNumber: "asc" },
    });

    if (!attempt) return null;

    return {
      id: attempt.id,
      clientId: attempt.clientId,
      attemptNumber: attempt.attemptNumber,
      attemptType: attempt.attemptType as OutreachAttemptType,
      sentAt: attempt.sentAt?.toISOString(),
      status: attempt.status as OutreachAttemptStatus,
      emailSubject: attempt.emailSubject || undefined,
      emailPreview: attempt.emailPreview || undefined,
      gmailThreadId: attempt.gmailThreadId || undefined,
      gmailMessageId: attempt.gmailMessageId || undefined,
      responseDetected: attempt.responseDetected,
      responseDetectedAt: attempt.responseDetectedAt?.toISOString(),
      responseMessageId: attempt.responseMessageId || undefined,
      responseWindowEnd: attempt.responseWindowEnd?.toISOString(),
      createdAt: attempt.createdAt.toISOString(),
      updatedAt: attempt.updatedAt.toISOString(),
    };
  },

  /**
   * Update an attempt with Gmail message/thread IDs when sending
   */
  async updateWithGmailIds(
    id: string,
    gmailMessageId: string,
    gmailThreadId: string,
    responseWindowEnd: Date
  ): Promise<OutreachAttempt | null> {
    const existing = await prisma.outreachAttempt.findUnique({ where: { id } });
    if (!existing) return null;

    const a = await prisma.outreachAttempt.update({
      where: { id },
      data: {
        gmailMessageId,
        gmailThreadId,
        responseWindowEnd,
      },
    });

    return {
      id: a.id,
      clientId: a.clientId,
      attemptNumber: a.attemptNumber,
      attemptType: a.attemptType as OutreachAttemptType,
      sentAt: a.sentAt?.toISOString(),
      status: a.status as OutreachAttemptStatus,
      emailSubject: a.emailSubject || undefined,
      emailPreview: a.emailPreview || undefined,
      gmailThreadId: a.gmailThreadId || undefined,
      gmailMessageId: a.gmailMessageId || undefined,
      responseDetected: a.responseDetected,
      responseDetectedAt: a.responseDetectedAt?.toISOString(),
      responseMessageId: a.responseMessageId || undefined,
      responseWindowEnd: a.responseWindowEnd?.toISOString(),
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  },

  /**
   * Update response detection status when a reply is found
   */
  async updateResponseStatus(
    id: string,
    updates: {
      responseDetected: boolean;
      responseDetectedAt?: string;
      responseMessageId?: string;
    }
  ): Promise<OutreachAttempt | null> {
    const existing = await prisma.outreachAttempt.findUnique({ where: { id } });
    if (!existing) return null;

    const a = await prisma.outreachAttempt.update({
      where: { id },
      data: {
        responseDetected: updates.responseDetected,
        responseDetectedAt: updates.responseDetectedAt
          ? new Date(updates.responseDetectedAt)
          : null,
        responseMessageId: updates.responseMessageId || null,
      },
    });

    return {
      id: a.id,
      clientId: a.clientId,
      attemptNumber: a.attemptNumber,
      attemptType: a.attemptType as OutreachAttemptType,
      sentAt: a.sentAt?.toISOString(),
      status: a.status as OutreachAttemptStatus,
      emailSubject: a.emailSubject || undefined,
      emailPreview: a.emailPreview || undefined,
      gmailThreadId: a.gmailThreadId || undefined,
      gmailMessageId: a.gmailMessageId || undefined,
      responseDetected: a.responseDetected,
      responseDetectedAt: a.responseDetectedAt?.toISOString(),
      responseMessageId: a.responseMessageId || undefined,
      responseWindowEnd: a.responseWindowEnd?.toISOString(),
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  },

  /**
   * Get all sent attempts that are awaiting response (not yet detected)
   */
  async getSentAwaitingResponse(): Promise<OutreachAttempt[]> {
    const attempts = await prisma.outreachAttempt.findMany({
      where: {
        status: "sent",
        responseDetected: false,
        gmailThreadId: { not: null },
      },
      orderBy: { sentAt: "desc" },
    });

    return attempts.map((a) => ({
      id: a.id,
      clientId: a.clientId,
      attemptNumber: a.attemptNumber,
      attemptType: a.attemptType as OutreachAttemptType,
      sentAt: a.sentAt?.toISOString(),
      status: a.status as OutreachAttemptStatus,
      emailSubject: a.emailSubject || undefined,
      emailPreview: a.emailPreview || undefined,
      gmailThreadId: a.gmailThreadId || undefined,
      gmailMessageId: a.gmailMessageId || undefined,
      responseDetected: a.responseDetected,
      responseDetectedAt: a.responseDetectedAt?.toISOString(),
      responseMessageId: a.responseMessageId || undefined,
      responseWindowEnd: a.responseWindowEnd?.toISOString(),
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    }));
  },
};
