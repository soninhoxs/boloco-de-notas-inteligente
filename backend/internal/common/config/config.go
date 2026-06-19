package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Redis    RedisConfig
	MinIO    MinIOConfig
	JWT      JWTConfig
	AI       AIConfig
	OAuth    OAuthConfig
	SMTP     SMTPConfig
}

type SMTPConfig struct {
	Host     string
	Port     int
	Username string
	Password string
	From     string
}

type ServerConfig struct {
	Port         string
	Environment  string
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
}

type DatabaseConfig struct {
	URL             string
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
}

type RedisConfig struct {
	URL      string
	Password string
	DB       int
}

type MinIOConfig struct {
	Endpoint  string
	AccessKey string
	SecretKey string
	Bucket    string
	UseSSL    bool
}

type JWTConfig struct {
	Secret           string
	AccessExpiresIn  time.Duration
	RefreshExpiresIn time.Duration
}

type AIConfig struct {
	GroqAPIKey      string
	OpenAIAPIKey    string
	DeepSeekAPIKey  string
	DefaultProvider string
	MaxRetries      int
	Timeout         time.Duration
}

type OAuthConfig struct {
	GoogleClientID          string
	GoogleClientSecret      string
	GitHubClientID          string
	GitHubClientSecret      string
	FrontendURL             string
	BackendURL              string
	CurrentConsentVersion   string
}

func Load() *Config {
	LoadEnvFile(".env")
	return &Config{
		Server: ServerConfig{
			Port:         getEnv("PORT", "8080"),
			Environment:  getEnv("ENVIRONMENT", "development"),
			ReadTimeout:  getDurationEnv("READ_TIMEOUT", 10*time.Second),
			WriteTimeout: getDurationEnv("WRITE_TIMEOUT", 10*time.Second),
		},
		Database: DatabaseConfig{
			URL:             getEnv("DATABASE_URL", "postgres://user:pass@localhost:6432/diario?sslmode=disable"),
			MaxOpenConns:    getIntEnv("DB_MAX_OPEN_CONNS", 25),
			MaxIdleConns:    getIntEnv("DB_MAX_IDLE_CONNS", 10),
			ConnMaxLifetime: getDurationEnv("DB_CONN_MAX_LIFETIME", 5*time.Minute),
		},
		Redis: RedisConfig{
			URL:      getEnv("REDIS_URL", "redis://localhost:6379"),
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       getIntEnv("REDIS_DB", 0),
		},
		MinIO: MinIOConfig{
			Endpoint:  getEnv("MINIO_ENDPOINT", "localhost:9000"),
			AccessKey: getEnv("MINIO_ACCESS_KEY", "minioadmin"),
			SecretKey: getEnv("MINIO_SECRET_KEY", "minioadmin"),
			Bucket:    getEnv("MINIO_BUCKET", "attachments"),
			UseSSL:    getBoolEnv("MINIO_USE_SSL", false),
		},
		JWT: JWTConfig{
			Secret:           getEnv("JWT_SECRET", "your-super-secret-key-change-in-production"),
			AccessExpiresIn:  getDurationEnv("JWT_ACCESS_EXPIRES", 15*time.Minute),
			RefreshExpiresIn: getDurationEnv("JWT_REFRESH_EXPIRES", 7*24*time.Hour),
		},
		AI: AIConfig{
			GroqAPIKey:      getEnv("GROQ_API_KEY", ""),
			OpenAIAPIKey:    getEnv("OPENAI_API_KEY", ""),
			DeepSeekAPIKey:  getEnv("DEEPSEEK_API_KEY", ""),
			DefaultProvider: getEnv("AI_DEFAULT_PROVIDER", "groq"),
			MaxRetries:      getIntEnv("AI_MAX_RETRIES", 3),
			Timeout:         getDurationEnv("AI_TIMEOUT", 30*time.Second),
		},
		OAuth: OAuthConfig{
			GoogleClientID:        getEnv("GOOGLE_CLIENT_ID", ""),
			GoogleClientSecret:    getEnv("GOOGLE_CLIENT_SECRET", ""),
			GitHubClientID:        getEnv("GITHUB_CLIENT_ID", ""),
			GitHubClientSecret:    getEnv("GITHUB_CLIENT_SECRET", ""),
			FrontendURL:           getEnv("FRONTEND_URL", "http://localhost:5173"),
			BackendURL:            getEnv("BACKEND_URL", "http://localhost:8080"),
			CurrentConsentVersion: getEnv("CONSENT_VERSION", "2026-06-18"),
		},
		SMTP: SMTPConfig{
			Host:     getEnv("SMTP_HOST", ""),
			Port:     getIntEnv("SMTP_PORT", 587),
			Username: getEnv("SMTP_USER", ""),
			Password: getEnv("SMTP_PASSWORD", ""),
			From:     getEnv("SMTP_FROM", ""),
		},
	}
}

// LoadEnvFile loads KEY=VALUE pairs from a local .env file when variables are unset.
func LoadEnvFile(path string) {
	data, err := os.ReadFile(path)
	if err != nil {
		return
	}

	for line := range strings.SplitSeq(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}

		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)
		if key == "" || os.Getenv(key) != "" {
			continue
		}

		os.Setenv(key, value)
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getIntEnv(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}

func getBoolEnv(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolVal, err := strconv.ParseBool(value); err == nil {
			return boolVal
		}
	}
	return defaultValue
}

func getDurationEnv(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}
