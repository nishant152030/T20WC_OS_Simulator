/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum PlayerRole {
  BOWLER = 'Bowler',
  BATSMAN = 'Batsman',
  FIELDER = 'Fielder',
  WICKET_KEEPER = 'Wicket Keeper'
}

export enum SchedulingPolicy {
  ROUND_ROBIN = 'Round Robin (Bowlers)',
  SJF = 'Shortest Job First (Tail-enders)',
  PRIORITY = 'Priority (Death Overs)'
}

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  stats: {
    runs?: number;
    balls?: number;
    wickets?: number;
    overs?: number;
    stayDuration?: number; // For SJF
    isDeathOverSpecialist?: boolean; // For Priority
    readyTime?: number; // Timestamp when player was ready in dugout
    startTime?: number; // Timestamp when player started batting
    originalOrder?: number;
  };
}

export interface AnalysisData {
  playerName: string;
  waitTime: number;
  stayDuration: number;
  policy: SchedulingPolicy;
}

export interface BallLog {
  over: number;
  ball: number;
  bowler: string;
  batsman: string;
  result: string;
  score: number;
  wickets: number;
  timestamp: number;
}

export interface GanttData {
  timestamp: number;
  player: string;
  resource: string;
  duration: number;
  label?: string;
}
