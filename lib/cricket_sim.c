#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>
#include <semaphore.h>
#include <unistd.h>
#include <stdbool.h>

// --- Configuration ---
#define TOTAL_BALLS 12
#define MAX_FIELDERS 10
#define MAX_BATSMEN 5

// --- Global Resources ---
int global_score = 0;
int wickets = 0;
bool ball_in_air = false;
int current_ball_count = 0;

// --- Synchronization Primitives ---
pthread_mutex_t pitch_mutex = PTHREAD_MUTEX_INITIALIZER;
pthread_mutex_t score_mutex = PTHREAD_MUTEX_INITIALIZER;
pthread_cond_t fielder_cond = PTHREAD_COND_INITIALIZER;
pthread_mutex_t fielder_mutex = PTHREAD_MUTEX_INITIALIZER;
sem_t crease_semaphore;

// --- Player Data ---
typedef struct {
    int id;
    int priority;      // For Priority Scheduling
    int stay_duration; // For SJF (Shortest Job First)
    char* role;
} Player;

// --- Fielder Logic (Condition Variables) ---
void* fielder_thread(void* arg) {
    long id = (long)arg;
    while (current_ball_count < TOTAL_BALLS) {
        pthread_mutex_lock(&fielder_mutex);
        while (!ball_in_air && current_ball_count < TOTAL_BALLS) {
            pthread_cond_wait(&fielder_cond, &fielder_mutex);
        }
        if (current_ball_count >= TOTAL_BALLS) {
            pthread_mutex_unlock(&fielder_mutex);
            break;
        }
        printf("[Fielder %ld] Reacting to ball in air! Attempting to stop runs...\n", id);
        pthread_mutex_unlock(&fielder_mutex);
        usleep(100000); // Simulate fielding action
    }
    return NULL;
}

// --- Batsman Logic (Semaphores & Mutex) ---
void* batsman_thread(void* arg) {
    Player* b = (Player*)arg;
    
    // Semaphore: Only 2 batsmen in the crease
    sem_wait(&crease_semaphore);
    printf("[Batsman %d] Entered the crease (SJF Stay Duration: %d).\n", b->id, b->stay_duration);

    while (current_ball_count < TOTAL_BALLS && wickets < MAX_BATSMEN) {
        // Wait for ball to be delivered (Simplified for simulation)
        usleep(500000); 
    }

    printf("[Batsman %d] Leaving the crease.\n", b->id);
    sem_post(&crease_semaphore);
    return NULL;
}

// --- Bowler Logic (Critical Section) ---
void* bowler_thread(void* arg) {
    int bowler_id = *(int*)arg;
    
    for (int i = 0; i < 6; i++) { // Round Robin: 6 balls per over
        if (current_ball_count >= TOTAL_BALLS) break;

        pthread_mutex_lock(&pitch_mutex); // Critical Section: The Pitch
        
        current_ball_count++;
        printf("\n--- Ball %d | Bowler %d is charging! ---\n", current_ball_count, bowler_id);
        
        // Simulate hit
        pthread_mutex_lock(&score_mutex);
        int runs = rand() % 7;
        global_score += runs;
        printf("[Scoreboard] Batsman hit %d runs. Total: %d\n", runs, global_score);
        pthread_mutex_unlock(&score_mutex);

        // Signal Fielders
        pthread_mutex_lock(&fielder_mutex);
        ball_in_air = true;
        pthread_cond_broadcast(&fielder_cond);
        pthread_mutex_unlock(&fielder_mutex);

        usleep(200000); // Processing time

        // Reset ball state
        ball_in_air = false;
        
        pthread_mutex_unlock(&pitch_mutex); // Release Pitch
        usleep(100000); 
    }
    return NULL;
}

// --- Main Simulator ---
int main() {
    srand(time(NULL));
    sem_init(&crease_semaphore, 0, 2);

    pthread_t bowlers[2], batsmen[MAX_BATSMEN], fielders[MAX_FIELDERS];
    Player batsman_list[MAX_BATSMEN];

    // Initialize Fielders
    for (long i = 0; i < MAX_FIELDERS; i++) {
        pthread_create(&fielders[i], NULL, fielder_thread, (void*)i);
    }

    // Initialize Batsmen (SJF and Priority Data)
    for (int i = 0; i < MAX_BATSMEN; i++) {
        batsman_list[i].id = i + 1;
        batsman_list[i].stay_duration = (rand() % 10) + 1; // Short stay = Tail-ender
        pthread_create(&batsmen[i], NULL, batsman_thread, &batsman_list[i]);
    }

    // Scheduler: Round Robin for Bowlers
    int b1 = 1, b2 = 2;
    pthread_create(&bowlers[0], NULL, bowler_thread, &b1);
    pthread_join(bowlers[0], NULL); // Wait for over to finish (Context Switch)
    
    printf("\n>>> Context Switch: Change of Over. RR Scheduler rotating bowlers. <<<\n");
    
    pthread_create(&bowlers[1], NULL, bowler_thread, &b2);
    pthread_join(bowlers[1], NULL);

    // Cleanup
    current_ball_count = TOTAL_BALLS; // Ensure fielders exit
    pthread_cond_broadcast(&fielder_cond);
    for (int i = 0; i < MAX_FIELDERS; i++) pthread_join(fielders[i], NULL);
    sem_destroy(&crease_semaphore);

    printf("\n============================\n");
    printf("FINAL SCORE: %d\n", global_score);
    printf("============================\n");

    return 0;
}