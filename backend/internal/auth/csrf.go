package auth

import (
	"crypto/rand"
	"encoding/base64"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/diario/backend/internal/common/config"
)

const CSRFCookieName = "megabrain_csrf"
const CSRFHeaderName = "X-CSRF-Token"

func IssueCSRFToken(c *gin.Context, cfg *config.Config) string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	token := base64.URLEncoding.EncodeToString(b)

	secure := cfg.Server.Environment == "production"
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(CSRFCookieName, token, 3600*24, "/", "", secure, false)

	return token
}

func ValidateCSRF(c *gin.Context) bool {
	cookie, err := c.Cookie(CSRFCookieName)
	if err != nil || cookie == "" {
		return false
	}
	header := c.GetHeader(CSRFHeaderName)
	return header != "" && header == cookie
}
