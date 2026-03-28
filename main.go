package main

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"sort"
	"sync"
	"time"
)

// Player Roles
const (
	Bowler       = "Bowler"
	Batsman      = "Batsman"
	Fielder      = "Fielder"
	WicketKeeper = "Wicket Keeper"
)

// Scheduling Policies
const (
	RoundRobin = "Round Robin (Bowlers)"
	SJF        = "Shortest Job First (Tail-enders)"
	Priority   = "Priority (Death Overs)"
)

type PlayerStats struct {
	Runs                  int  `json:"runs,omitempty"`
	Balls                 int  `json:"balls,omitempty"`
	Wickets               int  `json:"wickets,omitempty"`
	Overs                 int  `json:"overs,omitempty"`
	StayDuration          int  `json:"stayDuration,omitempty"`
	IsDeathOverSpecialist bool `json:"isDeathOverSpecialist,omitempty"`
	ReadyTime             int  `json:"readyTime,omitempty"`
	StartTime             int  `json:"startTime,omitempty"`
}

type AnalysisData struct {
	PlayerName   string `json:"playerName"`
	WaitTime     int    `json:"waitTime"`
	StayDuration int    `json:"stayDuration"`
	Policy       string `json:"policy"`
}

type Player struct {
	ID            string      `json:"id"`
	Name          string      `json:"name"`
	Role          string      `json:"role"`
	Stats         PlayerStats `json:"stats"`
	OriginalOrder int         `json:"-"`
}

type BallLog struct {
	Over      int    `json:"over"`
	Ball      int    `json:"ball"`
	Bowler    string `json:"bowler"`
	Batsman   string `json:"batsman"`
	Result    string `json:"result"`
	Score     int    `json:"score"`
	Wickets   int    `json:"wickets"`
	Timestamp int    `json:"timestamp"`
}

type GanttData struct {
	Timestamp int    `json:"timestamp"`
	Player    string `json:"player"`
	Resource  string `json:"resource"`
	Duration  int    `json:"duration"`
	Label     string `json:"label"`
}

type CricketEngine struct {
	PitchMutex      sync.Mutex
	ScoreMutex      sync.Mutex
	FielderCond     *sync.Cond
	CreaseSemaphore chan struct{}

	GlobalScore   int
	GlobalWickets int
	CurrentOver   int
	CurrentBall   int
	Timestamp     int
	Policy        string
	BallInAir     bool
	StopChan      chan struct{}

	Bowlers       []Player
	Batsmen       []Player
	ActiveBatsmen []Player
	CurrentBowler *Player

	Logs         []BallLog
	GanttLogs    []GanttData
	AnalysisLogs []AnalysisData
}

var engine *CricketEngine
var engineMutex sync.Mutex

