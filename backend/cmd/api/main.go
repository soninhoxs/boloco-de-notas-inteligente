package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/diario/backend/internal/ai"
	"github.com/diario/backend/internal/auth"
	"github.com/diario/backend/internal/common/cache"
	"github.com/diario/backend/internal/common/config"
	"github.com/diario/backend/internal/common/database"
	"github.com/diario/backend/internal/common/email"
	"github.com/diario/backend/internal/common/middleware"
	"github.com/diario/backend/internal/notes"
	"github.com/diario/backend/internal/storage"
	"github.com/diario/backend/internal/user"
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

	rateLimiter := cache.NewRateLimiter(redisCache, 100, time.Minute)

	mw := middleware.New(cfg, redisCache, rateLimiter)

	if cfg.Server.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()

	if cfg.Server.Environment == "production" {
		_ = router.SetTrustedProxies([]string{
			"127.0.0.1",
			"10.0.0.0/8",
			"172.16.0.0/12",
			"192.168.0.0/16",
		})
	} else {
		_ = router.SetTrustedProxies(nil)
	}

	router.Use(mw.Recovery())
	router.Use(mw.RequestID())
	router.Use(mw.SecurityHeaders())
	router.Use(mw.CORS())
	router.Use(mw.Logger())
	router.Use(mw.CSRF())

	authRepo := auth.NewRepository(db)
	mailer := email.NewMailer(cfg.SMTP)
	authService := auth.NewService(authRepo, cfg, redisCache, mailer)
	authHandler := auth.NewHandler(authService)

	userRepo := user.NewRepository(db)

	notesRepo := notes.NewRepository(db)
	notesService := notes.NewService(notesRepo, redisCache)
	notesHandler := notes.NewHandler(notesService)

	aiQueue := ai.NewQueue(redisCache)
	aiService := ai.NewService(cfg, redisCache, aiQueue, notesRepo, authRepo)
	aiHandler := ai.NewHandler(aiService)

	storageService, err := storage.NewStorage(cfg.MinIO)
	if err != nil {
		log.Printf("Warning: Failed to connect to MinIO storage: %v", err)
	}
	var storageHandler *storage.Handler
	if storageService != nil {
		storageHandler = storage.NewHandler(storageService)
	}

	userService := user.NewService(userRepo, redisCache, user.ServiceDeps{
		NotesRepo:      notesRepo,
		Storage:        storageService,
		AIQueue:        aiQueue,
		SessionRevoker: authService,
		EmailChanger:   authService,
		Config:         cfg,
	})
	userHandler := user.NewHandler(userService)

	router.GET("/health", healthCheck(db, redisCache))

	v1 := router.Group("/api/v1")
	{
		authRoutes := v1.Group("/auth")
		authRoutes.Use(mw.AuthRateLimit())
		{
			authRoutes.GET("/csrf", authHandler.CSRFToken)
			authRoutes.POST("/register", authHandler.Register)
			authRoutes.POST("/login", authHandler.Login)
			authRoutes.POST("/mfa/login", authHandler.MFALogin)
			authRoutes.POST("/refresh", authHandler.RefreshToken)
			authRoutes.POST("/oauth/exchange", authHandler.OAuthExchange)
			authRoutes.POST("/logout", authHandler.Logout)
			authRoutes.GET("/verify-email", authHandler.VerifyEmail)
			authRoutes.GET("/verify-email-change", authHandler.VerifyEmailChange)
			authRoutes.POST("/resend-verification", authHandler.ResendVerification)
			authRoutes.GET("/google", authHandler.GoogleLogin)
			authRoutes.GET("/google/callback", authHandler.GoogleCallback)
			authRoutes.GET("/github", authHandler.GitHubLogin)
			authRoutes.GET("/github/callback", authHandler.GitHubCallback)
		}

		userRoutes := v1.Group("/users")
		userRoutes.Use(mw.Auth())
		{
			userRoutes.GET("/me", userHandler.GetProfile)
			userRoutes.PUT("/me", userHandler.UpdateProfile)
			userRoutes.POST("/me/email", userHandler.RequestEmailChange)
			userRoutes.PUT("/me/settings", userHandler.UpdateSettings)
			userRoutes.GET("/me/export", userHandler.ExportData)
			userRoutes.DELETE("/me", userHandler.DeleteAccount)
		}

		authProtected := v1.Group("/auth")
		authProtected.Use(mw.Auth())
		{
			authProtected.POST("/mfa/setup", authHandler.MFASetup)
			authProtected.POST("/mfa/enable", authHandler.MFAEnable)
			authProtected.POST("/mfa/disable", authHandler.MFADisable)
			authProtected.POST("/ai-consent", authHandler.RecordAIConsent)
		}

		notesRoutes := v1.Group("/notes")
		notesRoutes.Use(mw.Auth())
		{
			notesRoutes.GET("", notesHandler.List)
			notesRoutes.POST("", notesHandler.Create)
			notesRoutes.GET("/search", notesHandler.Search)
			notesRoutes.GET("/stats", notesHandler.Stats)
			notesRoutes.GET("/:id", notesHandler.Get)
			notesRoutes.PUT("/:id", notesHandler.Update)
			notesRoutes.DELETE("/:id", notesHandler.Delete)
		}

		aiRoutes := v1.Group("/ai")
		aiRoutes.Use(mw.Auth())
		aiRoutes.Use(mw.RateLimit())
		{
			aiRoutes.POST("/suggestions", aiHandler.RequestSuggestions)
			aiRoutes.GET("/jobs/:jobId", aiHandler.GetJobStatus)
			aiRoutes.GET("/jobs/:jobId/result", aiHandler.GetJobResult)
		}

		if storageHandler != nil {
			storageRoutes := v1.Group("/storage")
			storageRoutes.Use(mw.Auth())
			{
				storageRoutes.POST("/upload", storageHandler.Upload)
				storageRoutes.POST("/upload-url", storageHandler.GetUploadURL)
				storageRoutes.GET("/download-url", storageHandler.GetDownloadURL)
				storageRoutes.DELETE("/", storageHandler.Delete)
			}
		}
	}

	srv := &http.Server{
		Addr:         ":" + cfg.Server.Port,
		Handler:      router,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
	}

	go func() {
		log.Printf("Server starting on port %s", cfg.Server.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited properly")
}

func healthCheck(db *database.PostgresDB, cache *cache.RedisCache) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()

		dbErr := db.Health(ctx)
		cacheErr := cache.Health(ctx)

		status := "healthy"
		httpStatus := http.StatusOK

		if dbErr != nil || cacheErr != nil {
			status = "unhealthy"
			httpStatus = http.StatusServiceUnavailable
		}

		c.JSON(httpStatus, gin.H{
			"status": status,
			"checks": gin.H{
				"database": fmt.Sprintf("%v", dbErr == nil),
				"cache":    fmt.Sprintf("%v", cacheErr == nil),
			},
			"timestamp": time.Now().UTC(),
		})
	}
}
