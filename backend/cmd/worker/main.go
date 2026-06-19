package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/diario/backend/internal/ai"
	"github.com/diario/backend/internal/auth"
	"github.com/diario/backend/internal/common/cache"
	"github.com/diario/backend/internal/common/config"
	"github.com/diario/backend/internal/common/database"
	"github.com/diario/backend/internal/notes"
)

const (
	defaultWorkerCount = 3
	dequeueTimeout     = 30 * time.Second
)

func main() {
	cfg := config.Load()

	db, err := database.NewPostgresDB(cfg.Database)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := db.EnsureNotePartitions(context.Background()); err != nil {
		log.Printf("Warning: failed to ensure note partitions: %v", err)
	}

	redisCache, err := cache.NewRedisCache(cfg.Redis)
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer redisCache.Close()

	notesRepo := notes.NewRepository(db)
	authRepo := auth.NewRepository(db)
	queue := ai.NewQueue(redisCache)
	aiService := ai.NewService(cfg, redisCache, queue, notesRepo, authRepo)

	workerCount := getWorkerCount()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go runPartitionMaintenance(ctx, db)

	log.Printf("Starting %d AI workers...", workerCount)

	var wg sync.WaitGroup

	for i := 0; i < workerCount; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			runWorker(ctx, workerID, queue, aiService)
		}(i)
	}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	<-quit
	log.Println("Shutting down workers...")

	cancel()

	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		log.Println("All workers stopped gracefully")
	case <-time.After(30 * time.Second):
		log.Println("Timeout waiting for workers to stop")
	}
}

func runWorker(ctx context.Context, workerID int, queue *ai.Queue, service *ai.Service) {
	log.Printf("Worker %d started", workerID)

	for {
		select {
		case <-ctx.Done():
			log.Printf("Worker %d stopping", workerID)
			return
		default:
			job, err := queue.Dequeue(ctx, dequeueTimeout)
			if err != nil {
				if ctx.Err() != nil {
					return
				}
				continue
			}

			if job == nil {
				continue
			}

			log.Printf("Worker %d processing job %s", workerID, job.ID)

			processCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
			err = service.ProcessJob(processCtx, job)
			cancel()

			if err != nil {
				log.Printf("Worker %d failed to process job %s: %v", workerID, job.ID, err)
			} else {
				log.Printf("Worker %d completed job %s", workerID, job.ID)
			}
		}
	}
}

func getWorkerCount() int {
	if count := os.Getenv("WORKER_COUNT"); count != "" {
		var n int
		if _, err := parseEnvInt(count, &n); err == nil && n > 0 {
			return n
		}
	}
	return defaultWorkerCount
}

func parseEnvInt(s string, v *int) (int, error) {
	n := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0, nil
		}
		n = n*10 + int(c-'0')
	}
	*v = n
	return n, nil
}

func runPartitionMaintenance(ctx context.Context, db *database.PostgresDB) {
	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := db.EnsureNotePartitions(ctx); err != nil {
				log.Printf("partition maintenance failed: %v", err)
			}
		}
	}
}
