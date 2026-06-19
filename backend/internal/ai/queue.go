package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/diario/backend/internal/common/cache"
)

const (
	queueKey       = "ai:queue"
	jobKeyPrefix   = "ai:job:"
	resultKeyPrefix = "ai:result:"
	jobTTL         = 24 * time.Hour
	resultTTL      = 1 * time.Hour
)

type Queue struct {
	cache *cache.RedisCache
}

func NewQueue(cache *cache.RedisCache) *Queue {
	return &Queue{cache: cache}
}

func (q *Queue) Enqueue(ctx context.Context, job *Job) error {
	job.Status = JobStatusPending
	job.CreatedAt = time.Now().UTC()
	job.UpdatedAt = job.CreatedAt

	jobJSON, err := json.Marshal(job)
	if err != nil {
		return fmt.Errorf("failed to marshal job: %w", err)
	}

	if err := q.cache.Set(ctx, jobKeyPrefix+job.ID, string(jobJSON), jobTTL); err != nil {
		return fmt.Errorf("failed to save job: %w", err)
	}

	userJobsKey := fmt.Sprintf("ai:user:%s", job.UserID.String())
	_ = q.cache.SAdd(ctx, userJobsKey, job.ID)

	if err := q.cache.LPush(ctx, queueKey, job.ID); err != nil {
		return fmt.Errorf("failed to enqueue job: %w", err)
	}

	return nil
}

func (q *Queue) Dequeue(ctx context.Context, timeout time.Duration) (*Job, error) {
	result, err := q.cache.BRPop(ctx, timeout, queueKey)
	if err != nil {
		return nil, err
	}

	if len(result) < 2 {
		return nil, nil
	}

	jobID := result[1]
	return q.GetJob(ctx, jobID)
}

func (q *Queue) GetJob(ctx context.Context, jobID string) (*Job, error) {
	data, err := q.cache.Get(ctx, jobKeyPrefix+jobID)
	if err != nil {
		return nil, fmt.Errorf("failed to get job: %w", err)
	}

	var job Job
	if err := json.Unmarshal([]byte(data), &job); err != nil {
		return nil, fmt.Errorf("failed to unmarshal job: %w", err)
	}

	return &job, nil
}

func (q *Queue) UpdateJobStatus(ctx context.Context, jobID string, status JobStatus, errorMsg string) error {
	job, err := q.GetJob(ctx, jobID)
	if err != nil {
		return err
	}

	job.Status = status
	job.Error = errorMsg
	job.UpdatedAt = time.Now().UTC()

	jobJSON, err := json.Marshal(job)
	if err != nil {
		return fmt.Errorf("failed to marshal job: %w", err)
	}

	return q.cache.Set(ctx, jobKeyPrefix+jobID, string(jobJSON), jobTTL)
}

func (q *Queue) SaveResult(ctx context.Context, jobID string, result *JobResult) error {
	result.ProcessedAt = timePtr(time.Now().UTC())

	resultJSON, err := json.Marshal(result)
	if err != nil {
		return fmt.Errorf("failed to marshal result: %w", err)
	}

	if err := q.cache.Set(ctx, resultKeyPrefix+jobID, string(resultJSON), resultTTL); err != nil {
		return fmt.Errorf("failed to save result: %w", err)
	}

	return q.UpdateJobStatus(ctx, jobID, result.Status, result.Error)
}

func (q *Queue) GetResult(ctx context.Context, jobID string) (*JobResult, error) {
	data, err := q.cache.Get(ctx, resultKeyPrefix+jobID)
	if err != nil {
		return nil, fmt.Errorf("failed to get result: %w", err)
	}

	var result JobResult
	if err := json.Unmarshal([]byte(data), &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal result: %w", err)
	}

	return &result, nil
}

func (q *Queue) PublishCompletion(ctx context.Context, userID uuid.UUID, jobID string) error {
	channel := fmt.Sprintf("ai:complete:%s", userID)
	return q.cache.Publish(ctx, channel, jobID)
}

func (q *Queue) SubscribeToCompletions(ctx context.Context, userID uuid.UUID) <-chan string {
	channel := fmt.Sprintf("ai:complete:%s", userID)
	pubsub := q.cache.Subscribe(ctx, channel)
	
	ch := make(chan string)
	go func() {
		defer close(ch)
		for {
			msg, err := pubsub.ReceiveMessage(ctx)
			if err != nil {
				return
			}
			ch <- msg.Payload
		}
	}()

	return ch
}

func (q *Queue) DeleteUserData(ctx context.Context, userID uuid.UUID) error {
	userJobsKey := fmt.Sprintf("ai:user:%s", userID.String())
	jobIDs, err := q.cache.SMembers(ctx, userJobsKey)
	if err != nil {
		return err
	}
	for _, jobID := range jobIDs {
		_ = q.cache.Delete(ctx, jobKeyPrefix+jobID)
		_ = q.cache.Delete(ctx, resultKeyPrefix+jobID)
	}
	_ = q.cache.Delete(ctx, userJobsKey)
	return nil
}

func timePtr(t time.Time) *time.Time {
	return &t
}
