package security

import (
	"errors"
	"regexp"
	"strings"
	"unicode/utf8"
)

const MaxInputChars = 1500

var (
	ErrInputTooShort      = errors.New("input too short")
	ErrInputTooLong       = errors.New("input too long")
	ErrPromptInjection    = errors.New("prompt injection detected")
	ErrHarmfulContent     = errors.New("harmful content detected")
)

var promptInjectionPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)ignore\s+(all\s+)?(previous|prior|above)\s+instructions`),
	regexp.MustCompile(`(?i)disregard\s+(all\s+)?(previous|prior|system)\s`),
	regexp.MustCompile(`(?i)you\s+are\s+now\s+`),
	regexp.MustCompile(`(?i)act\s+as\s+(a\s+)?`),
	regexp.MustCompile(`(?i)modo\s+(desenvolvedor|developer|admin|jailbreak)`),
	regexp.MustCompile(`(?i)ignore\s+as\s+instruções`),
	regexp.MustCompile(`(?i)esqueça\s+(todas\s+)?as\s+instruções`),
	regexp.MustCompile(`(?i)sem\s+restrições`),
	regexp.MustCompile(`(?i)without\s+restrictions`),
	regexp.MustCompile(`(?i)<\/?system>`),
	regexp.MustCompile(`(?i)\[INST\]`),
	regexp.MustCompile(`(?i)override\s+(safety|security)`),
	regexp.MustCompile(`(?i)bypass\s+(safety|filter|moderation)`),
}

var harmfulPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)\b(como|how\s+to)\b[^.?!]{0,40}\b(matar|assassinar|kill|murder)\b`),
	regexp.MustCompile(`(?i)\b(pedofil|pedófil|pedophil)\w*`),
	regexp.MustCompile(`(?i)\b(fabricar|manufacture|construir)\b[^.?!]{0,30}\b(bomba|explosivo|arma\s+de\s+fogo)\b`),
	regexp.MustCompile(`(?i)\b(criar|gerar)\s+(malware|ransomware|keylogger)\b`),
	regexp.MustCompile(`(?i)\b(como|how\s+to)\s+(hackear|invadir|break\s+into)\b`),
}

func sanitizeContent(raw string) string {
	var b strings.Builder
	for _, r := range raw {
		if r < 32 && r != '\n' && r != '\t' {
			continue
		}
		if r == 127 {
			continue
		}
		b.WriteRune(r)
	}
	return strings.Join(strings.Fields(b.String()), " ")
}

func matchesAny(text string, patterns []*regexp.Regexp) bool {
	for _, p := range patterns {
		if p.MatchString(text) {
			return true
		}
	}
	return false
}

func ValidateUserContent(raw string) (string, error) {
	content := sanitizeContent(raw)
	if utf8.RuneCountInString(content) < 3 {
		return "", ErrInputTooShort
	}
	if utf8.RuneCountInString(content) > MaxInputChars {
		return "", ErrInputTooLong
	}
	if matchesAny(content, promptInjectionPatterns) {
		return "", ErrPromptInjection
	}
	if matchesAny(content, harmfulPatterns) {
		return "", ErrHarmfulContent
	}
	return content, nil
}

func ValidateAIOutput(raw string) (string, error) {
	content := sanitizeContent(raw)
	if utf8.RuneCountInString(content) > MaxInputChars*4 {
		return "", ErrInputTooLong
	}
	if matchesAny(content, harmfulPatterns) {
		return "", ErrHarmfulContent
	}
	return content, nil
}
