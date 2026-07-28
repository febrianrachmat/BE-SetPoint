/**
 * Phase 0.5 — Full Tournament Simulation (API validation).
 *
 * Drives the complete domain chain over HTTP against a running server:
 *   Tournament -> Category -> Teams -> Drawing -> Schedule -> Match/Scoring
 *   -> Standing -> Qualification -> Playoff -> Champion
 *
 * Two scenarios are exercised:
 *   A. competitionMode=group_then_knockout (2 groups x 4 teams, qualifyTop 2)
 *   B. competitionMode=knockout_only       (5 teams -> bracket 8 with byes)
 *
 * Run: npm run simulate            (both scenarios)
 *      npm run simulate -- group    (scenario A only)
 *      npm run simulate -- cup      (scenario B only)
 *
 * Env overrides: SIM_BASE_URL, SIM_ADMIN_EMAIL, SIM_ADMIN_PASSWORD.
 *
 * Results are deterministic: teams are ranked by creation order and the
 * stronger team always wins, so standings and the champion are predictable.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SCORING_TEMPLATE = 'one_set_4_gp_tb3';
const MAX_POINTS_PER_MATCH = 200;
const MAX_BRACKET_ROUNDS = 8;

type Json = Record<string, unknown>;

type MatchView = {
  id: string;
  status: string;
  courtId: string | null;
  groupId: string | null;
  playoffId: string | null;
  bracketPosition: string | null;
  scoreRepresentation: {
    phase?: string;
    winnerSide?: string | null;
    setsWon?: { A: number; B: number };
  } | null;
  participations: Array<{
    sideLabel: string;
    teamId: string;
    team?: { id: string; name: string };
  }>;
};

type StandingView = {
  teamId: string;
  groupId: string | null;
  rankPosition: number | null;
  matchesPlayed: number;
  wins: number;
  losses: number;
  points: number;
  qualificationStatus: string;
  tieBreakNotes: string | null;
};

type BracketView = {
  id: string;
  versionNumber: number;
  versionStatus: string;
  structureRepresentation: Json | null;
  matches: MatchView[];
};

type Ctx = {
  scenario: string;
  tournamentId: string;
  categoryId: string;
  /** teamId -> strength rank; lower wins every match */
  strength: Map<string, number>;
  teamNames: Map<string, string>;
};

// --- environment ------------------------------------------------------------

function loadEnvFile() {
  try {
    const raw = readFileSync(resolve(__dirname, '..', '.env'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
      if (!match) {
        continue;
      }
      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) {
        continue;
      }
      const quoted = /^(['"])(.*)\1$/.exec(rawValue);
      process.env[key] = quoted ? quoted[2] : rawValue;
    }
  } catch {
    // .env is optional when variables are already exported
  }
}

loadEnvFile();

const BASE_URL = (process.env.SIM_BASE_URL ?? 'http://localhost:3000/api/v1').replace(
  /\/+$/,
  '',
);
const ADMIN_EMAIL = process.env.SIM_ADMIN_EMAIL ?? 'admin@setpoint.local';
const ADMIN_PASSWORD = process.env.SIM_ADMIN_PASSWORD ?? 'Password123!';

// --- reporting --------------------------------------------------------------

const stats = {
  requests: 0,
  checks: 0,
  gates: 0,
  points: 0,
  matches: 0,
};

class SimulationError extends Error {}

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: string[],
  ) {
    super(message);
  }
}

function section(title: string) {
  console.log(`\n${'='.repeat(72)}\n${title}\n${'='.repeat(72)}`);
}

function step(label: string) {
  console.log(`\n-- ${label}`);
}

function check(label: string, condition: boolean, detail?: string) {
  if (!condition) {
    throw new SimulationError(detail ? `${label} — ${detail}` : label);
  }
  stats.checks += 1;
  console.log(`   [ok]   ${label}`);
}

function gate(label: string) {
  stats.gates += 1;
  console.log(`   [gate] ${label}`);
}

function note(label: string) {
  console.log(`   [note] ${label}`);
}

// --- HTTP client ------------------------------------------------------------

let token: string | null = null;

async function raw(method: string, path: string, body?: unknown) {
  stats.requests += 1;
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  return { status: response.status, payload, text };
}

