package user

import (
	"errors"
	"log"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/diario/backend/internal/auth"
	"github.com/diario/backend/internal/common/audit"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) GetProfile(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		c.JSON(401, gin.H{"error": "unauthorized"})
		return
	}

	user, err := h.service.GetProfile(c.Request.Context(), userID)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			c.JSON(404, gin.H{"error": "user not found"})
			return
		}
		c.JSON(500, gin.H{"error": "failed to get profile"})
		return
	}

	c.JSON(200, user)
}

func (h *Handler) UpdateProfile(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		c.JSON(401, gin.H{"error": "unauthorized"})
		return
	}

	var input UpdateProfileInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": "invalid input"})
		return
	}

	user, err := h.service.UpdateProfile(c.Request.Context(), userID, input)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			c.JSON(404, gin.H{"error": "user not found"})
			return
		}
		if errors.Is(err, auth.ErrEmailChangePending) {
			c.JSON(400, gin.H{"error": "use POST /users/me/email to change email"})
			return
		}
		c.JSON(500, gin.H{"error": "failed to update profile"})
		return
	}

	c.JSON(200, user)
}

func (h *Handler) RequestEmailChange(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		c.JSON(401, gin.H{"error": "unauthorized"})
		return
	}

	var input struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": "invalid input"})
		return
	}

	token, err := h.service.RequestEmailChange(c.Request.Context(), userID, input.Email)
	if err != nil {
		if errors.Is(err, auth.ErrUserAlreadyExists) {
			c.JSON(409, gin.H{"error": "email already in use"})
			return
		}
		c.JSON(500, gin.H{"error": "failed to request email change"})
		return
	}

	if err := h.service.SendEmailChangeVerification(input.Email, token); err != nil {
		log.Printf("email change verification failed for %s: %v", input.Email, err)
	}

	audit.Log(c, "user.email_change_request", "success", userID.String(), nil)
	verifyURL := "/verify-email-change?token=" + token
	if h.service.cfg != nil {
		verifyURL = strings.TrimRight(h.service.cfg.OAuth.FrontendURL, "/") + verifyURL
	}
	resp := gin.H{"message": "verification email sent"}
	if h.service.cfg != nil && h.service.cfg.Server.Environment != "production" {
		resp["verification_token"] = token
		resp["verify_url"] = verifyURL
	}
	c.JSON(200, resp)
}

func (h *Handler) ExportData(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		c.JSON(401, gin.H{"error": "unauthorized"})
		return
	}

	data, err := h.service.ExportData(c.Request.Context(), userID)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to export data"})
		return
	}

	audit.Log(c, "user.export", "success", userID.String(), nil)
	c.Header("Content-Disposition", `attachment; filename="megabrain-export.json"`)
	c.JSON(200, data)
}

func (h *Handler) UpdateSettings(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		c.JSON(401, gin.H{"error": "unauthorized"})
		return
	}

	var input UpdateSettingsInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(400, gin.H{"error": "invalid input"})
		return
	}

	user, err := h.service.UpdateSettings(c.Request.Context(), userID, input)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			c.JSON(404, gin.H{"error": "user not found"})
			return
		}
		if errors.Is(err, auth.ErrConsentRequired) {
			c.JSON(400, gin.H{"error": "ai consent required", "code": "ai_consent_required"})
			return
		}
		c.JSON(500, gin.H{"error": "failed to update settings"})
		return
	}

	c.JSON(200, user)
}

func (h *Handler) DeleteAccount(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		c.JSON(401, gin.H{"error": "unauthorized"})
		return
	}

	if err := h.service.DeleteAccount(c.Request.Context(), userID); err != nil {
		if errors.Is(err, ErrUserNotFound) {
			c.JSON(404, gin.H{"error": "user not found"})
			return
		}
		c.JSON(500, gin.H{"error": "failed to delete account"})
		return
	}

	audit.Log(c, "user.delete_account", "success", userID.String(), nil)
	if h.service.cfg != nil {
		auth.ClearAuthCookies(c, h.service.cfg)
	}
	c.JSON(200, gin.H{"message": "account deleted successfully"})
}

func getUserID(c *gin.Context) (uuid.UUID, error) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		return uuid.Nil, errors.New("user ID not found in context")
	}

	return uuid.Parse(userIDStr.(string))
}
