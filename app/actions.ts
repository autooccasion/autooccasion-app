'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth } from 'app/auth';
import {
  updateOutcome,
  updateOpportunityStatus,
  type VehicleStatus,
  type OpportunityStatus,
} from 'app/db';

export async function saveApiKey(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const apiKey = formData.get('apiKey');
  if (typeof apiKey !== 'string' || !apiKey.startsWith('sk-ant-')) return;

  cookies().set('gp_api_key', apiKey, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  });
}

const VALID_STATUSES: VehicleStatus[] = ['analyse', 'achete', 'vendu', 'refuse'];

function toInt(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const n = parseInt(value.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

function toDate(value: FormDataEntryValue | null): Date | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Record the real outcome of a vehicle so Carmelo learns from actual results.
export async function updateVehicleOutcome(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) return;

  const id = toInt(formData.get('id'));
  const status = formData.get('status');
  if (id == null || typeof status !== 'string' || !VALID_STATUSES.includes(status as VehicleStatus)) {
    return;
  }

  await updateOutcome(id, session.user.email, {
    status: status as VehicleStatus,
    realBuyPrice: toInt(formData.get('realBuyPrice')),
    realSellPrice: toInt(formData.get('realSellPrice')),
    boughtAt: toDate(formData.get('boughtAt')),
    soldAt: toDate(formData.get('soldAt')),
  });

  revalidatePath('/carmelo/history');
}

const VALID_OPPORTUNITY_STATUSES: OpportunityStatus[] = ['nouveau', 'contacte', 'ecarte'];

// Mark an opportunity as contacted / discarded from the daily feed.
export async function setOpportunityStatus(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) return;

  const id = toInt(formData.get('id'));
  const status = formData.get('status');
  if (
    id == null ||
    typeof status !== 'string' ||
    !VALID_OPPORTUNITY_STATUSES.includes(status as OpportunityStatus)
  ) {
    return;
  }

  await updateOpportunityStatus(id, session.user.email, status as OpportunityStatus);
  revalidatePath('/carmelo/opportunites');
}
