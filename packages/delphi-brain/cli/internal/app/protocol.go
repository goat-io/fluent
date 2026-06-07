package app

import "github.com/goat-io/delphi-brain/cli/internal/domain"

type ProtocolService struct {
	protocols domain.ProtocolRepository
}

func NewProtocolService(protocols domain.ProtocolRepository) *ProtocolService {
	return &ProtocolService{protocols: protocols}
}

func (s *ProtocolService) Add(proto domain.Protocol) error {
	return s.protocols.Upsert(proto)
}

func (s *ProtocolService) List() ([]domain.ProtocolSummary, error) {
	return s.protocols.List()
}
