package auth

import (
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/diario/backend/internal/common/audit"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) CSRFToken(c *gin.Context) {
	token := IssueCSRFToken(c, h.service.cfg)
	c.JSON(http.StatusOK, gin.H{"csrf_token": token})
}

func (h *Handler) Register(c *gin.Context) {
	var input RegisterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid input"})
		return
	}

	user, _, verifyToken, err := h.service.Register(c.Request.Context(), input)
	if err != nil {
		audit.Log(c, "auth.register", "failure", "", nil)
		if errors.Is(err, ErrConsentRequired) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "consentimento LGPD obrigatório"})
			return
		}
		if errors.Is(err, ErrUserAlreadyExists) {
			c.JSON(http.StatusConflict, gin.H{"error": "user already exists"})
			return
		}
		if errors.Is(err, ErrWeakPassword) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "senha fraca: mínimo 8 caracteres, letra e número"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to register user"})
		return
	}

	audit.Log(c, "auth.register", "success", user.ID.String(), nil)
	if err := h.service.SendVerificationEmail(user.Email, verifyToken); err != nil {
		log.Printf("verification email failed for %s: %v", user.Email, err)
	}
	resp := gin.H{
		"user":                        user,
		"email_verification_required": true,
		"message":                     "verifique seu e-mail para ativar a conta",
	}
	if h.service.cfg.Server.Environment != "production" {
		resp["verification_token"] = verifyToken
		resp["verify_url"] = h.service.FrontendURL("/verify-email?token=" + verifyToken)
	}
	c.JSON(http.StatusCreated, resp)
}

func (h *Handler) Login(c *gin.Context) {
	var input LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid input"})
		return
	}

	user, tokens, mfaToken, err := h.service.Login(c.Request.Context(), input)
	if err != nil {
		audit.Log(c, "auth.login", "failure", "", map[string]any{"email": input.Email})
		if errors.Is(err, ErrInvalidCredentials) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
			return
		}
		if errors.Is(err, ErrEmailNotVerified) {
			c.JSON(http.StatusForbidden, gin.H{"error": "email not verified", "code": "email_not_verified"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to login"})
		return
	}

	if mfaToken != "" {
		audit.Log(c, "auth.login", "mfa_required", user.ID.String(), nil)
		c.JSON(http.StatusOK, gin.H{"mfa_required": true, "mfa_token": mfaToken})
		return
	}

	SetAuthCookies(c, h.service.cfg, tokens)
	audit.Log(c, "auth.login", "success", user.ID.String(), nil)
	c.JSON(http.StatusOK, gin.H{"user": user})
}

func (h *Handler) MFALogin(c *gin.Context) {
	var input MFALoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid input"})
		return
	}

	user, tokens, err := h.service.CompleteMFALogin(c.Request.Context(), input.MFAToken, input.Code)
	if err != nil {
		audit.Log(c, "auth.mfa_login", "failure", "", nil)
		if errors.Is(err, ErrMFAInvalid) || errors.Is(err, ErrMFATokenInvalid) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid mfa code"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to complete mfa login"})
		return
	}

	SetAuthCookies(c, h.service.cfg, tokens)
	audit.Log(c, "auth.mfa_login", "success", user.ID.String(), nil)
	c.JSON(http.StatusOK, gin.H{"user": user})
}

func (h *Handler) MFASetup(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	setup, err := h.service.BeginMFASetup(c.Request.Context(), userID)
	if err != nil {
		if errors.Is(err, ErrMFAAlreadyActive) {
			c.JSON(http.StatusConflict, gin.H{"error": "mfa already enabled"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start mfa setup"})
		return
	}
	c.JSON(http.StatusOK, setup)
}

func (h *Handler) MFAEnable(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var input MFAEnableInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid input"})
		return
	}

	if err := h.service.EnableMFA(c.Request.Context(), userID, input.Code); err != nil {
		if errors.Is(err, ErrMFAInvalid) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid mfa code"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to enable mfa"})
		return
	}
	audit.Log(c, "auth.mfa_enable", "success", userID.String(), nil)
	c.JSON(http.StatusOK, gin.H{"message": "mfa enabled"})
}

