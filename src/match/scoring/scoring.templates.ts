import { ScoringConfig } from './scoring.types';

export const SCORING_TEMPLATES: Record<string, ScoringConfig> = {
  one_set_6_gp_tb5: {
    templateId: 'one_set_6_gp_tb5',
    matchFormat: 'best_of_1',
    gamesTo: 6,
    mustWinBy: 2,
    deuceMode: 'golden_point',
    decidingSet: 'full_set',
    tieBreak: { atGames: 5, pointsTo: 7, mustWinBy: 2 },
    matchTieBreak: { atGames: 0, pointsTo: 10, mustWinBy: 2 },
  },
  one_set_4_gp_tb3: {
    templateId: 'one_set_4_gp_tb3',
    matchFormat: 'best_of_1',
    gamesTo: 4,
    mustWinBy: 2,
    deuceMode: 'golden_point',
    decidingSet: 'full_set',
    tieBreak: { atGames: 3, pointsTo: 7, mustWinBy: 2 },
    matchTieBreak: { atGames: 0, pointsTo: 10, mustWinBy: 2 },
  },
  best_of_3_gp_full: {
    templateId: 'best_of_3_gp_full',
    matchFormat: 'best_of_3',
    gamesTo: 6,
    mustWinBy: 2,
    deuceMode: 'golden_point',
    decidingSet: 'full_set',
    tieBreak: { atGames: 6, pointsTo: 7, mustWinBy: 2 },
    matchTieBreak: { atGames: 0, pointsTo: 10, mustWinBy: 2 },
  },
  best_of_3_gp_match_tb: {
    templateId: 'best_of_3_gp_match_tb',
    matchFormat: 'best_of_3',
    gamesTo: 6,
    mustWinBy: 2,
    deuceMode: 'golden_point',
    decidingSet: 'match_tiebreak',
    tieBreak: { atGames: 6, pointsTo: 7, mustWinBy: 2 },
    matchTieBreak: { atGames: 0, pointsTo: 10, mustWinBy: 2 },
  },
  best_of_3_advantage_full: {
    templateId: 'best_of_3_advantage_full',
    matchFormat: 'best_of_3',
    gamesTo: 6,
    mustWinBy: 2,
    deuceMode: 'advantage',
    decidingSet: 'full_set',
    tieBreak: { atGames: 6, pointsTo: 7, mustWinBy: 2 },
    matchTieBreak: { atGames: 0, pointsTo: 10, mustWinBy: 2 },
  },
};

export const DEFAULT_SCORING_TEMPLATE_ID = 'one_set_6_gp_tb5';

export function listScoringTemplates(): ScoringConfig[] {
  return Object.values(SCORING_TEMPLATES);
}

export function getScoringTemplate(templateId: string): ScoringConfig | null {
  return SCORING_TEMPLATES[templateId] ?? null;
}
