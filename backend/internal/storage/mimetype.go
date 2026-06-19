package storage

import (
	"bytes"
	"fmt"
	"io"
)

var allowedMIME = map[string]bool{
	"image/jpeg":      true,
	"image/png":       true,
	"image/gif":       true,
	"image/webp":      true,
	"application/pdf": true,
}

func sniffContentType(head []byte) string {
	if len(head) >= 3 && head[0] == 0xFF && head[1] == 0xD8 && head[2] == 0xFF {
		return "image/jpeg"
	}
	if len(head) >= 8 && string(head[0:8]) == "\x89PNG\r\n\x1a\n" {
		return "image/png"
	}
	if len(head) >= 6 && (string(head[0:6]) == "GIF87a" || string(head[0:6]) == "GIF89a") {
		return "image/gif"
	}
	if len(head) >= 12 && string(head[0:4]) == "RIFF" && string(head[8:12]) == "WEBP" {
		return "image/webp"
	}
	if len(head) >= 5 && string(head[0:5]) == "%PDF-" {
		return "application/pdf"
	}
	return ""
}

func validateUploadReader(r io.Reader, declaredType string) (io.Reader, string, error) {
	head := make([]byte, 512)
	n, err := io.ReadAtLeast(r, head, 1)
	if err != nil && err != io.EOF && err != io.ErrUnexpectedEOF {
		return nil, "", fmt.Errorf("failed to read file header: %w", err)
	}
	head = head[:n]

	detected := sniffContentType(head)
	if detected == "" || !allowedMIME[detected] {
		return nil, "", fmt.Errorf("file type not allowed")
	}
	if declaredType != "" && declaredType != detected {
		return nil, "", fmt.Errorf("file type mismatch")
	}

	return io.MultiReader(bytes.NewReader(head), r), detected, nil
}
