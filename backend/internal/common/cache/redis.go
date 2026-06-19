package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/diario/backend/internal/common/config"
)

type RedisCache struct {
	client *redis.Client
}

func NewRedisCache(cfg config.RedisConfig) (*RedisCache, error) {
	opt, err := redis.ParseURL(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse Redis URL: %w", err)
	}

	if cfg.Password != "" {
		opt.Password = cfg.Password
	}
	opt.DB = cfg.DB

	client := redis.NewClient(opt)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	return &RedisCache{client: client}, nil
}

func (c *RedisCache) Client() *redis.Client {
	return c.client
}

func (c *RedisCache) Close() error {
	return c.client.Close()
}

func (c *RedisCache) Get(ctx context.Context, key string) (string, error) {
	return c.client.Get(ctx, key).Result()
}

func (c *RedisCache) Set(ctx context.Context, key string, value any, expiration time.Duration) error {
	return c.client.Set(ctx, key, value, expiration).Err()
}

func (c *RedisCache) Delete(ctx context.Context, key string) error {
	return c.client.Del(ctx, key).Err()
}

func (c *RedisCache) GetJSON(ctx context.Context, key string, dest any) error {
	data, err := c.client.Get(ctx, key).Bytes()
	if err != nil {
		return err
	}
	return json.Unmarshal(data, dest)
}

func (c *RedisCache) SetJSON(ctx context.Context, key string, value any, expiration time.Duration) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return c.client.Set(ctx, key, data, expiration).Err()
}

func (c *RedisCache) Exists(ctx context.Context, key string) (bool, error) {
	result, err := c.client.Exists(ctx, key).Result()
	return result > 0, err
}

func (c *RedisCache) Incr(ctx context.Context, key string) (int64, error) {
	return c.client.Incr(ctx, key).Result()
}

func (c *RedisCache) Expire(ctx context.Context, key string, expiration time.Duration) error {
	return c.client.Expire(ctx, key, expiration).Err()
}

func (c *RedisCache) TTL(ctx context.Context, key string) (time.Duration, error) {
	return c.client.TTL(ctx, key).Result()
}

func (c *RedisCache) LPush(ctx context.Context, key string, values ...any) error {
	return c.client.LPush(ctx, key, values...).Err()
}

func (c *RedisCache) BRPop(ctx context.Context, timeout time.Duration, keys ...string) ([]string, error) {
	result, err := c.client.BRPop(ctx, timeout, keys...).Result()
	if err != nil {
		return nil, err
	}
	return result, nil
}

func (c *RedisCache) Publish(ctx context.Context, channel string, message any) error {
	return c.client.Publish(ctx, channel, message).Err()
}

func (c *RedisCache) Subscribe(ctx context.Context, channels ...string) *redis.PubSub {
	return c.client.Subscribe(ctx, channels...)
}

func (c *RedisCache) Health(ctx context.Context) error {
	return c.client.Ping(ctx).Err()
}

func (c *RedisCache) SAdd(ctx context.Context, key string, members ...any) error {
	return c.client.SAdd(ctx, key, members...).Err()
}

func (c *RedisCache) SMembers(ctx context.Context, key string) ([]string, error) {
	return c.client.SMembers(ctx, key).Result()
}

type RateLimiter struct {
	cache  *RedisCache
	limit  int
	window time.Duration
}

func NewRateLimiter(cache *RedisCache, limit int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		cache:  cache,
		limit:  limit,
		window: window,
	}
}

func (r *RateLimiter) Allow(ctx context.Context, identifier string) (bool, error) {
	key := fmt.Sprintf("rate:%s", identifier)

	count, err := r.cache.Incr(ctx, key)
	if err != nil {
		return false, err
	}

	if count == 1 {
		if err := r.cache.Expire(ctx, key, r.window); err != nil {
			return false, err
		}
	}

	return count <= int64(r.limit), nil
}

func (r *RateLimiter) Remaining(ctx context.Context, identifier string) (int, error) {
	key := fmt.Sprintf("rate:%s", identifier)

	val, err := r.cache.Get(ctx, key)
	if err == redis.Nil {
		return r.limit, nil
	}
	if err != nil {
		return 0, err
	}

	var count int
	fmt.Sscanf(val, "%d", &count)
	remaining := r.limit - count
	if remaining < 0 {
		return 0, nil
	}
	return remaining, nil
}
