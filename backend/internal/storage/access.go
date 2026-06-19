package storage

import (
	"fmt"
	"strings"

	"github.com/google/uuid"
)

// KeyBelongsToUser ensures object keys are scoped to the authenticated user.
func KeyBelongsToUser(key string, userID uuid.UUID) bool {
	prefix := userID.String() + "/"
	return strings.HasPrefix(key, prefix) && !strings.Contains(key, "..")
}

func ValidateObjectKey(key string) error {
	if key == "" {
		return fmt.Errorf("empty key")
	}
	if strings.Contains(key, "..") {
		return fmt.Errorf("invalid key")
	}
	return nil
}