func initEngine(policy string) {
	// Stop old engine goroutines if any
	if engine != nil && engine.StopChan != nil {
		close(engine.StopChan)
	}

	bowlers := []Player{
		{ID: "b1", Name: "Pat Cummins", Role: Bowler, Stats: PlayerStats{IsDeathOverSpecialist: true}},
		{ID: "b2", Name: "Cameron Green", Role: Bowler},
		{ID: "b3", Name: "Mitchell Starc", Role: Bowler, Stats: PlayerStats{IsDeathOverSpecialist: true}},
		{ID: "b4", Name: "Nathon Lyon", Role: Bowler},
	}

	batsmen := []Player{
		{ID: "bt1", Name: "Rohit Sharma", Role: Batsman, Stats: PlayerStats{StayDuration: 40}, OriginalOrder: 0},
		{ID: "bt2", Name: "Virat Kohli", Role: Batsman, Stats: PlayerStats{StayDuration: 50}, OriginalOrder: 1},
		{ID: "bt3", Name: "Rishabh Pant", Role: Batsman, Stats: PlayerStats{StayDuration: 30}, OriginalOrder: 2},
		{ID: "bt4", Name: "Suryakumar Yadav", Role: Batsman, Stats: PlayerStats{StayDuration: 25}, OriginalOrder: 3},
		{ID: "bt5", Name: "Shivam Dube", Role: Batsman, Stats: PlayerStats{StayDuration: 20}, OriginalOrder: 4},
		{ID: "bt6", Name: "Ravindra Jadeja", Role: Batsman, Stats: PlayerStats{StayDuration: 15}, OriginalOrder: 5},
		{ID: "bt7", Name: "Axar Patel", Role: Batsman, Stats: PlayerStats{StayDuration: 10}, OriginalOrder: 6},
		{ID: "bt8", Name: "Arshdeep Singh", Role: Batsman, Stats: PlayerStats{StayDuration: 5}, OriginalOrder: 7},
		{ID: "bt9", Name: "Jasprit Bumrah", Role: Batsman, Stats: PlayerStats{StayDuration: 3}, OriginalOrder: 8},
		{ID: "bt10", Name: "Kuldeep Yadav", Role: Batsman, Stats: PlayerStats{StayDuration: 2}, OriginalOrder: 9},
		{ID: "bt11", Name: "Mohammed Siraj", Role: Batsman, Stats: PlayerStats{StayDuration: 1}, OriginalOrder: 10},
	}

	if policy == "" {
		policy = RoundRobin
	}

	// Sort remaining batsmen based on policy
	remaining := batsmen[2:]
	if policy == SJF {
		sort.Slice(remaining, func(i, j int) bool {
			return remaining[i].Stats.StayDuration < remaining[j].Stats.StayDuration
		})
	} else {
		sort.Slice(remaining, func(i, j int) bool {
			return remaining[i].OriginalOrder < remaining[j].OriginalOrder
		})
	}

	engine = &CricketEngine{
		Bowlers:         bowlers,
		Batsmen:         batsmen,
		ActiveBatsmen:   []Player{batsmen[0], batsmen[1]},
		CurrentBowler:   &bowlers[0],
		Policy:          policy,
		Logs:            []BallLog{},
		GanttLogs:       []GanttData{},
		AnalysisLogs: []AnalysisData{
			{PlayerName: batsmen[0].Name, WaitTime: 0, StayDuration: 0, Policy: policy},
			{PlayerName: batsmen[1].Name, WaitTime: 0, StayDuration: 0, Policy: policy},
		},
		FielderCond:     sync.NewCond(&sync.Mutex{}),
		CreaseSemaphore: make(chan struct{}, 2),
		StopChan:        make(chan struct{}),
	}

	// Initialize Crease Semaphore for first two batsmen
	engine.CreaseSemaphore <- struct{}{}
	engine.CreaseSemaphore <- struct{}{}

	// Initialize 10 Fielder Goroutines (Passive Threads)
	for i := 0; i < 10; i++ {
		go func(id int, e *CricketEngine) {
			for {
				select {
				case <-e.StopChan:
					return
				default:
					e.FielderCond.L.Lock()
					for !e.BallInAir {
						e.FielderCond.Wait()
						// Check stop signal after waking up
						select {
						case <-e.StopChan:
							e.FielderCond.L.Unlock()
							return
						default:
						}
					}

					// Critical Section: Fielder processing the ball
					engineMutex.Lock()
					// e.GanttLogs = append(e.GanttLogs, GanttData{
					// 	Timestamp: e.Timestamp,
					// 	Player:    fmt.Sprintf("Fielder %d", id+1),
					// 	Resource:  "Field",
					// 	Duration:  1,
					// 	Label:     fmt.Sprintf("Fielder %d (Field)", id+1),
					// })
					engineMutex.Unlock()

					// Wait for BallInAir to become false before waiting again
					// to avoid multiple logs for the same ball
					for e.BallInAir {
						e.FielderCond.L.Unlock()
						time.Sleep(5 * time.Millisecond)
						e.FielderCond.L.Lock()
						select {
						case <-e.StopChan:
							e.FielderCond.L.Unlock()
							return
						default:
						}
					}
					e.FielderCond.L.Unlock()
				}
			}
		}(i, engine)
	}
}