func (h *Handler) MFADisable(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var input MFADisableInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid input"})
		return
	}

	if err := h.service.DisableMFA(c.Request.Context(), userID, input.Code, input.Password); err != nil {
		if errors.Is(err, ErrMFAInvalid) || errors.Is(err, ErrInvalidCredentials) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid credentials or mfa code"})
			return
		}
		if errors.Is(err, ErrMFANotEnabled) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "mfa not enabled"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to disable mfa"})
		return
	}
	audit.Log(c, "auth.mfa_disable", "success", userID.String(), nil)
	c.JSON(http.StatusOK, gin.H{"message": "mfa disabled"})
}

func (h *Handler) VerifyEmail(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid token"})
		return
	}
	if err := h.service.VerifyEmail(c.Request.Context(), token); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid or expired verification token"})
		return
	}
	audit.Log(c, "auth.verify_email", "success", "", nil)
	c.JSON(http.StatusOK, gin.H{"message": "email verified"})
}

func (h *Handler) VerifyEmailChange(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid token"})
		return
	}
	if err := h.service.ConfirmEmailChange(c.Request.Context(), token); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid or expired verification token"})
		return
	}
	audit.Log(c, "auth.verify_email_change", "success", "", nil)
	c.JSON(http.StatusOK, gin.H{"message": "email updated, please login again"})
}

func (h *Handler) ResendVerification(c *gin.Context) {
	var input struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid input"})
		return
	}

	user, err := h.service.repo.FindByEmail(c.Request.Context(), input.Email)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "if the email exists, a verification link was sent"})
		return
	}
	if user.EmailVerified {
		c.JSON(http.StatusOK, gin.H{"message": "email already verified"})
		return
	}

	token, err := h.service.CreateEmailVerificationToken(c.Request.Context(), user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create verification token"})
		return
	}

	if err := h.service.SendVerificationEmail(user.Email, token); err != nil {
		log.Printf("resend verification email failed for %s: %v", user.Email, err)
	}

	resp := gin.H{"message": "verification link sent"}
	if h.service.cfg.Server.Environment != "production" {
		resp["verification_token"] = token
		resp["verify_url"] = h.service.FrontendURL("/verify-email?token=" + token)
	}
	c.JSON(http.StatusOK, resp)
}

func (h *Handler) RecordAIConsent(c *gin.Context) {
	userID, err := getUserID(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var input AIConsentInput
	if err := c.ShouldBindJSON(&input); err != nil || !input.ConsentAI {
		c.JSON(http.StatusBadRequest, gin.H{"error": "consentimento de IA obrigatório"})
		return
	}
	if input.ConsentVersion != h.service.cfg.OAuth.CurrentConsentVersion {
		c.JSON(http.StatusBadRequest, gin.H{"error": "versão de consentimento inválida"})
		return
	}

	if err := h.service.RecordAIConsent(c.Request.Context(), userID, input.ConsentVersion); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to record consent"})
		return
	}
	audit.Log(c, "auth.ai_consent", "success", userID.String(), nil)
	c.JSON(http.StatusOK, gin.H{"message": "ai consent recorded"})
}

func (h *Handler) RefreshToken(c *gin.Context) {
	refreshToken := RefreshTokenFromCookie(c)
	if refreshToken == "" {
		var input RefreshInput
		if err := c.ShouldBindJSON(&input); err != nil || input.RefreshToken == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid input"})
			return
		}
		refreshToken = input.RefreshToken
	}

	tokens, err := h.service.RefreshToken(c.Request.Context(), refreshToken)
	if err != nil {
		if errors.Is(err, ErrInvalidToken) || errors.Is(err, ErrTokenExpired) || errors.Is(err, ErrTokenReuse) {
			ClearAuthCookies(c, h.service.cfg)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired refresh token"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to refresh token"})
		return
	}

	SetAuthCookies(c, h.service.cfg, tokens)
	c.JSON(http.StatusOK, gin.H{"message": "session refreshed"})
}

