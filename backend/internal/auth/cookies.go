package auth

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/diario/backend/internal/common/config"
)

const (
	AccessCookieName  = "megabrain_access"
	RefreshCookieName = "megabrain_refresh"
)

func cookieSecure(cfg *config.Config) bool {
	return cfg.Server.Environment == "production"
}

func SetAuthCookies(c *gin.Context, cfg *config.Config, tokens *TokenPair) {
	secure := cookieSecure(cfg)
	maxAgeAccess := int(cfg.JWT.AccessExpiresIn.Seconds())
	maxAgeRefresh := int(cfg.JWT.RefreshExpiresIn.Seconds())

	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(AccessCookieName, tokens.AccessToken, maxAgeAccess, "/", "", secure, true)
	c.SetCookie(RefreshCookieName, tokens.RefreshToken, maxAgeRefresh, "/", "", secure, true)
}

func ClearAuthCookies(c *gin.Context, cfg *config.Config) {
	secure := cookieSecure(cfg)
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(AccessCookieName, "", -1, "/", "", secure, true)
	c.SetCookie(RefreshCookieName, "", -1, "/", "", secure, true)
}

func AccessTokenFromRequest(c *gin.Context, cfg *config.Config) string {
	if token, err := c.Cookie(AccessCookieName); err == nil && token != "" {
		return token
	}

	if cfg != nil && cfg.Server.Environment == "production" {
		return ""
	}

	authHeader := c.GetHeader("Authorization")
	if authHeader == "" {
		return ""
	}

	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return ""
	}

	return parts[1]
}

func RefreshTokenFromCookie(c *gin.Context) string {
	token, err := c.Cookie(RefreshCookieName)
	if err != nil {
		return ""
	}
	return token
}
