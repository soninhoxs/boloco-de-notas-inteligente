package auth

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"
)

func (s *Service) RevokeAllUserSessions(ctx context.Context, userID uuid.UUID) error {
	return s.cache.Set(
		ctx,
		"sessions_revoked:"+userID.String(),
		fmt.Sprintf("%d", time.Now().Unix()),
		s.cfg.JWT.RefreshExpiresIn,
	)
}

func (s *Service) IsSessionRevoked(ctx context.Context, userID uuid.UUID, issuedAt int64) (bool, error) {
	val, err := s.cache.Get(ctx, "sessions_revoked:"+userID.String())
	if err != nil {
		return false, nil
	}
	revokedAt, err := strconv.ParseInt(val, 10, 64)
	if err != nil {
		return false, nil
	}
	return issuedAt <= revokedAt, nil
}
