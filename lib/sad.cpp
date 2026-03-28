/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

#include <iostream>
#include <vector>
#include <string>
#include <mutex>
#include <thread>
#include <random>
#include <chrono>
#include "httplib.h" // Simple C++ HTTP Server
#include "json.hpp"   // nlohmann/json

using json = nlohmann::json;
using namespace std;

// Data Structures
struct Player {
    string id;
    string name;
    string role;
    int stayDuration;
    bool isDeathOverSpecialist;
};

struct BallLog {
    int over;
    int ball;
    string bowler;
    string batsman;
    string result;
    int score;
    int wickets;
    long long timestamp;
};

struct GanttData {
    long long timestamp;
    string player;
    string resource;
    int duration;
};

// Global State (The "Kernel" Memory)
class CricketEngine {
private:
    mutex pitch_mutex;      // Mutex: Protects the shared Pitch resource
    mutex score_mutex;      // Mutex: Protects the Global Score
    
    int global_score = 0;
    int global_wickets = 0;
    int current_over = 0;
    int current_ball = 0;
    long long timestamp = 0;

    vector<Player> bowlers;
    vector<Player> batsmen;
    Player* current_bowler;
    Player* striker;
    Player* non_striker;

    vector<BallLog> logs;
    vector<GanttData> gantt_logs;

public:
    CricketEngine() {
        // Initialize Players
        bowlers = {
            {"b1", "Jasprit Bumrah", "Bowler", 0, true},
            {"b2", "Hardik Pandya", "Bowler", 0, false},
            {"b3", "Arshdeep Singh", "Bowler", 0, true}
        };
        batsmen = {
            {"bt1", "Rohit Sharma", "Batsman", 40, false},
            {"bt2", "Virat Kohli", "Batsman", 50, false},
            {"bt3", "Rishabh Pant", "Batsman", 30, false}
        };
        
        current_bowler = &bowlers[0];
        striker = &batsmen[0];
        non_striker = &batsmen[1];
    }

    json bowl_ball() {
        if (global_wickets >= 10 || current_over >= 20) return nullptr;

        // 1. Mutex Lock: Entering Critical Section (The Pitch)
        lock_guard<mutex> pitch_lock(pitch_mutex);
        
        timestamp++;
        
        // Simulate Result
        string outcomes[] = {"0", "1", "2", "3", "4", "6", "W", "WD"};
        string result = outcomes[rand() % 8];
        
        int runs = 0;
        bool wicket = false;
        bool extra = false;

        if (result == "W") wicket = true;
        else if (result == "WD") { runs = 1; extra = true; }
        else runs = stoi(result);

        // 2. Mutex Lock: Atomic Score Update
        {
            lock_guard<mutex> score_lock(score_mutex);
            global_score += runs;
            if (wicket) global_wickets++;
        }

        // Update Over/Ball Logic
        if (!extra) {
            current_ball++;
            if (current_ball == 6) {
                current_ball = 0;
                current_over++;
                current_bowler = &bowlers[current_over % bowlers.size()];
            }
        }

        BallLog log = {current_over, current_ball, current_bowler->name, striker->name, result, global_score, global_wickets, timestamp};
        logs.push_back(log);
        
        gantt_logs.push_back({timestamp, current_bowler->name, "Pitch", 1});

        return json{
            {"over", log.over},
            {"ball", log.ball},
            {"result", log.result},
            {"bowler", log.bowler},
            {"batsman", log.batsman},
            {"score", log.score},
            {"wickets", log.wickets}
        };
    }

    json get_state() {
        json state;
        state["score"] = {{"score", global_score}, {"wickets", global_wickets}, {"over", current_over}, {"ball", current_ball}};
        
        state["logs"] = json::array();
        for(auto& l : logs) {
            state["logs"].push_back({{"over", l.over}, {"ball", l.ball}, {"bowler", l.bowler}, {"batsman", l.batsman}, {"result", l.result}, {"score", l.score}, {"wickets", l.wickets}});
        }

        state["ganttLogs"] = json::array();
        for(auto& g : gantt_logs) {
            state["ganttLogs"].push_back({{"timestamp", g.timestamp}, {"player", g.player}, {"resource", g.resource}, {"duration", g.duration}});
        }
        
        return state;
    }

    void reset() {
        lock_guard<mutex> l1(pitch_mutex);
        lock_guard<mutex> l2(score_mutex);
        global_score = 0;
        global_wickets = 0;
        current_over = 0;
        current_ball = 0;
        logs.clear();
        gantt_logs.clear();
    }
};

int main() {
    CricketEngine engine;
    httplib::Server svr;

    // API Routes
    svr.Get("/api/match/state", [&](const httplib::Request&, httplib::Response& res) {
        res.set_content(engine.get_state().dump(), "application/json");
    });

    svr.Post("/api/match/bowl", [&](const httplib::Request&, httplib::Response& res) {
        auto log = engine.bowl_ball();
        res.set_content(json{{"log", log}}.dump(), "application/json");
    });

    svr.Post("/api/match/reset", [&](const httplib::Request&, httplib::Response& res) {
        engine.reset();
        res.set_content("{\"status\":\"ok\"}", "application/json");
    });

    cout << "C++ Backend running on http://localhost:8080" << endl;
    svr.listen("0.0.0.0", 8080);

    return 0;
}