async function api<T = any>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const { status, payload, text } = await raw(method, path, body);
  if (status >= 400 || payload?.success === false) {
    const error = payload?.error ?? {};
    throw new ApiError(
      status,
      String(error.code ?? 'UNKNOWN'),
      String(error.message ?? text.slice(0, 300) ?? 'request failed'),
      Array.isArray(error.details) ? error.details : undefined,
    );
  }
  return payload?.data as T;
}

/** Asserts a documented gate: the call must be rejected, not silently allowed. */
async function expectReject(
  label: string,
  method: string,
  path: string,
  body?: unknown,
  acceptedStatuses: number[] = [400],
) {
  try {
    await api(method, path, body);
  } catch (error) {
    if (error instanceof ApiError && acceptedStatuses.includes(error.status)) {
      gate(`${label} -> ${error.status} ${truncate(error.message, 90)}`);
      return;
    }
    throw error;
  }
  throw new SimulationError(
    `${label}: expected rejection (${acceptedStatuses.join('/')}) but the call succeeded`,
  );
}

function truncate(value: string, max: number) {
  return value.length <= max ? value : `${value.slice(0, max - 3)}...`;
}

// --- domain helpers ---------------------------------------------------------

function categoryBase(ctx: Ctx) {
  return `/tournaments/${ctx.tournamentId}/categories/${ctx.categoryId}`;
}

async function login() {
  const data = await api<{ accessToken: string; user: { email: string } }>(
    'POST',
    '/auth/login',
    { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  );
  token = data.accessToken;
  check(`authenticated as ${data.user.email}`, Boolean(token));
}

async function createTournament(name: string) {
  const tournament = await api<{ id: string; status: string }>(
    'POST',
    '/tournaments',
    { name, visibility: 'private' },
  );
  check(`tournament created as draft (${name})`, tournament.status === 'draft');
  return tournament.id;
}

async function provisionCourts(tournamentId: string, count: number) {
  const created: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const court = await api<{ id: string; displayOrder: number }>(
      'POST',
      `/tournaments/${tournamentId}/courts`,
      {
        name: `Sim Court ${index + 1}`,
        label: `SC${index + 1}`,
        availabilityNotes: 'created by phase 0.5 simulation',
      },
    );
    created.push(court.id);
  }

  await expectReject(
    'duplicate court label',
    'POST',
    `/tournaments/${tournamentId}/courts`,
    { name: 'Duplicate', label: 'sc1' },
    [409],
  );

  const listed = await api<{ items: Array<{ id: string }>; availableCount: number }>(
    'GET',
    `/tournaments/${tournamentId}/courts`,
  );
  check(
    `${count} courts created via API and available`,
    listed.items.length === count && listed.availableCount === count,
    `got ${listed.items.length} items / ${listed.availableCount} available`,
  );

  const reversed = [...created].reverse();
  const reordered = await api<{ items: Array<{ id: string; displayOrder: number }> }>(
    'POST',
    `/tournaments/${tournamentId}/courts/reorder`,
    { items: reversed.map((courtId) => ({ courtId })) },
  );
  check(
    'reorder applies contiguous displayOrder in listed sequence',
    reordered.items.every(
      (court, index) =>
        court.id === reversed[index] && court.displayOrder === index,
    ),
  );

  await expectReject(
    'reorder with a partial court list',
    'POST',
    `/tournaments/${tournamentId}/courts/reorder`,
    { items: [{ courtId: created[0] }] },
  );

  return created;
}

/** Court availability is an operational lever: it must work while Live. */
async function exerciseCourtAvailability(tournamentId: string, courtId: string) {
  const base = `/tournaments/${tournamentId}/courts/${courtId}`;

  const disabled = await api<{ status: string; availabilityNotes: string | null }>(
    'POST',
    `${base}/disable`,
    { status: 'maintenance', reason: 'net replacement' },
  );
  check(
    'court can be put into maintenance with a reason',
    disabled.status === 'maintenance' &&
      disabled.availabilityNotes === 'net replacement',
  );

  await expectReject('disable an already disabled court', 'POST', `${base}/disable`, {
    status: 'maintenance',
  });
  await expectReject('delete a court referenced by a Schedule', 'DELETE', base);

  const enabled = await api<{ status: string; availabilityNotes: string | null }>(
    'POST',
    `${base}/enable`,
  );
  check(
    'court returns to the available pool and notes are cleared',
    enabled.status === 'available' && enabled.availabilityNotes === null,
  );
}