func (e *CricketEngine) BowlBall() *BallLog {
	if e.GlobalWickets >= 10 || e.CurrentOver >= 20 {
		return nil
	}

	// 1. Mutex: Pitch Access (Critical Section)
	e.PitchMutex.Lock()
	defer e.PitchMutex.Unlock()

	e.Timestamp++
	hitTimestamp := e.Timestamp
	e.GanttLogs = append(e.GanttLogs, GanttData{
		Timestamp: hitTimestamp,
		Player:    e.CurrentBowler.Name,
		Resource:  "Pitch",
		Duration:  1,
		Label:     fmt.Sprintf("%s", e.CurrentBowler.Name),
	})

	striker := e.ActiveBatsmen[0]

	// 2. Batsman uses Pitch to hit the ball
	
	// Simulate batsman "stroke" (process time)
	time.Sleep(50 * time.Millisecond)
	
	// Calculate wicket probability based on stayDuration
	// Higher stayDuration -> Lower probability
	// Base chance is 1/stayDuration, capped at 50% for very short durations
	wicketChance := 1.0 / float64(striker.Stats.StayDuration)
	if wicketChance > 0.5 {
		wicketChance = 0.5
	}

	var result string
	if rand.Float64() < wicketChance {
		result = "W"
	} else {
		// Roll for other outcomes if not a wicket
		otherOutcomes := []string{"0", "1", "2", "3", "4", "6", "WD", "NB"}
		result = otherOutcomes[rand.Intn(len(otherOutcomes))]
	}

	
	runs := 0
	wicket := false
	extra := false
	
	switch result {
	case "W":
		wicket = true
	case "WD", "NB":
		runs = 1
		extra = true
	default:
		fmt.Sscanf(result, "%d", &runs)
	}
	
	dur := 0
	if wicket || extra || (runs == 4 || runs == 6 || runs == 0) {
		dur = 1
	} else {
		dur = runs
	}
		
	e.Timestamp++
	e.GanttLogs = append(e.GanttLogs, GanttData{
		Timestamp: e.Timestamp,
		Player:    striker.Name,
		Resource:  "Pitch",
		Duration:  dur, // Batsman stays on pitch for longer
		Label:     fmt.Sprintf("%s", striker.Name),
	})
	
	e.Timestamp += (dur-1)
	// 2. Mutex: Atomic Score Update
	for _, b := range e.ActiveBatsmen {
		for i := range e.AnalysisLogs {
			if e.AnalysisLogs[i].PlayerName == b.Name {
				e.AnalysisLogs[i].StayDuration = e.Timestamp - b.Stats.StartTime
			}
		}
	}

	e.ScoreMutex.Lock()
	e.GlobalScore += runs
	if wicket {
		e.GlobalWickets++
	}
	e.ScoreMutex.Unlock()
	
	// 3. Condition Variable: Wake up Fielders
	if runs >= 1 || wicket {
		e.FielderCond.L.Lock()
		e.BallInAir = true
		// Fielders will wake up and use the current e.Timestamp (hitTimestamp)
		e.FielderCond.Broadcast()
		e.FielderCond.L.Unlock()

		// Reset flag after a short delay to simulate ball landing
		go func() {
			time.Sleep(50 * time.Millisecond)
			e.FielderCond.L.Lock()
			e.BallInAir = false
			e.FielderCond.L.Unlock()
		}()
	}

	// 4. Deadlock Scenario: Circular Wait (Run-out)
	if runs >=1 {
		if rand.Float64() < 0.1 { // 10% chance of deadlock
			// Umpire (The Kernel) detects deadlock and "kills" one process
			e.GlobalWickets++
			wicket = true

			// Release Crease Semaphore
			<-e.CreaseSemaphore
			e.Timestamp++
			e.GanttLogs = append(e.GanttLogs, GanttData{
				Timestamp: e.Timestamp,
				Player:    "Umpire",
				Resource:  "Deadlock Resolver",
				Duration:  1,
				Label:     "Umpire (Deadlock Resolver)",
			})
		} else {
			// Normal context switch: Batsmen swap ends
			e.ActiveBatsmen[0], e.ActiveBatsmen[1] = e.ActiveBatsmen[1], e.ActiveBatsmen[0]
		}
	}

	// Handle Wicket / Next Batsman
	if wicket && e.GlobalWickets < 11 {
		// Release Crease Semaphore if not already released by deadlock
		if runs != 1 && runs != 3 {
			<-e.CreaseSemaphore
		}

		nextIdx := e.GlobalWickets + 1
		if nextIdx < len(e.Batsmen) {
			remaining := e.Batsmen[nextIdx:]
			if e.Policy == SJF {
				// Re-sort remaining batsmen if policy is SJF
				sort.Slice(remaining, func(i, j int) bool {
					return remaining[i].Stats.StayDuration < remaining[j].Stats.StayDuration
				})
			} else {
				// Restore normal ordering if not SJF
				sort.Slice(remaining, func(i, j int) bool {
					return remaining[i].OriginalOrder < remaining[j].OriginalOrder
				})
			}

			// Wait for Crease Semaphore
			e.CreaseSemaphore <- struct{}{}

			next := e.Batsmen[nextIdx]
			next.Stats.StartTime = e.Timestamp
			e.ActiveBatsmen[0] = next

			// Record Analysis
			e.AnalysisLogs = append(e.AnalysisLogs, AnalysisData{
				PlayerName:   next.Name,
				WaitTime:     next.Stats.StartTime - next.Stats.ReadyTime,
				StayDuration: 0,
				Policy:       e.Policy,
			})
		}
	}

	// Update Over/Ball
	if !extra {
		e.CurrentBall++
		if e.CurrentBall == 6 {
			e.CurrentBall = 0
			e.CurrentOver++

			// Context Switch Logging
			e.Timestamp++
			e.GanttLogs = append(e.GanttLogs, GanttData{
				Timestamp: e.Timestamp,
				Player:    "Kernel",
				Resource:  "Context Switch (Over)",
				Duration:  1,
				Label:     "Kernel (Context Switch)",
			})

			// Priority Scheduling: Death Over Specialist
			if e.CurrentOver >= 18 {
				for _, b := range e.Bowlers {
					if b.Stats.IsDeathOverSpecialist {
						e.CurrentBowler = &b
						break
					}
				}
			} else {
				// Round Robin Scheduling
				nextBowlerIdx := (e.CurrentOver) % len(e.Bowlers)
				e.CurrentBowler = &e.Bowlers[nextBowlerIdx]
			}
		}
	}

	log := BallLog{
		Over:      e.CurrentOver,
		Ball:      e.CurrentBall,
		Bowler:    e.CurrentBowler.Name,
		Batsman:   e.ActiveBatsmen[0].Name,
		Result:    result,
		Score:     e.GlobalScore,
		Wickets:   e.GlobalWickets,
		Timestamp: e.Timestamp,
	}

	e.Logs = append(e.Logs, log)
	return &log
}

