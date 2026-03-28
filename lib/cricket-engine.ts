/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Mutex, Semaphore, ConditionVariable } from './os-primitives';
import { Player, PlayerRole, BallLog, GanttData, SchedulingPolicy, AnalysisData } from '../types';

export class CricketEngine {
  // Shared Resources (Critical Sections)
  private pitchMutex = new Mutex();
  private scoreMutex = new Mutex();
  private creaseSemaphore = new Semaphore(2);
  private ballInAirCV = new ConditionVariable();

  // Global State
  private globalScore = 0;
  private globalWickets = 0;
  private currentOver = 0;
  private currentBall = 0;
  private matchIntensity = 0; // 0 to 100
  private ballInAir = false;

  // Thread Pools
  private bowlers: Player[] = [];
  private batsmen: Player[] = [];
  private fielders: Player[] = [];
  private activeBatsmen: Player[] = [];
  private currentBowler: Player | null = null;
  private fielderThreadsActive = 0;

  // Analysis Data
  private analysisData: AnalysisData[] = [];

  // Resources for Deadlock Simulation
  private end1Occupied = false;
  private end2Occupied = false;

  // Logs
  private logs: BallLog[] = [];
  private ganttLogs: GanttData[] = [];
  private timestamp = 0;

  // Scheduling Policy
  private policy: SchedulingPolicy = SchedulingPolicy.ROUND_ROBIN;

  constructor(bowlers: Player[], batsmen: Player[], fielders: Player[]) {
    this.bowlers = bowlers;
    this.batsmen = batsmen;
    this.fielders = fielders;
    
    // Initially, all batsmen are in the "dugout" (ready state)
    this.batsmen.forEach(b => {
      b.stats.readyTime = 0;
    });

    // Acquire crease semaphore for the first two batsmen
    this.creaseSemaphore.wait(); // Striker
    this.creaseSemaphore.wait(); // Non-striker
    
    this.activeBatsmen = this.batsmen.slice(0, 2);
    this.activeBatsmen.forEach(b => {
      b.stats.startTime = 0;
    });

    this.currentBowler = this.bowlers[0];
    
    // Initialize 10 Fielder Threads (Passive)
    this.initializeFielderThreads();
  }

  private async initializeFielderThreads() {
    for (let i = 0; i < 10; i++) {
      this.spawnFielderThread(i);
    }
  }