async function createCategory(
  tournamentId: string,
  body: { name: string; format: string; configuration: Json },
) {
  const category = await api<{ id: string; configuration: Json }>(
    'POST',
    `/tournaments/${tournamentId}/categories`,
    body,
  );
  const mode = (category.configuration as any)?.competitionMode;
  check(
    `category created with competitionMode=${mode}`,
    mode === (body.configuration as any).competitionMode,
  );
  return category.id;
}

async function registerTeams(
  ctx: Omit<Ctx, 'strength' | 'teamNames'>,
  count: number,
  options: { assignSeedRank?: boolean } = {},
) {
  const strength = new Map<string, number>();
  const teamNames = new Map<string, string>();

  for (let index = 0; index < count; index += 1) {
    const label = String(index + 1).padStart(2, '0');
    const name = `Sim Team ${label}`;
    const team = await api<{ id: string; eligibilityStatus: string }>(
      'POST',
      `/tournaments/${ctx.tournamentId}/categories/${ctx.categoryId}/teams`,
      {
        name,
        players: [
          { displayName: `Player ${label}A` },
          { displayName: `Player ${label}B` },
        ],
      },
    );
    if (team.eligibilityStatus !== 'eligible') {
      throw new SimulationError(
        `${name} registered as ${team.eligibilityStatus}; expected eligible`,
      );
    }
    if (options.assignSeedRank) {
      await api(
        'PATCH',
        `/tournaments/${ctx.tournamentId}/categories/${ctx.categoryId}/teams/${team.id}`,
        { seedRank: index + 1 },
      );
    }
    strength.set(team.id, index);
    teamNames.set(team.id, name);
  }

  check(
    `${count} teams registered and eligible${
      options.assignSeedRank ? ' with seedRank 1..N' : ''
    }`,
    strength.size === count,
  );

  return { ...ctx, strength, teamNames } as Ctx;
}

function sideTeams(match: MatchView) {
  const sides: Record<string, string> = {};
  for (const participation of match.participations) {
    sides[participation.sideLabel] = participation.teamId;
  }
  if (!sides.A || !sides.B) {
    throw new SimulationError(
      `match ${match.id} is missing a participant (A=${sides.A}, B=${sides.B})`,
    );
  }
  return sides;
}

function strongerSide(ctx: Ctx, sides: Record<string, string>) {
  const rankA = ctx.strength.get(sides.A);
  const rankB = ctx.strength.get(sides.B);
  if (rankA === undefined || rankB === undefined) {
    throw new SimulationError('match contains a team outside the simulation');
  }
  return rankA < rankB ? 'A' : 'B';
}

async function playMatch(
  ctx: Ctx,
  matchId: string,
  options: { probeGates?: boolean } = {},
) {
  const base = `${categoryBase(ctx)}/matches/${matchId}`;
  const match = await api<MatchView>('GET', base);
  const sides = sideTeams(match);
  const winnerSide = strongerSide(ctx, sides);
  const winnerTeamId = sides[winnerSide];

  if (options.probeGates) {
    await expectReject('start before warm_up', 'POST', `${base}/start`);
  }

  await api<MatchView>('POST', `${base}/warm-up`);
  await api<MatchView>('POST', `${base}/start`);

  if (options.probeGates) {
    await expectReject('finish before score completed', 'POST', `${base}/finish`);
    await expectReject('verify before finish', 'POST', `${base}/verify`);
  }

  let points = 0;
  let completed = false;
  while (points < MAX_POINTS_PER_MATCH) {
    const updated = await api<MatchView>('POST', `${base}/score/point`, {
      side: winnerSide,
    });
    points += 1;
    if (updated.scoreRepresentation?.phase === 'completed') {
      completed = true;
      if (updated.scoreRepresentation.winnerSide !== winnerSide) {
        throw new SimulationError(
          `match ${matchId}: engine winnerSide=${updated.scoreRepresentation.winnerSide}, expected ${winnerSide}`,
        );
      }
      break;
    }
  }
  if (!completed) {
    throw new SimulationError(
      `match ${matchId} did not complete within ${MAX_POINTS_PER_MATCH} points`,
    );
  }

  const finished = await api<MatchView>('POST', `${base}/finish`);
  if (finished.status !== 'finished') {
    throw new SimulationError(
      `match ${matchId} status after finish is ${finished.status}`,
    );
  }

  const verified = await api<MatchView>('POST', `${base}/verify`);
  if (verified.status !== 'verified') {
    throw new SimulationError(
      `match ${matchId} status after verify is ${verified.status}`,
    );
  }

  stats.matches += 1;
  stats.points += points;
  return { winnerTeamId, points };
}