func main() {
	rand.Seed(time.Now().UnixNano())
	initEngine(RoundRobin)

	// API Endpoints
	http.HandleFunc("/api/match/state", func(w http.ResponseWriter, r *http.Request) {
		engineMutex.Lock()
		defer engineMutex.Unlock()
		json.NewEncoder(w).Encode(map[string]interface{}{
			"score": map[string]int{
				"score":   engine.GlobalScore,
				"wickets": engine.GlobalWickets,
				"over":    engine.CurrentOver,
				"ball":    engine.CurrentBall,
			},
			"logs":      engine.Logs,
			"ganttLogs": engine.GanttLogs,
			"analysis":  engine.AnalysisLogs,
		})
	})

	http.HandleFunc("/api/match/bowl", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}
		engineMutex.Lock()
		log := engine.BowlBall()
		engineMutex.Unlock()
		json.NewEncoder(w).Encode(map[string]interface{}{"log": log})
	})

	http.HandleFunc("/api/match/reset", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Policy string `json:"policy"`
		}
		json.NewDecoder(r.Body).Decode(&body)

		engineMutex.Lock()
		initEngine(body.Policy)
		engineMutex.Unlock()
		w.WriteHeader(http.StatusOK)
	})

	http.HandleFunc("/api/match/policy", func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Policy string `json:"policy"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "Bad request", http.StatusBadRequest)
			return
		}

		engineMutex.Lock()
		if engine != nil {
			engine.Policy = body.Policy
			nextIdx := engine.GlobalWickets + 1
			if nextIdx < len(engine.Batsmen) {
				remaining := engine.Batsmen[nextIdx:]
				if engine.Policy == SJF {
					// Re-sort remaining batsmen immediately if policy is changed to SJF
					sort.Slice(remaining, func(i, j int) bool {
						return remaining[i].Stats.StayDuration < remaining[j].Stats.StayDuration
					})
				} else {
					// Restore normal ordering immediately if policy is changed away from SJF
					sort.Slice(remaining, func(i, j int) bool {
						return remaining[i].OriginalOrder < remaining[j].OriginalOrder
					})
				}
			}
		}
		engineMutex.Unlock()
		w.WriteHeader(http.StatusOK)
	})

	fmt.Println("Go Backend running on :8080")
	http.ListenAndServe(":8080", nil)
}
