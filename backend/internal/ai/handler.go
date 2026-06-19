package ai

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) RequestSuggestions(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var input RequestSuggestionsInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid input"})
		return
	}

	job, err := h.service.RequestSuggestions(c.Request.Context(), userID, input)
	if err != nil {
		if errors.Is(err, ErrRateLimitExceeded) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "rate limit exceeded",
				"retry_after": "1h",
			})
			return
		}
		if errors.Is(err, ErrProviderNotFound) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "AI provider not configured"})
			return
		}
		if errors.Is(err, ErrContentRejected) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "content rejected by security policy"})
			return
		}
		if errors.Is(err, ErrAIConsentRequired) {
			c.JSON(http.StatusForbidden, gin.H{"error": "ai consent required", "code": "ai_consent_required"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to request suggestions"})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{
		"job_id":  job.ID,
		"status":  job.Status,
		"message": "AI suggestion request queued",
	})
}

func (h *Handler) GetJobStatus(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	jobID := c.Param("jobId")
	if jobID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "job ID is required"})
		return
	}

	job, err := h.service.GetJobStatus(c.Request.Context(), userID, jobID)
	if err != nil {
		if errors.Is(err, ErrJobNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "job not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get job status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"job_id":     job.ID,
		"status":     job.Status,
		"created_at": job.CreatedAt,
		"updated_at": job.UpdatedAt,
	})
}

func (h *Handler) GetJobResult(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	jobID := c.Param("jobId")
	if jobID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "job ID is required"})
		return
	}

	result, err := h.service.GetJobResult(c.Request.Context(), userID, jobID)
	if err != nil {
		if errors.Is(err, ErrJobNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "job not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get job result"})
		return
	}

	c.JSON(http.StatusOK, result)
}

func getUserID(c *gin.Context) (uuid.UUID, error) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		return uuid.Nil, errors.New("user ID not found in context")
	}

	return uuid.Parse(userIDStr.(string))
}