async function playBracket(ctx: Ctx) {
  const base = `${categoryBase(ctx)}/playoff`;
  let played = 0;

  for (let round = 0; round < MAX_BRACKET_ROUNDS; round += 1) {
    const bracket = await api<BracketView>('GET', `${base}/official`);
    const pending = bracket.matches.filter((match) => match.status !== 'verified');
    if (pending.length === 0) {
      return played;
    }
    for (const match of pending) {
      const result = await playMatch(ctx, match.id);
      played += 1;
      console.log(
        `   [play] ${match.bracketPosition ?? 'match'} -> ${
          ctx.teamNames.get(result.winnerTeamId) ?? result.winnerTeamId
        } (${result.points} points)`,
      );
    }
  }

  throw new SimulationError(
    `bracket did not resolve within ${MAX_BRACKET_ROUNDS} advancement rounds`,
  );
}

async function assertChampion(ctx: Ctx, expectedTeamId: string) {
  const champion = await api<{
    winningTeamId: string;
    declarationStatus: string;
    winningTeam?: { name: string };
  }>('GET', `${categoryBase(ctx)}/playoff/champion`);

  check(
    `champion declared: ${champion.winningTeam?.name ?? champion.winningTeamId}`,
    champion.declarationStatus === 'declared',
  );
  check(
    'champion is the strongest team (deterministic outcome)',
    champion.winningTeamId === expectedTeamId,
    `got ${ctx.teamNames.get(champion.winningTeamId)}, expected ${ctx.teamNames.get(
      expectedTeamId,
    )}`,
  );
  return champion;
}

/** Seeded cup integrity: the two top seeds must only meet in the Final. */
async function assertFinalPairing(ctx: Ctx, expectedTeamIds: string[]) {
  const bracket = await api<BracketView>(
    'GET',
    `${categoryBase(ctx)}/playoff/official`,
  );
  const final = bracket.matches.find((match) => match.bracketPosition === 'F');
  if (!final) {
    throw new SimulationError('official bracket has no Final match');
  }
  const actual = final.participations.map((p) => p.teamId).sort();
  check(
    `final contested by ${expectedTeamIds
      .map((id) => ctx.teamNames.get(id))
      .join(' vs ')}`,
    JSON.stringify(actual) === JSON.stringify([...expectedTeamIds].sort()),
    `got ${actual.map((id) => ctx.teamNames.get(id)).join(' vs ')}`,
  );
}

function strongestTeamId(ctx: Ctx) {
  let best: string | null = null;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const [teamId, rank] of ctx.strength) {
    if (rank < bestRank) {
      bestRank = rank;
      best = teamId;
    }
  }
  if (!best) {
    throw new SimulationError('no teams registered');
  }
  return best;
}

// --- scenario A: group_then_knockout ---------------------------------------

