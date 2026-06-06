import mongoose from 'mongoose';
import Placement, { PlacementStage, ACTIVE_PLACEMENT_STAGES } from '../models/Placement.js';

const ALLOWED_TRANSITIONS: Record<PlacementStage, PlacementStage[]> = {
  proposed:       ['applied', 'lost'],
  applied:        ['interviewing', 'declined', 'lost'],
  interviewing:   ['offer_extended', 'declined', 'lost'],
  offer_extended: ['placed', 'declined', 'lost'],
  placed:         [],
  declined:       [],
  lost:           [],
};

export function canTransition(from: PlacementStage, to: PlacementStage): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface CreatePlacementInput {
  consultantAccountId: string;
  teacherAccountId: string;
  jobId: string;
  applicationId?: string;
  initialStage?: PlacementStage;
  internalNotes?: string;
  agreedFee?: number;
}

export async function createPlacement(input: CreatePlacementInput) {
  const stage = input.initialStage ?? 'proposed';
  const doc = await Placement.create({
    consultantAccountId: input.consultantAccountId,
    teacherAccountId: input.teacherAccountId,
    jobId: input.jobId,
    applicationId: input.applicationId,
    stage,
    internalNotes: input.internalNotes,
    agreedFee: input.agreedFee,
    stageHistory: [
      {
        stage,
        changedAt: new Date(),
        changedByAccountId: new mongoose.Types.ObjectId(input.consultantAccountId),
        reason: 'Created',
      },
    ],
    lastActivityAt: new Date(),
  });
  return doc;
}

export async function transitionStage(
  placementId: string,
  toStage: PlacementStage,
  changedByAccountId: string,
  reason?: string
) {
  const placement = await Placement.findById(placementId);
  if (!placement) throw new Error('Placement not found');
  if (!canTransition(placement.stage, toStage)) {
    throw new Error(`Cannot transition from ${placement.stage} to ${toStage}`);
  }
  placement.stage = toStage;
  placement.stageHistory.push({
    stage: toStage,
    changedAt: new Date(),
    changedByAccountId: new mongoose.Types.ObjectId(changedByAccountId),
    reason,
  });
  placement.lastActivityAt = new Date();
  await placement.save();
  return placement;
}

export function isActiveStage(stage: PlacementStage): boolean {
  return ACTIVE_PLACEMENT_STAGES.includes(stage);
}
