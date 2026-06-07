package app

type TagService struct {
	tags interface {
		Add(entityType, entityName, tag string) error
	}
}

func NewTagService(tags interface {
	Add(entityType, entityName, tag string) error
}) *TagService {
	return &TagService{tags: tags}
}

func (s *TagService) Add(entityType, entityName, tag string) error {
	return s.tags.Add(entityType, entityName, tag)
}