async function scenarioGroupThenKnockout() {
  const stamp = Date.now();
  section('Scenario A — group_then_knockout (2 groups x 4 teams, qualifyTop 2)');

  step('Tournament + Courts + Category + Teams');
  const tournamentId = await createTournament(`SIM Group ${stamp}`);
  const courtIds = await provisionCourts(tournamentId, 2);
  await api('POST', `/tournaments/${tournamentId}/setup`);

  const categoryId = await createCategory(tournamentId, {
    name: 'Simulation Open Doubles',
    format: 'doubles_group_playoff',
    configuration: {
      competitionMode: 'group_then_knockout',
      teamSize: 2,
      groupCount: 2,
      teamsPerGroup: 4,
      scoring: { templateId: SCORING_TEMPLATE },
      standings: { pointsForWin: 1, pointsForLoss: 0, qualifyTop: 2 },
    },
  });

  let ctx: Ctx = {
    scenario: 'group_then_knockout',
    tournamentId,
    categoryId,
    strength: new Map(),
    teamNames: new Map(),
  };
  ctx = await registerTeams(ctx, 8);

  const published = await api<{ status: string }>(
    'POST',
    `/tournaments/${tournamentId}/publish`,
  );
  check('tournament published', published.status === 'published');

  step('Drawing — generate / review / publish / lock');
  const version = await api<{ id: string; versionStatus: string }>(
    'POST',
    `${categoryBase(ctx)}/drawing/generate`,
    { placementMode: 'random', drawingSeed: `phase05-group-${stamp}` },
  );
  check('drawing candidate version created', version.versionStatus === 'candidate');

  await expectReject(
    'drawing publish before review approval (REV-02)',
    'POST',
    `${categoryBase(ctx)}/drawing/versions/${version.id}/publish`,
  );

  await api('POST', `${categoryBase(ctx)}/drawing/versions/${version.id}/review`, {
    outcome: 'approved',
    note: 'phase 0.5 simulation',
  });
  await api('POST', `${categoryBase(ctx)}/drawing/versions/${version.id}/publish`);

  await expectReject(
    'schedule generate before Drawing lock (Schedule Ready)',
    'POST',
    `${categoryBase(ctx)}/schedule/generate`,
    {},
  );

  await api('POST', `${categoryBase(ctx)}/drawing/lock`);

  const official = await api<any>('GET', `${categoryBase(ctx)}/drawing/official`);
  const groups: any[] = official.groups ?? official.version?.groups ?? [];
  check('official drawing has 2 groups', groups.length === 2, `got ${groups.length}`);
  check(
    'each group has 4 members',
    groups.every((group) => (group.members?.length ?? 0) === 4),
    groups.map((group) => group.members?.length).join('/'),
  );

  step('Schedule — generate / review / publish / lock');
  const scheduleVersion = await api<{ id: string; versionStatus: string }>(
    'POST',
    `${categoryBase(ctx)}/schedule/generate`,
    { matchDurationMinutes: 60 },
  );
  check(
    'schedule candidate version created',
    scheduleVersion.versionStatus === 'candidate',
  );

  await api(
    'POST',
    `${categoryBase(ctx)}/schedule/versions/${scheduleVersion.id}/review`,
    { outcome: 'approved' },
  );
  await api(
    'POST',
    `${categoryBase(ctx)}/schedule/versions/${scheduleVersion.id}/publish`,
  );
  await api('POST', `${categoryBase(ctx)}/schedule/lock`);

  const matchList = await api<{ items: MatchView[]; meta?: Json; total?: number }>(
    'GET',
    `${categoryBase(ctx)}/matches?pageSize=200`,
  );
  const groupMatches = matchList.items;
  check(
    'round robin produced 12 matches (2 groups x 6)',
    groupMatches.length === 12,
    `got ${groupMatches.length}`,
  );
  check(
    'every group match has a court assigned',
    groupMatches.every((match) => Boolean(match.courtId)),
  );

  step('Go Live + play group stage');
  await expectReject(
    'match warm-up before Tournament go-live (MATCH-05)',
    'POST',
    `${categoryBase(ctx)}/matches/${groupMatches[0].id}/warm-up`,
  );

  const live = await api<{ status: string }>(
    'POST',
    `/tournaments/${tournamentId}/go-live`,
  );
  check('tournament live', live.status === 'live');

  step('Court availability while Live');
  await exerciseCourtAvailability(tournamentId, courtIds[0]);

  step('Play group stage');
  for (const [index, match] of groupMatches.entries()) {
    await playMatch(ctx, match.id, { probeGates: index === 0 });
  }
  check('all 12 group matches verified', stats.matches >= 12);

  step('Standing + Qualification');
  const standings = await api<{ items: StandingView[] }>(
    'GET',
    `${categoryBase(ctx)}/standings`,
  );
  check('8 standing rows', standings.items.length === 8, `got ${standings.items.length}`);
  check(
    'every team played 3 group matches',
    standings.items.every((row) => row.matchesPlayed === 3),
  );
  check(
    'no unresolved tie flags',
    standings.items.every((row) => !row.tieBreakNotes),
    standings.items.map((row) => row.tieBreakNotes).filter(Boolean).join(', '),
  );

  const byGroup = new Map<string, StandingView[]>();
  for (const row of standings.items) {
    const key = row.groupId ?? 'none';
    byGroup.set(key, [...(byGroup.get(key) ?? []), row]);
  }
  check('standings split across 2 groups', byGroup.size === 2);

  for (const [groupId, rows] of byGroup) {
    const ranked = [...rows].sort(
      (a, b) => (a.rankPosition ?? 99) - (b.rankPosition ?? 99),
    );
    check(
      `group ${groupId.slice(0, 8)} ranks are 1..4 distinct`,
      ranked.every((row, index) => row.rankPosition === index + 1),
      ranked.map((row) => row.rankPosition).join(','),
    );
    check(
      `group ${groupId.slice(0, 8)} rank order matches team strength`,
      ranked.every((row, index) => {
        const next = ranked[index + 1];
        if (!next) {
          return true;
        }
        return (
          (ctx.strength.get(row.teamId) ?? 0) < (ctx.strength.get(next.teamId) ?? 0)
        );
      }),
      ranked.map((row) => ctx.teamNames.get(row.teamId)).join(' > '),
    );
    check(
      `group ${groupId.slice(0, 8)} points equal wins (pointsForWin=1)`,
      ranked.every((row) => row.points === row.wins),
    );
  }

  const qualified = await api<{ items: StandingView[] }>(
    'GET',
    `${categoryBase(ctx)}/standings/qualified`,
  );
  check(
    '4 teams qualified (2 per group)',
    qualified.items.length === 4,
    `got ${qualified.items.length}`,
  );
  check(
    'qualified teams are ranked 1 or 2',
    qualified.items.every((row) => (row.rankPosition ?? 99) <= 2),
  );

  step('Playoff — generate / review / publish / lock');
  const bracket = await api<BracketView>(
    'POST',
    `${categoryBase(ctx)}/playoff/generate`,
  );
  const bracketDetail = await api<BracketView>(
    'GET',
    `${categoryBase(ctx)}/playoff/brackets/${bracket.id}`,
  );
  check(
    'bracket seeded 4 qualified teams into 2 semi-finals',
    bracketDetail.matches.length === 2,
    `got ${bracketDetail.matches.length}`,
  );

  await expectReject(
    'playoff publish before review approval',
    'POST',
    `${categoryBase(ctx)}/playoff/brackets/${bracket.id}/publish`,
  );

  await api('POST', `${categoryBase(ctx)}/playoff/brackets/${bracket.id}/review`, {
    outcome: 'approved',
  });
  await api('POST', `${categoryBase(ctx)}/playoff/brackets/${bracket.id}/publish`);
  await api('POST', `${categoryBase(ctx)}/playoff/lock`);

  step('Playoff progression + Champion');
  const playoffMatches = await playBracket(ctx);
  check(
    'playoff resolved in 3 matches (2 semi-finals + final)',
    playoffMatches === 3,
    `got ${playoffMatches}`,
  );

  const champion = await assertChampion(ctx, strongestTeamId(ctx));

  step('Tournament lifecycle close-out');
  const finished = await api<{ status: string }>(
    'POST',
    `/tournaments/${tournamentId}/finish`,
  );
  check('tournament finished', finished.status === 'finished');
  const archived = await api<{ status: string }>(
    'POST',
    `/tournaments/${tournamentId}/archive`,
  );
  check('tournament archived', archived.status === 'archived');

  return {
    scenario: 'group_then_knockout',
    tournamentId,
    categoryId,
    champion: champion.winningTeam?.name ?? champion.winningTeamId,
  };
}

