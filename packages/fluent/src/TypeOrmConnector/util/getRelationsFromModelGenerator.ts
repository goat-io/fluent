import { Repository } from 'typeorm'

export interface GeneratedModelRelations {
  relations: {
    [key: string]: {
      isOneToMany: boolean
      isManyToOne: boolean
      isManyToMany: boolean
      inverseSidePropertyRelationPath?: string
      inverseSidePropertyPath?: string
      propertyName: string
      entityName: string
      tableName: string
      targetClass: string
      joinColumns: any[]
      inverseJoinColumns: any[]
    }
  }
}

export const getRelationsFromModelGenerator = (
  typeOrmRepo: Repository<any>
): GeneratedModelRelations => {
  const relations = {}
  for (const relation of typeOrmRepo.metadata.relations) {
    const pPath = relation.inverseRelation?.joinColumns[0]
    relations[relation.propertyName] = {
      isOneToMany: relation.isOneToMany,
      isManyToOne: relation.isManyToOne,
      isManyToMany: relation.isManyToMany,
      inverseSidePropertyRelationPath: relation.inverseSidePropertyPath,
      inverseSidePropertyPath: pPath?.propertyPath,
      propertyName: relation.propertyName,
      entityName: relation.inverseEntityMetadata.name,
      tableName: relation.inverseEntityMetadata.tableName,
      targetClass: relation.inverseEntityMetadata.target,
      joinColumns: relation.joinColumns,
      inverseJoinColumns: relation.inverseJoinColumns
    }
  }
  return {
    relations
  }
}
