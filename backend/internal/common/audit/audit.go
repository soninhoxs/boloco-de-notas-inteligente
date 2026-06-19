package audit

import (
	"encoding/json"
	"log"
	"os"
	"time"

	"github.com/gin-gonic/gin"
)

type Event struct {
	Timestamp string         `json:"timestamp"`
	Action    string         `json:"action"`
	UserID    string         `json:"user_id,omitempty"`
	IP        string         `json:"ip,omitempty"`
	RequestID string         `json:"request_id,omitempty"`
	Status    string         `json:"status"`
	Meta      map[string]any `json:"meta,omitempty"`
}

func Log(c *gin.Context, action, status, userID string, meta map[string]any) {
	ev := Event{
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Action:    action,
		UserID:    userID,
		Status:    status,
		Meta:      meta,
	}
	if c != nil {
		ev.IP = c.ClientIP()
		if rid, ok := c.Get("request_id"); ok {
			ev.RequestID = rid.(string)
		}
	}
	data, err := json.Marshal(ev)
	if err != nil {
		return
	}
	log.New(os.Stdout, "", 0).Println(string(data))
}
