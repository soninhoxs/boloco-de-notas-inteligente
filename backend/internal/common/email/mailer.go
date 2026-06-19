package email

import (
	"fmt"
	"net/smtp"
	"strings"

	"github.com/diario/backend/internal/common/config"
)

type Mailer struct {
	cfg config.SMTPConfig
}

func NewMailer(cfg config.SMTPConfig) *Mailer {
	return &Mailer{cfg: cfg}
}

func (m *Mailer) Enabled() bool {
	return m.cfg.Host != "" && m.cfg.From != ""
}

func (m *Mailer) SendVerification(to, verifyURL string) error {
	subject := "Confirme seu e-mail — Mega Brain"
	body := fmt.Sprintf(`Olá,

Confirme seu e-mail para ativar sua conta no Mega Brain:

%s

Se você não criou esta conta, ignore esta mensagem.

— Mega Brain
`, verifyURL)
	return m.send(to, subject, body)
}

func (m *Mailer) SendEmailChange(to, verifyURL string) error {
	subject := "Confirme a troca de e-mail — Mega Brain"
	body := fmt.Sprintf(`Olá,

Confirme a alteração do seu e-mail no Mega Brain:

%s

Se você não solicitou esta alteração, ignore esta mensagem e altere sua senha.

— Mega Brain
`, verifyURL)
	return m.send(to, subject, body)
}

func (m *Mailer) send(to, subject, body string) error {
	if !m.Enabled() {
		return fmt.Errorf("smtp not configured")
	}

	addr := fmt.Sprintf("%s:%d", m.cfg.Host, m.cfg.Port)
	from := m.cfg.From

	msg := strings.Join([]string{
		"From: " + from,
		"To: " + to,
		"Subject: " + subject,
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"",
		body,
	}, "\r\n")

	var auth smtp.Auth
	if m.cfg.Username != "" {
		auth = smtp.PlainAuth("", m.cfg.Username, m.cfg.Password, m.cfg.Host)
	}

	return smtp.SendMail(addr, auth, from, []string{to}, []byte(msg))
}
