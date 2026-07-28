import {
  CourtStatus,
  EligibilityStatus,
  PlayerStatus,
  PrismaClient,
  PublishState,
  TeamStatus,
  TournamentStatus,
  UserRole,
  Visibility,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEMO_TOURNAMENT_NAME = 'Set Point Demo Open 2026';
const DEMO_PASSWORD = 'Password123!';

const DEMO_USERS: Array<{
  email: string;
  displayName: string;
  role: UserRole;
}> = [
  {
    email: 'superadmin@setpoint.local',
    displayName: 'Super Admin',
    role: UserRole.super_admin,
  },
  {
    email: 'admin@setpoint.local',
    displayName: 'Tournament Admin',
    role: UserRole.tournament_admin,
  },
  {
    email: 'referee@setpoint.local',
    displayName: 'Referee',
    role: UserRole.referee,
  },
];

async function clearDemoTournament() {
  const existing = await prisma.tournament.findFirst({
    where: { name: DEMO_TOURNAMENT_NAME },
    select: { id: true },
  });

  if (!existing) {
    return;
  }

  const tournamentId = existing.id;

  await prisma.userRoleAssignment.deleteMany({
    where: { tournamentId },
  });

  const categories = await prisma.category.findMany({
    where: { tournamentId },
    select: { id: true },
  });
  const categoryIds = categories.map((c) => c.id);

  if (categoryIds.length > 0) {
    const schedules = await prisma.schedule.findMany({
      where: { categoryId: { in: categoryIds } },
      select: { id: true },
    });
    const scheduleIds = schedules.map((s) => s.id);

    if (scheduleIds.length > 0) {
      const scheduleVersions = await prisma.scheduleVersion.findMany({
        where: { scheduleId: { in: scheduleIds } },
        select: { id: true },
      });
      const scheduleVersionIds = scheduleVersions.map((v) => v.id);

      if (scheduleVersionIds.length > 0) {
        await prisma.scheduleEntry.deleteMany({
          where: { scheduleVersionId: { in: scheduleVersionIds } },
        });
        await prisma.matchParticipation.deleteMany({
          where: {
            match: { scheduleVersionId: { in: scheduleVersionIds } },
          },
        });
        await prisma.match.deleteMany({
          where: { scheduleVersionId: { in: scheduleVersionIds } },
        });
        await prisma.schedule.updateMany({
          where: { id: { in: scheduleIds } },
          data: { currentOfficialVersionId: null },
        });
        await prisma.scheduleVersion.deleteMany({
          where: { id: { in: scheduleVersionIds } },
        });
      }

      await prisma.schedule.deleteMany({ where: { id: { in: scheduleIds } } });
    }

    // Orphan category matches (if any)
    await prisma.matchParticipation.deleteMany({
      where: { match: { categoryId: { in: categoryIds } } },
    });
    await prisma.match.deleteMany({
      where: { categoryId: { in: categoryIds } },
    });

    const drawings = await prisma.drawing.findMany({
      where: { categoryId: { in: categoryIds } },
      select: { id: true },
    });
    const drawingIds = drawings.map((d) => d.id);

    if (drawingIds.length > 0) {
      const versions = await prisma.drawingVersion.findMany({
        where: { drawingId: { in: drawingIds } },
        select: { id: true },
      });
      const versionIds = versions.map((v) => v.id);

      if (versionIds.length > 0) {
        await prisma.groupMember.deleteMany({
          where: { drawingVersionId: { in: versionIds } },
        });
        await prisma.group.deleteMany({
          where: { drawingVersionId: { in: versionIds } },
        });
        await prisma.drawing.updateMany({
          where: { id: { in: drawingIds } },
          data: { currentOfficialVersionId: null },
        });
        await prisma.drawingVersion.deleteMany({
          where: { id: { in: versionIds } },
        });
      }

      await prisma.drawing.deleteMany({ where: { id: { in: drawingIds } } });
    }
  }

  const teams = await prisma.team.findMany({
    where: { categoryId: { in: categoryIds } },
    select: { id: true },
  });
  const teamIds = teams.map((t) => t.id);

  await prisma.player.deleteMany({ where: { teamId: { in: teamIds } } });
  await prisma.team.deleteMany({ where: { id: { in: teamIds } } });
  await prisma.category.deleteMany({ where: { id: { in: categoryIds } } });

  const galleries = await prisma.gallery.findMany({
    where: { tournamentId },
    select: { id: true },
  });
  const galleryIds = galleries.map((g) => g.id);
  await prisma.galleryItem.deleteMany({
    where: { galleryId: { in: galleryIds } },
  });
  await prisma.gallery.deleteMany({ where: { id: { in: galleryIds } } });

  await prisma.sponsor.deleteMany({ where: { tournamentId } });
  await prisma.court.deleteMany({ where: { tournamentId } });
  await prisma.tournament.delete({ where: { id: tournamentId } });
}

async function seedUsers() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  for (const demoUser of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { email: demoUser.email },
      update: {
        displayName: demoUser.displayName,
        passwordHash,
        isActive: true,
        deletedAt: null,
        deletedBy: null,
      },
      create: {
        email: demoUser.email,
        displayName: demoUser.displayName,
        passwordHash,
        isActive: true,
      },
    });

    const existingGlobalRole = await prisma.userRoleAssignment.findFirst({
      where: {
        userId: user.id,
        role: demoUser.role,
        tournamentId: null,
      },
    });

    if (!existingGlobalRole) {
      await prisma.userRoleAssignment.create({
        data: {
          userId: user.id,
          role: demoUser.role,
          tournamentId: null,
        },
      });
    }
  }
}

