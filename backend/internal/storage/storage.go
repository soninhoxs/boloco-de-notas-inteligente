package storage

import (
	"context"
	"fmt"
	"io"
	"net/url"
	"path"
	"time"

	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"

	"github.com/diario/backend/internal/common/config"
)

type Storage struct {
	client *minio.Client
	bucket string
}

type UploadResult struct {
	Key      string `json:"key"`
	URL      string `json:"url"`
	Size     int64  `json:"size"`
	MimeType string `json:"mime_type"`
}

func NewStorage(cfg config.MinIOConfig) (*Storage, error) {
	client, err := minio.New(cfg.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
		Secure: cfg.UseSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create MinIO client: %w", err)
	}

	s := &Storage{
		client: client,
		bucket: cfg.Bucket,
	}

	if err := s.ensureBucket(context.Background()); err != nil {
		return nil, err
	}

	return s, nil
}

func (s *Storage) ensureBucket(ctx context.Context) error {
	exists, err := s.client.BucketExists(ctx, s.bucket)
	if err != nil {
		return fmt.Errorf("failed to check bucket: %w", err)
	}

	if !exists {
		if err := s.client.MakeBucket(ctx, s.bucket, minio.MakeBucketOptions{}); err != nil {
			return fmt.Errorf("failed to create bucket: %w", err)
		}
	}

	return nil
}

func (s *Storage) Upload(ctx context.Context, userID uuid.UUID, filename string, reader io.Reader, size int64, contentType string) (*UploadResult, error) {
	ext := path.Ext(filename)
	key := fmt.Sprintf("%s/%s/%s%s", userID, time.Now().Format("2006/01"), uuid.New().String(), ext)

	_, err := s.client.PutObject(ctx, s.bucket, key, reader, size, minio.PutObjectOptions{
		ContentType: contentType,
		UserMetadata: map[string]string{
			"original-filename": filename,
			"user-id":           userID.String(),
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to upload object: %w", err)
	}

	presignedURL, err := s.GetPresignedURL(ctx, key, 24*time.Hour)
	if err != nil {
		presignedURL = ""
	}

	return &UploadResult{
		Key:      key,
		URL:      presignedURL,
		Size:     size,
		MimeType: contentType,
	}, nil
}

func (s *Storage) Download(ctx context.Context, key string) (io.ReadCloser, error) {
	obj, err := s.client.GetObject(ctx, s.bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get object: %w", err)
	}

	return obj, nil
}

func (s *Storage) Delete(ctx context.Context, key string) error {
	if err := s.client.RemoveObject(ctx, s.bucket, key, minio.RemoveObjectOptions{}); err != nil {
		return fmt.Errorf("failed to delete object: %w", err)
	}

	return nil
}

func (s *Storage) GetPresignedURL(ctx context.Context, key string, expiry time.Duration) (string, error) {
	reqParams := make(url.Values)

	presignedURL, err := s.client.PresignedGetObject(ctx, s.bucket, key, expiry, reqParams)
	if err != nil {
		return "", fmt.Errorf("failed to generate presigned URL: %w", err)
	}

	return presignedURL.String(), nil
}

func (s *Storage) GetUploadPresignedURL(ctx context.Context, userID uuid.UUID, filename string, expiry time.Duration) (string, string, error) {
	ext := path.Ext(filename)
	key := fmt.Sprintf("%s/%s/%s%s", userID, time.Now().Format("2006/01"), uuid.New().String(), ext)

	presignedURL, err := s.client.PresignedPutObject(ctx, s.bucket, key, expiry)
	if err != nil {
		return "", "", fmt.Errorf("failed to generate upload URL: %w", err)
	}

	return presignedURL.String(), key, nil
}

func (s *Storage) DeleteByUser(ctx context.Context, userID uuid.UUID) error {
	prefix := userID.String() + "/"

	objectsCh := s.client.ListObjects(ctx, s.bucket, minio.ListObjectsOptions{
		Prefix:    prefix,
		Recursive: true,
	})

	for object := range objectsCh {
		if object.Err != nil {
			return fmt.Errorf("error listing objects: %w", object.Err)
		}

		if err := s.client.RemoveObject(ctx, s.bucket, object.Key, minio.RemoveObjectOptions{}); err != nil {
			return fmt.Errorf("failed to delete object %s: %w", object.Key, err)
		}
	}

	return nil
}

func (s *Storage) Health(ctx context.Context) error {
	_, err := s.client.BucketExists(ctx, s.bucket)
	return err
}