// --- scenario B: knockout_only ---------------------------------------------

async function scenarioKnockoutOnly() {
  const stamp = Date.now();
  section('Scenario B — knockout_only (5 teams -> bracket 8 with byes)');

  step('Tournament + Category + Teams');
  const tournamentId = await createTournament(`SIM Cup ${stamp}`);
  await api('POST', `/tournaments/${tournamentId}/setup`);

  const categoryId = await createCategory(tournamentId, {
    name: 'Simulation Cup',
    format: 'doubles_cup',
    configuration: {
      competitionMode: 'knockout_only',
      teamSize: 2,
      scoring: { templateId: SCORING_TEMPLATE },
    },
  });

  let ctx: Ctx = {
    scenario: 'knockout_only',
    tournamentId,
    categoryId,
    strength: new Map(),
    teamNames: new Map(),
  };
  ctx = await registerTeams(ctx, 5, { assignSeedRank: true });

  const published = await api<{ status: string }>(
    'POST',
    `/tournaments/${tournamentId}/publish`,
  );
  check('tournament published', published.status === 'published');

  step('Group-stage modules must be rejected for knockout_only');
  await expectReject('drawing generate', 'POST', `${categoryBase(ctx)}/drawing/generate`, {
    placementMode: 'random',
  });
  await expectReject('schedule generate', 'POST', `${categoryBase(ctx)}/schedule/generate`, {});
  await expectReject(
    'standing recalculate',
    'POST',
    `${categoryBase(ctx)}/standings/recalculate`,
    {},
  );

  step('Playoff — generate / review / publish / lock');
  const bracket = await api<BracketView>(
    'POST',
    `${categoryBase(ctx)}/playoff/generate`,
  );
  const detail = await api<BracketView>(
    'GET',
    `${categoryBase(ctx)}/playoff/brackets/${bracket.id}`,
  );
  const bracketSize = (detail.structureRepresentation as any)?.bracketSize;
  check('bracket padded to size 8', bracketSize === 8, `got ${bracketSize}`);
  note(
    `materialized at generate: ${detail.matches
      .map((match) => match.bracketPosition)
      .join(', ')}`,
  );

  await api('POST', `${categoryBase(ctx)}/playoff/brackets/${bracket.id}/review`, {
    outcome: 'approved',
  });
  await api('POST', `${categoryBase(ctx)}/playoff/brackets/${bracket.id}/publish`);
  await api('POST', `${categoryBase(ctx)}/playoff/lock`);

  const live = await api<{ status: string }>(
    'POST',
    `/tournaments/${tournamentId}/go-live`,
  );
  check('tournament live', live.status === 'live');

  step('Playoff progression + Champion');
  const played = await playBracket(ctx);
  check(
    'cup resolved in 4 matches (1 QF + 2 SF + final)',
    played === 4,
    `got ${played}`,
  );

  const seedOne = [...ctx.strength.entries()].find(([, rank]) => rank === 0)![0];
  const seedTwo = [...ctx.strength.entries()].find(([, rank]) => rank === 1)![0];
  await assertFinalPairing(ctx, [seedOne, seedTwo]);

  const champion = await assertChampion(ctx, strongestTeamId(ctx));

  step('Tournament lifecycle close-out');
  await api('POST', `/tournaments/${tournamentId}/finish`);
  const archived = await api<{ status: string }>(
    'POST',
    `/tournaments/${tournamentId}/archive`,
  );
  check('tournament finished and archived', archived.status === 'archived');

  return {
    scenario: 'knockout_only',
    tournamentId,
    categoryId,
    champion: champion.winningTeam?.name ?? champion.winningTeamId,
  };
}

