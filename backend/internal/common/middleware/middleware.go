package middleware

import (
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"

	"github.com/diario/backend/internal/auth"
	"github.com/diario/backend/internal/common/cache"
	"github.com/diario/backend/internal/common/config"
)

type Middleware struct {
	cfg             *config.Config
	cache           *cache.RedisCache
	rateLimiter     *cache.RateLimiter
	authRateLimiter *cache.RateLimiter
}

func New(cfg *config.Config, redisCache *cache.RedisCache, rateLimiter *cache.RateLimiter) *Middleware {
	return &Middleware{
		cfg:             cfg,
		cache:           redisCache,
		rateLimiter:     rateLimiter,
		authRateLimiter: cache.NewRateLimiter(redisCache, 10, 15*time.Minute),
	}
}

func (m *Middleware) Auth() gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString := auth.AccessTokenFromRequest(c, m.cfg)
		if tokenString == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing authorization"})
			return
		}

		blacklisted, err := m.cache.Exists(c.Request.Context(), "blacklist:"+tokenString)
		if err == nil && blacklisted {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "token revoked"})
			return
		}

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(m.cfg.JWT.Secret), nil
		})

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token claims"})
			return
		}

		tokenType, _ := claims["type"].(string)
		if tokenType != "access" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token type"})
			return
		}

		userID, _ := claims["sub"].(string)
		email, _ := claims["email"].(string)

		if iat, ok := claims["iat"].(float64); ok && userID != "" {
			revokedAt, rerr := m.cache.Get(c.Request.Context(), "sessions_revoked:"+userID)
			if rerr == nil && revokedAt != "" {
				var revokedUnix int64
				fmt.Sscanf(revokedAt, "%d", &revokedUnix)
				if int64(iat) <= revokedUnix {
					c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "session revoked"})
					return
				}
			}
		}

		c.Set("user_id", userID)
		c.Set("email", email)

		c.Next()
	}
}

func (m *Middleware) CSRF() gin.HandlerFunc {
	skipPrefixes := []string{
		"/api/v1/auth/login",
		"/api/v1/auth/register",
		"/api/v1/auth/refresh",
		"/api/v1/auth/oauth",
		"/api/v1/auth/verify-email",
		"/api/v1/auth/verify-email-change",
		"/api/v1/auth/resend-verification",
		"/api/v1/auth/mfa/login",
		"/api/v1/auth/csrf",
		"/api/v1/auth/google",
		"/api/v1/auth/github",
	}

	return func(c *gin.Context) {
		method := c.Request.Method
		if method == http.MethodGet || method == http.MethodHead || method == http.MethodOptions {
			c.Next()
			return
		}

		path := c.Request.URL.Path
		for _, prefix := range skipPrefixes {
			if strings.HasPrefix(path, prefix) {
				c.Next()
				return
			}
		}

		if !auth.ValidateCSRF(c) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "invalid csrf token"})
			return
		}
		c.Next()
	}
}

func (m *Middleware) RateLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		identifier := c.ClientIP()

		if userID, exists := c.Get("user_id"); exists {
			identifier = userID.(string)
		}

		allowed, err := m.rateLimiter.Allow(c.Request.Context(), identifier)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "rate limit check failed"})
			return
		}

		if !allowed {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":       "rate limit exceeded",
				"retry_after": "60s",
			})
			return
		}

		c.Next()
	}
}

func (m *Middleware) AuthRateLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		allowed, err := m.authRateLimiter.Allow(c.Request.Context(), "auth:"+c.ClientIP())
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "rate limit check failed"})
			return
		}
		if !allowed {
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":       "too many authentication attempts",
				"retry_after": "15m",
			})
			return
		}
		c.Next()
	}
}

func (m *Middleware) CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")

		allowedOrigins := []string{
			"http://localhost:5173",
			"http://localhost:3000",
			"http://localhost:3080",
		}

		if extra := os.Getenv("ALLOWED_ORIGINS"); extra != "" {
			for part := range strings.SplitSeq(extra, ",") {
				part = strings.TrimSpace(part)
				if part != "" {
					allowedOrigins = append(allowedOrigins, part)
				}
			}
		}

		if m.cfg.OAuth.FrontendURL != "" {
			allowedOrigins = append(allowedOrigins, strings.TrimRight(m.cfg.OAuth.FrontendURL, "/"))
		}

		for _, allowed := range allowedOrigins {
			if origin == allowed {
				c.Header("Access-Control-Allow-Origin", origin)
				break
			}
		}

		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization, X-CSRF-Token")
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func (m *Middleware) SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Header("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
		if m.cfg.Server.Environment == "production" {
			c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		}
		c.Next()
	}
}

func (m *Middleware) RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = generateRequestID()
		}

		c.Set("request_id", requestID)
		c.Header("X-Request-ID", requestID)

		c.Next()
	}
}

func (m *Middleware) Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()

		if m.cfg.Server.Environment != "production" || status >= 400 {
			gin.DefaultWriter.Write([]byte(
				time.Now().Format("2006/01/02 - 15:04:05") +
					" | " + c.Request.Method +
					" | " + path +
					" | " + strconv.Itoa(status) +
					" | " + latency.String() + "\n",
			))
		}
	}
}

func (m *Middleware) Recovery() gin.HandlerFunc {
	return gin.Recovery()
}

func generateRequestID() string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	n := time.Now().UnixNano()
	result := make([]byte, 16)
	for j := range result {
		result[j] = charset[int(n)%len(charset)]
		n /= int64(len(charset))
	}
	return string(result)
}
