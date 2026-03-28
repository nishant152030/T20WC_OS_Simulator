/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Users, 
  Activity, 
  Clock, 
  Shield, 
  Play, 
  Pause, 
  RotateCcw, 
  ChevronRight,
  Lock,
  Unlock,
  UserCheck,
  AlertCircle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import { Player, PlayerRole, BallLog, GanttData, SchedulingPolicy, AnalysisData } from './types';

export default function App() {
  const [logs, setLogs] = useState<BallLog[]>([]);
  const [ganttLogs, setGanttLogs] = useState<GanttData[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisData[]>([]);
  const [score, setScore] = useState({ score: 0, wickets: 0, over: 0, ball: 0, creaseCapacity: 2 });
  const [isRunning, setIsRunning] = useState(false);
  const [policy, setPolicy] = useState<SchedulingPolicy>(SchedulingPolicy.ROUND_ROBIN);
  const [simulationSpeed, setSimulationSpeed] = useState(1000);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial state
  useEffect(() => {
    const fetchState = async () => {
      try {
        const response = await fetch('/api/match/state');
        const data = await response.json();
        setLogs(data.logs);
        setGanttLogs(data.ganttLogs);
        setAnalysis(data.analysis || []);
        setScore(data.score);
      } catch (error) {
        console.error('Failed to fetch match state:', error);
      }
    };
    fetchState();
  }, []);

  const startSimulation = () => {
    setIsRunning(true);
    timerRef.current = setInterval(async () => {
      try {
        const response = await fetch('/api/match/bowl', { method: 'POST' });
        const data = await response.json();
        
        if (data.log) {
          // Re-fetch full state to ensure sync
          const stateRes = await fetch('/api/match/state');
          const stateData = await stateRes.json();
          setLogs(stateData.logs);
          setGanttLogs(stateData.ganttLogs);
          setAnalysis(stateData.analysis || []);
          setScore(stateData.score);
        } else {
          stopSimulation();
        }
      } catch (error) {
        console.error('Failed to bowl ball:', error);
        stopSimulation();
      }
    }, simulationSpeed);
  };

  const stopSimulation = () => {
    setIsRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const resetSimulation = async () => {
    stopSimulation();
    try {
      await fetch('/api/match/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy })
      });
      setLogs([]);
      setGanttLogs([]);
      setAnalysis([]);
      setScore({ score: 0, wickets: 0, over: 0, ball: 0, creaseCapacity: 2 });
    } catch (error) {
      console.error('Failed to reset match:', error);
    }
  };

  const handlePolicyChange = async (newPolicy: SchedulingPolicy) => {
    setPolicy(newPolicy);
    try {
      await fetch('/api/match/policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy: newPolicy })
      });
    } catch (error) {
      console.error('Failed to update policy:', error);
    }
  };

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans p-4 md:p-8">
      {/* Header */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-900/20">
            <Trophy className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">T20WC OS Simulator</h1>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-[#1a1a1a] p-2 rounded-2xl border border-white/5">
          <button 
            onClick={isRunning ? stopSimulation : startSimulation}
            className={`flex items-center gap-2 px-6 py-2 rounded-xl font-semibold transition-all ${
              isRunning ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-900/20'
            }`}
          >
            {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isRunning ? 'Pause' : 'Start Match'}
          </button>
          <button 
            onClick={resetSimulation}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Scoreboard & Controls */}
        <div className="lg:col-span-4 space-y-8">
          {/* Scoreboard */}
          <section className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Activity className="w-32 h-32" />
            </div>
            <div className="relative z-10">
              <p className="text-blue-100 text-sm font-medium uppercase tracking-widest mb-2">Live Scoreboard</p>
              <div className="flex items-baseline gap-2 mb-6">
                <span className="text-6xl font-bold tracking-tighter">{score.score}</span>
                <span className="text-4xl font-light text-blue-200">/ {score.wickets}</span>
              </div>
              <div className="flex justify-between items-center border-t border-white/20 pt-6">
                <div>
                  <p className="text-blue-200 text-xs uppercase tracking-wider mb-1">Overs</p>
                  <p className="text-2xl font-semibold">{score.over}.{score.ball}</p>
                </div>
                <div className="text-right">
                  <p className="text-blue-200 text-xs uppercase tracking-wider mb-1">Run Rate</p>
                  <p className="text-2xl font-semibold">
                    {score.over > 0 || score.ball > 0 
                      ? (score.score / (score.over + score.ball/6)).toFixed(2) 
                      : '0.00'}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Scheduling Policy */}
          <section className="bg-[#1a1a1a] rounded-3xl p-6 border border-white/5">
            <div className="flex items-center gap-2 mb-6">
              <Clock className="w-5 h-5 text-blue-400" />
              <h2 className="font-semibold">Scheduling Policy</h2>
            </div>
            <div className="space-y-3">
              {[SchedulingPolicy.ROUND_ROBIN, SchedulingPolicy.SJF, SchedulingPolicy.PRIORITY].map((p) => (
                <button
                  key={p}
                  onClick={() => handlePolicyChange(p)}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                    policy === p 
                      ? 'bg-blue-600/10 border-blue-500 text-blue-400' 
                      : 'bg-[#111] border-white/5 text-gray-400 hover:border-white/20'
                  }`}
                >
                  <span className="text-sm font-medium">{p}</span>
                  {policy === p && <UserCheck className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </section>

          {/* OS Synchronization Status */}
          <section className="bg-[#1a1a1a] rounded-3xl p-6 border border-white/5">
            <div className="flex items-center gap-2 mb-6">
              <Shield className="w-5 h-5 text-purple-400" />
              <h2 className="font-semibold">OS Synchronization</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#111] p-4 rounded-2xl border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-orange-400" />
                  <span className="text-xs text-gray-400 uppercase">Pitch Mutex</span>
                </div>
                <p className="text-sm font-mono">{isRunning ? 'LOCKED' : 'UNLOCKED'}</p>
              </div>
              <div className="bg-[#111] p-4 rounded-2xl border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-gray-400 uppercase">Crease Sem</span>
                </div>
                <p className="text-sm font-mono">CAPACITY: {score.creaseCapacity}/2</p>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Logs & Charts */}
        <div className="lg:col-span-8 space-y-8">
          {/* Gantt Chart: Pitch Resource Usage */}
          <section className="bg-[#1a1a1a] rounded-3xl p-6 border border-white/5">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-400" />
                <h2 className="font-semibold">Resource Allocation (Pitch)</h2>
              </div>
              <span className="text-xs font-mono text-gray-500 uppercase">Gantt Chart Visualization</span>
            </div>
            <div className="h-[500px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ganttLogs.slice(-60)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                  <XAxis type="number" domain={['dataMin', 'dataMax']} stroke="#666" fontSize={10} />
                  <YAxis dataKey="label" type="category" stroke="#666" fontSize={10} width={150} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                    labelStyle={{ color: '#aaa' }}
                    formatter={(value: any, name: string, props: any) => {
                      if (name === 'timestamp') return [value, 'Start Time'];
                      if (name === 'duration') return [value, 'Duration'];
                      return [value, name];
                    }}
                  />
                  <Bar dataKey="timestamp" stackId="a" fill="transparent" />
                  <Bar dataKey="duration" stackId="a" radius={[0, 4, 4, 0]}>
                    {ganttLogs.slice(-60).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Ball-by-Ball Log */}
          <section className="bg-[#1a1a1a] rounded-3xl border border-white/5 overflow-hidden">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                <h2 className="font-semibold">Ball-by-Ball Log</h2>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <AlertCircle className="w-3 h-3" />
                <span>Deadlock Detection Active</span>
              </div>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-[#1a1a1a] z-10">
                  <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-white/5">
                    <th className="px-6 py-4 font-medium">Over</th>
                    <th className="px-6 py-4 font-medium">Bowler</th>
                    <th className="px-6 py-4 font-medium">Batsman</th>
                    <th className="px-6 py-4 font-medium">Result</th>
                    <th className="px-6 py-4 font-medium">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <AnimatePresence initial={false}>
                    {logs.slice().reverse().map((log, i) => (
                      <motion.tr 
                        key={`${log.over}-${log.ball}-${i}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="hover:bg-white/5 transition-colors"
                      >
                        <td className="px-6 py-4 text-sm font-mono text-gray-400">{log.over}.{log.ball}</td>
                        <td className="px-6 py-4 text-sm font-medium">{log.bowler}</td>
                        <td className="px-6 py-4 text-sm text-gray-300">{log.batsman}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                            log.result === 'W' ? 'bg-red-500/20 text-red-500' :
                            ['4', '6'].includes(log.result) ? 'bg-green-500/20 text-green-500' :
                            'bg-blue-500/20 text-blue-500'
                          }`}>
                            {log.result}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold">{log.score}/{log.wickets}</td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
              {logs.length === 0 && (
                <div className="p-12 text-center">
                  <Users className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                  <p className="text-gray-500">No balls bowled yet. Start the match to see the simulation.</p>
                </div>
              )}
            </div>
          </section>

          {/* Analysis Section */}
          <section className="bg-[#1a1a1a] rounded-3xl p-6 border border-white/5">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <BarChart className="w-5 h-5 text-green-400" />
                <h2 className="font-semibold">Scheduling Analysis</h2>
              </div>
              <span className="text-xs font-mono text-gray-500 uppercase">Wait Time Comparison</span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analysis}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="playerName" stroke="#666" fontSize={10} />
                  <YAxis stroke="#666" fontSize={10} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="waitTime" fill="#3b82f6" name="Wait Time (ticks)" />
                  <Bar dataKey="stayDuration" fill="#10b981" name="Stay Duration (ticks)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 p-4 bg-blue-600/5 rounded-2xl border border-blue-500/20">
              <p className="text-xs text-blue-300 leading-relaxed">
                <span className="font-bold uppercase mr-2">Insight:</span>
                Under <strong>SJF</strong>, batsmen with shorter stay durations (tail-enders) are prioritized, 
                reducing their wait time in the dugout. In <strong>RR</strong>, the order is fixed (FCFS), 
                leading to higher wait times for lower-order batsmen.
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer / Assumptions */}
      <footer className="max-w-7xl mx-auto mt-12 pt-8 border-t border-white/5 text-gray-500 text-xs">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-gray-400 font-semibold mb-2 uppercase tracking-wider">Assumptions</h3>
            <ul className="space-y-1 list-disc list-inside">
              <li>Pitch is a shared resource (Critical Section)</li>
              <li>Bowler thread writes to Pitch buffer</li>
              <li>Batsman thread reads and updates Global Score</li>
              <li>Fielders sleep until BALL_HIT signal (CV)</li>
            </ul>
          </div>
          <div>
            <h3 className="text-gray-400 font-semibold mb-2 uppercase tracking-wider">OS Mechanisms</h3>
            <ul className="space-y-1 list-disc list-inside">
              <li>Mutex: Protects Global_Score and Pitch</li>
              <li>Semaphore: Crease capacity management (2)</li>
              <li>Condition Variables: Fielder wake-up logic</li>
              <li>Deadlock Detection: Run-out circular wait handling</li>
            </ul>
          </div>
          <div>
            <h3 className="text-gray-400 font-semibold mb-2 uppercase tracking-wider">Scheduling</h3>
            <ul className="space-y-1 list-disc list-inside">
              <li>Round Robin: Bowler rotation (Quantum = 6)</li>
              <li>SJF: Batting order based on stay duration</li>
              <li>Priority: Death over specialists at end-game</li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