func (h *Handler) Logout(c *gin.Context) {
	accessToken := AccessTokenFromRequest(c, h.service.cfg)
	refreshToken := RefreshTokenFromCookie(c)
	if refreshToken == "" {
		var input struct {
			RefreshToken string `json:"refresh_token"`
		}
		_ = c.ShouldBindJSON(&input)
		refreshToken = input.RefreshToken
	}

	userID, _ := c.Get("user_id")
	if err := h.service.Logout(c.Request.Context(), accessToken, refreshToken); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to logout"})
		return
	}

	ClearAuthCookies(c, h.service.cfg)
	audit.Log(c, "auth.logout", "success", stringifyUserID(userID), nil)
	c.JSON(http.StatusOK, gin.H{"message": "logged out successfully"})
}

func (h *Handler) OAuthExchange(c *gin.Context) {
	var input struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid input"})
		return
	}

	tokens, err := h.service.ExchangeOAuthCode(c.Request.Context(), input.Code)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired oauth code"})
		return
	}

	SetAuthCookies(c, h.service.cfg, tokens)
	audit.Log(c, "auth.oauth_exchange", "success", "", nil)
	c.JSON(http.StatusOK, gin.H{"message": "authenticated"})
}

func (h *Handler) OAuthBegin(c *gin.Context, provider string) {
	withConsent := c.Query("consent") == "1"

	authURL, err := h.service.BeginOAuth(c.Request.Context(), provider, withConsent)
	if err != nil {
		if errors.Is(err, ErrOAuthNotConfigured) {
			c.Redirect(http.StatusFound, h.service.FrontendLoginURL("?error=oauth_not_configured"))
			return
		}
		c.Redirect(http.StatusFound, h.service.FrontendLoginURL("?error=oauth"))
		return
	}

	c.Redirect(http.StatusFound, authURL)
}

func (h *Handler) GoogleLogin(c *gin.Context) {
	h.OAuthBegin(c, "google")
}

func (h *Handler) GitHubLogin(c *gin.Context) {
	h.OAuthBegin(c, "github")
}

func (h *Handler) OAuthCallback(c *gin.Context, provider string) {
	code := c.Query("code")
	state := c.Query("state")
	if code == "" || state == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "callback OAuth inválido"})
		return
	}

	_, tokens, err := h.service.CompleteOAuth(c.Request.Context(), provider, code, state)
	if err != nil {
		if errors.Is(err, ErrConsentRequired) {
			c.Redirect(http.StatusFound, h.service.FrontendLoginURL("?error=oauth_consent"))
			return
		}
		if errors.Is(err, ErrOAuthEmailInUse) {
			c.Redirect(http.StatusFound, h.service.FrontendLoginURL("?error=oauth_email_in_use"))
			return
		}
		c.Redirect(http.StatusFound, h.service.FrontendLoginURL("?error=oauth"))
		return
	}

	exchangeCode, err := h.service.CreateOAuthCallbackCode(c.Request.Context(), tokens)
	if err != nil {
		c.Redirect(http.StatusFound, h.service.FrontendLoginURL("?error=oauth"))
		return
	}

	audit.Log(c, "auth.oauth_callback", "success", "", map[string]any{"provider": provider})
	c.Redirect(http.StatusFound, h.service.FrontendCallbackURL(exchangeCode))
}

func (h *Handler) GoogleCallback(c *gin.Context) {
	h.OAuthCallback(c, "google")
}

func (h *Handler) GitHubCallback(c *gin.Context) {
	h.OAuthCallback(c, "github")
}

func getUserID(c *gin.Context) (uuid.UUID, error) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		return uuid.Nil, errors.New("user ID not found")
	}
	return uuid.Parse(userIDStr.(string))
}

func stringifyUserID(userID any) string {
	if userID == nil {
		return ""
	}
	if s, ok := userID.(string); ok {
		return s
	}
	return ""
}