async function seed() {
  console.log('Seeding Set Point demo data...');

  await clearDemoTournament();
  await seedUsers();

  const now = new Date();
  const registrationOpenAt = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const registrationCloseAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const startAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const endAt = new Date(now.getTime() + 16 * 24 * 60 * 60 * 1000);

  const tournament = await prisma.tournament.create({
    data: {
      name: DEMO_TOURNAMENT_NAME,
      description:
        'Demo tournament for local development. Safe to reset via prisma db seed.',
      status: TournamentStatus.setup,
      visibility: Visibility.private,
      publishState: PublishState.unpublished,
      registrationOpenAt,
      registrationCloseAt,
      startAt,
      endAt,
    },
  });

  const categoryDefs = [
    {
      name: "Men's Open",
      format: 'doubles_group_playoff',
      teamCount: 8,
      groupCount: 2,
      teamsPerGroup: 4,
    },
    {
      name: 'Mixed Doubles',
      format: 'doubles_group_playoff',
      teamCount: 4,
      groupCount: 2,
      teamsPerGroup: 2,
    },
    {
      name: "Women's Open",
      format: 'doubles_group_playoff',
      teamCount: 4,
      groupCount: 2,
      teamsPerGroup: 2,
    },
  ] as const;

  const categories = [];
  for (const def of categoryDefs) {
    const category = await prisma.category.create({
      data: {
        tournamentId: tournament.id,
        name: def.name,
        format: def.format,
        visibility: Visibility.private,
        publishState: PublishState.unpublished,
        configuration: {
          teamSize: 2,
          groupCount: def.groupCount,
          teamsPerGroup: def.teamsPerGroup,
          scoring: {
            templateId: 'one_set_6_gp_tb5',
            matchFormat: 'best_of_1',
            gamesTo: 6,
            mustWinBy: 2,
            deuceMode: 'golden_point',
            decidingSet: 'full_set',
            tieBreak: { atGames: 5, pointsTo: 7, mustWinBy: 2 },
            matchTieBreak: { atGames: 0, pointsTo: 10, mustWinBy: 2 },
          },
          standings: {
            pointsForWin: 1,
            pointsForLoss: 0,
            tieBreakOrder: [
              'points',
              'wins',
              'head_to_head',
              'set_difference',
              'game_difference',
            ],
          },
        },
      },
    });
    categories.push({ ...category, teamCount: def.teamCount });
  }

  let teamSequence = 1;
  let playerSequence = 1;
  let teamTotal = 0;
  let playerTotal = 0;

  for (const category of categories) {
    for (let i = 1; i <= category.teamCount; i += 1) {
      const team = await prisma.team.create({
        data: {
          categoryId: category.id,
          name: `Team ${String(teamSequence).padStart(2, '0')}`,
          seedRank: i,
          status: TeamStatus.active,
          eligibilityStatus: EligibilityStatus.eligible,
        },
      });
      teamSequence += 1;
      teamTotal += 1;

      for (let p = 1; p <= 2; p += 1) {
        await prisma.player.create({
          data: {
            teamId: team.id,
            displayName: `Player ${String(playerSequence).padStart(2, '0')}`,
            status: PlayerStatus.active,
            replacementFlag: false,
          },
        });
        playerSequence += 1;
        playerTotal += 1;
      }
    }
  }

  const courtLabels = ['C1', 'C2', 'C3', 'C4'];
  for (const [index, label] of courtLabels.entries()) {
    await prisma.court.create({
      data: {
        tournamentId: tournament.id,
        name: `Court ${index + 1}`,
        label,
        status: CourtStatus.available,
      },
    });
  }

  const sponsors = ['Padel Pro Gear', 'Hydrate Co', 'City Sports Arena'];
  for (const [index, name] of sponsors.entries()) {
    await prisma.sponsor.create({
      data: {
        tournamentId: tournament.id,
        name,
        displayOrder: index,
        visibility: Visibility.public,
      },
    });
  }

  await prisma.gallery.create({
    data: {
      tournamentId: tournament.id,
      title: `${DEMO_TOURNAMENT_NAME} Gallery`,
      visibility: Visibility.public,
      galleryItems: {
        create: [
          {
            mediaTitle: 'Venue overview',
            mediaReference: 'seed://demo/venue-overview.jpg',
            displayOrder: 0,
            visibility: Visibility.public,
          },
          {
            mediaTitle: 'Center court',
            mediaReference: 'seed://demo/center-court.jpg',
            displayOrder: 1,
            visibility: Visibility.public,
          },
        ],
      },
    },
  });

  console.log('Seed completed.');
  console.log(
    JSON.stringify(
      {
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        categories: categories.length,
        teams: teamTotal,
        players: playerTotal,
        courts: courtLabels.length,
        sponsors: sponsors.length,
        galleryItems: 2,
        users: DEMO_USERS.map((user) => ({
          email: user.email,
          role: user.role,
          password: DEMO_PASSWORD,
        })),
      },
      null,
      2,
    ),
  );
}

seed()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
