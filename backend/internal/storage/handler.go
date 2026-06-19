package storage

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	storage *Storage
}

func NewHandler(storage *Storage) *Handler {
	return &Handler{storage: storage}
}

func (h *Handler) Upload(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file is required"})
		return
	}
	defer file.Close()

	maxSize := int64(10 * 1024 * 1024)
	if header.Size > maxSize {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file too large (max 10MB)"})
		return
	}

	declaredType := header.Header.Get("Content-Type")
	reader, contentType, err := validateUploadReader(file, declaredType)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file type not allowed"})
		return
	}

	result, err := h.storage.Upload(c.Request.Context(), userID, header.Filename, reader, header.Size, contentType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to upload file"})
		return
	}

	c.JSON(http.StatusCreated, result)
}

func (h *Handler) GetUploadURL(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var input struct {
		Filename string `json:"filename" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "filename is required"})
		return
	}

	uploadURL, key, err := h.storage.GetUploadPresignedURL(c.Request.Context(), userID, input.Filename, 15*time.Minute)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate upload URL"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"upload_url": uploadURL,
		"key":        key,
		"expires_in": 900,
	})
}

func (h *Handler) GetDownloadURL(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	key := c.Query("key")
	if err := authorizeObjectKey(key, userID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}

	downloadURL, err := h.storage.GetPresignedURL(c.Request.Context(), key, 1*time.Hour)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate download URL"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"download_url": downloadURL,
		"expires_in":   3600,
	})
}

func (h *Handler) Delete(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	key := c.Query("key")
	if err := authorizeObjectKey(key, userID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied"})
		return
	}

	if err := h.storage.Delete(c.Request.Context(), key); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete file"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "file deleted successfully"})
}

func authorizeObjectKey(key string, userID uuid.UUID) error {
	if err := ValidateObjectKey(key); err != nil {
		return err
	}
	if !KeyBelongsToUser(key, userID) {
		return errors.New("forbidden")
	}
	return nil
}

func getUserID(c *gin.Context) (uuid.UUID, error) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		return uuid.Nil, errors.New("user ID not found in context")
	}

	return uuid.Parse(userIDStr.(string))
}
