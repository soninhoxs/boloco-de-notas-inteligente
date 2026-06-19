package notes

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) Create(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var input CreateNoteInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid input"})
		return
	}

	note, err := h.service.Create(c.Request.Context(), userID, input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create note"})
		return
	}

	c.JSON(http.StatusCreated, note)
}

func (h *Handler) Get(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	noteID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid note ID"})
		return
	}

	note, err := h.service.Get(c.Request.Context(), noteID, userID)
	if err != nil {
		if errors.Is(err, ErrNoteNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "note not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get note"})
		return
	}

	c.JSON(http.StatusOK, note)
}

func (h *Handler) List(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	params := ListNotesParams{
		Cursor:   c.Query("cursor"),
		Limit:    limit,
		Category: c.Query("category"),
		Search:   c.Query("search"),
	}

	page, err := h.service.List(c.Request.Context(), userID, params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list notes"})
		return
	}

	c.JSON(http.StatusOK, page)
}

func (h *Handler) Update(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	noteID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid note ID"})
		return
	}

	var input UpdateNoteInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid input"})
		return
	}

	note, err := h.service.Update(c.Request.Context(), noteID, userID, input)
	if err != nil {
		if errors.Is(err, ErrNoteNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "note not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update note"})
		return
	}

	c.JSON(http.StatusOK, note)
}

func (h *Handler) Delete(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	noteID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid note ID"})
		return
	}

	if err := h.service.Delete(c.Request.Context(), noteID, userID); err != nil {
		if errors.Is(err, ErrNoteNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "note not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete note"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "note deleted successfully"})
}

func (h *Handler) Search(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "search query is required"})
		return
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	notes, err := h.service.Search(c.Request.Context(), userID, query, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to search notes"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"notes": notes})
}

func (h *Handler) Stats(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	stats, err := h.service.GetStats(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get stats"})
		return
	}

	c.JSON(http.StatusOK, stats)
}

func getUserID(c *gin.Context) (uuid.UUID, error) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		return uuid.Nil, errors.New("user ID not found in context")
	}

	return uuid.Parse(userIDStr.(string))
}
