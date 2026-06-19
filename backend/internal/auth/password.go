package auth

import (
	"errors"
	"regexp"
	"unicode"
)

var (
	ErrWeakPassword = errors.New("password must be at least 8 characters and include a letter and a number")
)

var hasLetter = regexp.MustCompile(`[a-zA-Z]`)
var hasDigit = regexp.MustCompile(`[0-9]`)

func ValidatePassword(password string) error {
	if len(password) < 8 || len(password) > 128 {
		return ErrWeakPassword
	}
	if !hasLetter.MatchString(password) || !hasDigit.MatchString(password) {
		return ErrWeakPassword
	}
	for _, r := range password {
		if !unicode.IsPrint(r) || unicode.IsSpace(r) {
			return ErrWeakPassword
		}
	}
	return nil
}
