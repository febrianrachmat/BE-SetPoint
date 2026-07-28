import { Injectable } from '@nestjs/common';
import { CourtStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { COURT_OCCUPYING_MATCH_STATUSES } from './court.rules';

export type CreateCourtData = {
  tournamentId: string;
  name: string;
  label: string;
  status?: CourtStatus;
  displayOrder: number;
  availabilityNotes?: string | null;
  createdBy?: string;
};

export type UpdateCourtData = {
  name?: string;
  label?: string;
  displayOrder?: number;
  availabilityNotes?: string | null;
  updatedBy?: string;
};

const COURT_ORDER: Prisma.CourtOrderByWithRelationInput[] = [
  { displayOrder: 'asc' },
  { label: 'asc' },
  { createdAt: 'asc' },
];

@Injectable()
export class CourtRepository {
  constructor(private readonly prisma: PrismaService) {}

  findActiveTournamentById(tournamentId: string) {
    return this.prisma.tournament.findFirst({
      where: { id: tournamentId, deletedAt: null },
    });
  }

  findActiveInTournament(tournamentId: string, courtId: string) {
    return this.prisma.court.findFirst({
      where: { id: courtId, tournamentId, deletedAt: null },
    });
  }

  findManyActive(params: { tournamentId: string; status?: CourtStatus }) {
    return this.prisma.court.findMany({
      where: {
        tournamentId: params.tournamentId,
        deletedAt: null,
        ...(params.status ? { status: params.status } : {}),
      },
      orderBy: COURT_ORDER,
    });
  }

  findByNormalizedLabel(params: {
    tournamentId: string;
    label: string;
    excludeCourtId?: string;
  }) {
    return this.prisma.court.findFirst({
      where: {
        tournamentId: params.tournamentId,
        deletedAt: null,
        label: { equals: params.label, mode: 'insensitive' },
        ...(params.excludeCourtId ? { id: { not: params.excludeCourtId } } : {}),
      },
      select: { id: true, label: true },
    });
  }

  async nextDisplayOrder(tournamentId: string) {
    const result = await this.prisma.court.aggregate({
      where: { tournamentId, deletedAt: null },
      _max: { displayOrder: true },
    });
    return (result._max.displayOrder ?? -1) + 1;
  }

  create(data: CreateCourtData) {
    return this.prisma.court.create({
      data: {
        tournamentId: data.tournamentId,
        name: data.name,
        label: data.label,
        status: data.status ?? CourtStatus.available,
        displayOrder: data.displayOrder,
        availabilityNotes: data.availabilityNotes,
        createdBy: data.createdBy,
        updatedBy: data.createdBy,
      },
    });
  }

  update(id: string, data: UpdateCourtData) {
    return this.prisma.court.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.label !== undefined ? { label: data.label } : {}),
        ...(data.displayOrder !== undefined
          ? { displayOrder: data.displayOrder }
          : {}),
        ...(data.availabilityNotes !== undefined
          ? { availabilityNotes: data.availabilityNotes }
          : {}),
        updatedBy: data.updatedBy,
        rowVersion: { increment: 1 },
      },
    });
  }

  setStatus(params: {
    courtId: string;
    status: CourtStatus;
    availabilityNotes?: string | null;
    updatedBy?: string;
  }) {
    return this.prisma.court.update({
      where: { id: params.courtId },
      data: {
        status: params.status,
        ...(params.availabilityNotes !== undefined
          ? { availabilityNotes: params.availabilityNotes }
          : {}),
        updatedBy: params.updatedBy,
        rowVersion: { increment: 1 },
      },
    });
  }

  softDelete(id: string, deletedBy?: string) {
    return this.prisma.court.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy,
        updatedBy: deletedBy,
        rowVersion: { increment: 1 },
      },
    });
  }

  async reorder(params: {
    items: Array<{ courtId: string; displayOrder: number }>;
    updatedBy?: string;
  }) {
    await this.prisma.$transaction(
      params.items.map((item) =>
        this.prisma.court.update({
          where: { id: item.courtId },
          data: {
            displayOrder: item.displayOrder,
            updatedBy: params.updatedBy,
            rowVersion: { increment: 1 },
          },
        }),
      ),
    );
  }

  findOccupyingMatch(courtId: string) {
    return this.prisma.match.findFirst({
      where: {
        courtId,
        status: { in: COURT_OCCUPYING_MATCH_STATUSES },
      },
      select: { id: true, status: true },
    });
  }

  countMatchReferences(courtId: string) {
    return this.prisma.match.count({ where: { courtId } });
  }

  countScheduleEntryReferences(courtId: string) {
    return this.prisma.scheduleEntry.count({ where: { courtId } });
  }
}
