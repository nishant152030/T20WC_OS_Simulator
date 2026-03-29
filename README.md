# Cricket OS: Scheduling & Synchronization Simulator

Cricket OS is an interactive educational tool that visualizes core Operating System concepts through the lens of a cricket match. It maps process scheduling, resource management, and thread synchronization to the familiar dynamics of cricket.

## 🏏 Concept Mapping

| OS Concept | Cricket Equivalent |
| :--- | :--- |
| **Process** | Batsman (with varying "Stay Duration" / Burst Time) |
| **CPU (Primary Resource)** | The Pitch (only one striker can use it at a time) |
| **Scheduling Policy** | Match Strategy (FCFS, SJF, Round Robin) |
| **Semaphore** | The Crease (limited to 2 batsmen at a time) |
| **Mutex Lock** | Scoreboard Update (atomic operation to prevent race conditions) |
| **Condition Variable** | Fielder Threads (waiting for the "Ball in Air" signal) |
| **Deadlock** | Run-out (Circular wait where both batsmen wait for the same end) |
| **Context Switch** | Batsmen swapping ends after a run |

## 🚀 Key Features

- **Interactive Simulation**: Bowl balls manually or run an automated simulation.
- **Scheduling Policies**:
  - **FCFS (First-Come, First-Served)**: Batsmen play in their original lineup order.
  - **SJF (Shortest Job First)**: Batsmen with lower expected stay duration (tail-enders) are prioritized.
  - **Round Robin**: Batsmen swap frequently to simulate time-slicing.
- **Real-time Gantt Chart**: A unified timeline showing exactly which player is using the Pitch resource at any given timestamp.
- **OS Synchronization Panel**: Monitor the state of Mutexes, Semaphores, and Condition Variables in real-time.
- **Performance Analysis**: Comparative graphs showing Wait Time vs. Stay Duration for each player.
- **Dynamic Wicket Probability**: Batsmen with higher "Stay Duration" (skill) have a lower probability of getting out, simulating realistic player performance.

## 🛠️ Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Recharts, Framer Motion, Lucide React.
- **Backend**: Go (Golang) with a custom Express-like server.
- **Simulation Engine**: Dual-engine implementation (Go for backend state, TypeScript for frontend-only mode).

## 🏃 Getting Started

### Prerequisites
- Node.js (v18+)
- Go (1.20+)

### Installation
1. Install frontend dependencies:
   ```bash
   npm install
   ```

2. Run the backend server
   ```bash
   go run main.go
   ```
   
3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open your browser to `http://localhost:3000`.

## 📊 Analysis & Metrics

The simulation tracks:
- **Wait Time**: How long a batsman waited in the dugout before getting to the crease.
- **Stay Duration**: The logical time used to calculate the probablity of wicket when the batsman is on the pitch.
- **Throughput**: Runs scored per unit of logical time.

## 📜 License
MIT License - Created for educational purposes to demonstrate OS principles.
