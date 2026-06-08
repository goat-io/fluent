package app

import "github.com/goat-io/delphi-brain/cli/internal/domain"

type ServiceService struct {
	services domain.ServiceRepository
}

func NewServiceService(services domain.ServiceRepository) *ServiceService {
	return &ServiceService{services: services}
}

func (s *ServiceService) Add(svc domain.Service) error {
	return s.services.Upsert(svc)
}

func (s *ServiceService) List(filter domain.ServiceFilter) ([]domain.ServiceSummary, error) {
	return s.services.List(filter)
}

func (s *ServiceService) Get(name string) (*domain.Service, error) {
	return s.services.Get(name)
}