  private async spawnFielderThread(id: number) {
    while (true) {
      // Fielder thread "sleeps" until BALL_HIT signal
      await this.ballInAirCV.wait();
      
      // Critical Section: Fielder processing the ball
      this.fielderThreadsActive++;
      this.ganttLogs.push({
        timestamp: this.timestamp,
        player: `Fielder ${id + 1}`,
        resource: 'Field (Active)',
        duration: 1
      });
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 10));
      this.fielderThreadsActive--;
    }
  }

  setPolicy(policy: SchedulingPolicy) {
    this.policy = policy;
  }

  getLogs() {
    return this.logs;
  }

  getGanttLogs() {
    return this.ganttLogs;
  }

  getAnalysisData() {
    return this.analysisData;
  }

  getScore() {
    return { 
      score: this.globalScore, 
      wickets: this.globalWickets, 
      over: this.currentOver, 
      ball: this.currentBall,
      creaseCapacity: this.creaseSemaphore.getCount()
    };
  }

  // Scheduler: Manage the "Over" transitions
  private async scheduleNextBowler() {
    if (this.currentBall === 0 && this.currentOver > 0) {
      // Context Switch: Save stats and load next bowler
      this.ganttLogs.push({
        timestamp: this.timestamp,
        player: 'Kernel',
        resource: 'Context Switch (Over)',
        duration: 1
      });

      // Priority Scheduling: If Match_Intensity is high (Death Overs), 
      // the Death Over Specialist thread is given highest priority for CPU time.
      const isDeathOver = this.currentOver >= 18;
      if (isDeathOver) {
        const specialist = this.bowlers.find(b => b.stats.isDeathOverSpecialist);
        if (specialist) {
          this.currentBowler = specialist;
          return;
        }
      }

      // Round Robin: Bowlers rotated every 6 balls (Quantum = 6)
      const nextIndex = (this.bowlers.indexOf(this.currentBowler!) + 1) % this.bowlers.length;
      this.currentBowler = this.bowlers[nextIndex];
    }
  }

  // Shortest Job First (SJF): Prioritize Tail-ender batsmen
  private async scheduleNextBatsman() {
    if (this.globalWickets < this.batsmen.length - 2) {
      const remainingBatsmen = this.batsmen.slice(this.globalWickets + 2);
      
      if (this.policy === SchedulingPolicy.SJF) {
        // SJF: Prioritize batsmen with short stay durations
        remainingBatsmen.sort((a, b) => (a.stats.stayDuration || 0) - (b.stats.stayDuration || 0));
      }
      
      const next = remainingBatsmen[0];
      if (next) {
        // Wait for crease semaphore (Capacity 2)
        await this.creaseSemaphore.wait();
        next.stats.startTime = this.timestamp;
        
        // Record analysis data
        this.analysisData.push({
          playerName: next.name,
          waitTime: (next.stats.startTime || 0) - (next.stats.readyTime || 0),
          stayDuration: next.stats.stayDuration || 0,
          policy: this.policy
        });
      }
      return next;
    }
    return null;
  }

  // Simulation Step: Bowler Thread "writes" data to Pitch
  async bowlBall(): Promise<BallLog | null> {
    if (this.globalWickets >= 10 || this.currentOver >= 20) return null;

    // 1. Bowler acquires Pitch Mutex (Critical Section)
    await this.pitchMutex.lock();
    this.timestamp++;
    
    this.ganttLogs.push({
      timestamp: this.timestamp,
      player: this.currentBowler!.name,
      resource: 'Pitch (Bowling)',
      duration: 1
    });

    const striker = this.activeBatsmen[0];
    
    // Simulate batsman "stroke" (process time)
    await new Promise(resolve => setTimeout(resolve, 50));

    // Simulate ball outcome
    const outcomes = ['0', '1', '2', '3', '4', '6', 'W', 'WD', 'NB'];
    const result = outcomes[Math.floor(Math.random() * outcomes.length)];
    
    let runs = 0;
    let wicket = false;
    let extra = false;

    if (result === 'W') {
      wicket = true;
    } else if (result === 'WD' || result === 'NB') {
      runs = 1;
      extra = true;
    } else {
      runs = parseInt(result);
    }

    // 2. Mutex Lock: Update Global Score atomically
    await this.scoreMutex.lock();
    this.globalScore += runs;
    if (wicket) this.globalWickets++;
    this.scoreMutex.unlock();

    // 3. Condition Variable: Wake up Fielder Threads if ball is hit
    if (runs >= 1 || wicket) {
      this.ballInAir = true;
      this.ballInAirCV.broadcast(); // Signal all 10 fielder threads
    }

    // 4. Deadlock Scenario: Circular Wait (Run-out Condition)
    // Batsman A wants End 2 (Resource 2), Batsman B wants End 1 (Resource 1)
    if (runs === 1 || runs === 3) {
      const deadlockChance = Math.random() < 0.1; // 10% chance of a "Yes-No" confusion
      
      if (deadlockChance) {
        // Circular Wait: Both threads claim one resource and wait for the other
        // Umpire (The Kernel) detects deadlock and "kills" one process
        this.globalWickets++;
        wicket = true;
        
        // Signal crease semaphore as one batsman leaves
        this.creaseSemaphore.signal();
        
        const next = await this.scheduleNextBatsman();
        if (next) {
          this.activeBatsmen[0] = next;
        }
        
        this.ganttLogs.push({
          timestamp: this.timestamp,
          player: 'Umpire',
          resource: 'Deadlock Resolver',
          duration: 1
        });
      } else {
        // Normal context switch: Batsmen swap ends
        const temp = this.activeBatsmen[0];
        this.activeBatsmen[0] = this.activeBatsmen[1];
        this.activeBatsmen[1] = temp;
      }
    }

    // Handle Wicket / Next Batsman (if not already handled by deadlock)
    if (wicket && (runs !== 1 && runs !== 3)) {
      // Signal crease semaphore as one batsman leaves
      this.creaseSemaphore.signal();
      
      const next = await this.scheduleNextBatsman();
      if (next) this.activeBatsmen[0] = next;
    }

    // Update Over/Ball
    if (!extra) {
      this.currentBall++;
      if (this.currentBall === 6) {
        this.currentBall = 0;
        this.currentOver++;
        await this.scheduleNextBowler();
      }
    }

    const log: BallLog = {
      over: this.currentOver,
      ball: this.currentBall,
      bowler: this.currentBowler!.name,
      batsman: striker.name,
      result,
      score: this.globalScore,
      wickets: this.globalWickets,
      timestamp: this.timestamp
    };

    this.logs.push(log);
    
    // Release Pitch Mutex
    this.pitchMutex.unlock();
    this.ballInAir = false;

    return log;
  }
}