// --- entrypoint -------------------------------------------------------------

async function main() {
  const requested = process.argv.slice(2).filter((arg) => !arg.startsWith('-'));
  const runGroup = requested.length === 0 || requested.includes('group');
  const runCup = requested.length === 0 || requested.includes('cup');

  section('Phase 0.5 — Full Tournament Simulation');
  console.log(`   base url : ${BASE_URL}`);
  console.log(`   admin    : ${ADMIN_EMAIL}`);
  console.log(`   scenarios: ${[runGroup && 'group', runCup && 'cup'].filter(Boolean).join(', ')}`);

  const health = await api<{ status?: string; database?: string }>('GET', '/health');
  check(
    `server healthy (${health.status ?? 'ok'} / db ${health.database ?? 'unknown'})`,
    true,
  );

  await login();

  const startedAt = Date.now();
  const results: Array<{ scenario: string; champion: string }> = [];
  if (runGroup) {
    results.push(await scenarioGroupThenKnockout());
  }
  if (runCup) {
    results.push(await scenarioKnockoutOnly());
  }
  const durationMs = Date.now() - startedAt;

  section('Simulation summary');
  for (const result of results) {
    console.log(`   ${result.scenario.padEnd(22)} champion: ${result.champion}`);
  }
  console.log(
    [
      '',
      `   assertions      : ${stats.checks}`,
      `   gate rejections : ${stats.gates}`,
      `   matches played  : ${stats.matches}`,
      `   points scored   : ${stats.points}`,
      `   http requests   : ${stats.requests}`,
      `   duration        : ${(durationMs / 1000).toFixed(1)}s`,
      '',
      '   RESULT: PASS',
    ].join('\n'),
  );
}

main()
  .catch((error) => {
    console.error('\n   RESULT: FAIL');
    if (error instanceof ApiError) {
      console.error(`   HTTP ${error.status} ${error.code}: ${error.message}`);
      if (error.details?.length) {
        console.error(`   details: ${error.details.join(' | ')}`);
      }
    } else if (error instanceof SimulationError) {
      console.error(`   assertion failed: ${error.message}`);
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  });
