import { combination } from 'js-combinatorics'
import { Errors } from '../../Errors'
import { findComponents } from '../findComponents'
import { FormioComponent } from '../types/FormioComponent'
import { FormioForm } from '../types/FormioForm'
/**
 * Get all select components for the given form.
 * @param Form
 */
const getSelectResources = (Form: FormioForm): FormioComponent[] => {
  const selects = findComponents(Form.components, {
    dataSrc: 'resource',
    type: 'select'
  })

  return selects
}

/**
 * Get the path of a form given it's id
 * @param param0
 */
const getRelatedFormPathById = ({
  Forms,
  id
}: {
  Forms: FormioForm[]
  id: string
}): string => {
  const form = Forms.find(
    f => String(f.id) === String(id) || String(f.id) === String(id)
  )

  if (!form) {
    throw new Error(`The form ${id} does not exist`)
  }

  return form.path
}

/**
 *
 * @param param0
 */
const createRelations = ({
  formPath,
  relatedPath,
  relatedComponent
}: {
  formPath: string
  relatedPath: string
  relatedComponent: FormioComponent
}) => {
  const baseRelation = {
    foreignKey: `${relatedComponent.path}`,
    primaryKey:
      relatedComponent.valueProperty === 'id'
        ? 'id'
        : relatedComponent.valueProperty
  }

  return {
    inverseRelation: {
      ...baseRelation,
      name: formPath,
      type: relatedComponent.inDataGrid
        ? 'hasManyEmbededDG'
        : relatedComponent.multiple
        ? 'hasManyEmbeded'
        : 'hasMany'
    },
    relation: {
      ...baseRelation,
      name: relatedPath,
      type: relatedComponent.inDataGrid
        ? 'EmbedsManyDG'
        : relatedComponent.multiple
        ? 'EmbedsMany'
        : 'belongsTo'
    }
  }
}

export const getRelations = (Forms: FormioForm[]) => {
  if (!Forms || !Array.isArray(Forms)) {
    throw Errors(null, 'No Forms were loaded')
  }

  const relations = {}
  for (const Form of Forms) {
    const relationSelectComponents = getSelectResources(Form)

    if (!relationSelectComponents || relationSelectComponents.length === 0) {
      continue
    }

    for (const relatedField of relationSelectComponents) {
      // eslint-disable-next-line no-underscore-dangle

      if (!relatedField.data.resource || relatedField.data.resource === '') {
        continue
      }
      if (relatedField.dataSrc !== 'resource') {
        continue
      }

      const relatedModelPath = getRelatedFormPathById({
        Forms,
        id: relatedField.data.resource
      })

      if (!relations[Form.path]) {
        relations[Form.path] = []
      }

      if (!relations[relatedModelPath]) {
        relations[relatedModelPath] = []
      }

      const createdRelations = createRelations({
        formPath: Form.path,
        relatedPath: relatedModelPath,
        relatedComponent: relatedField
      })

      relations[Form.path].push(createdRelations.relation)

      relations[relatedModelPath].push(createdRelations.inverseRelation)
    }

    if (
      relationSelectComponents.length <= 1 ||
      !relations[Form.path] ||
      relations[Form.path].length <= 1
    ) {
      continue
    }

    // We dont want to include N to M relations
    // from previous iterations
    const validRelations = relations[Form.path].filter(
      r => r.type !== 'belongsToMany'
    )

    // Define ManyToMany if needed

    const combinations = combination(validRelations, 2)

    combinations.forEach((c: any) => {
      const model = c[0]
      const relatedModel = c[1]
      // Define Relation
      const relation = {
        foreignKey: model.foreignKey,
        foreignKeyJoin: relatedModel.foreignKey,
        name: `${model.name}_${Form.path}_${relatedModel.name}`,
        pivotTable: Form.path,
        primaryKey: model.primaryKey,
        primaryKeyJoin: relatedModel.primaryKey,
        type: 'belongsToMany'
      }

      // Define Inverse Relation
      const inverseRelation = {
        foreignKey: relatedModel.foreignKey,
        foreignKeyJoin: model.foreignKey,
        name: `${relatedModel.name}_${Form.path}_${model.name}`,
        pivotTable: Form.path,
        primaryKey: relatedModel.primaryKey,
        primaryKeyJoin: model.primaryKey,
        type: 'belongsToMany'
      }

      relations[model.name].push(relation)
      relations[relatedModel.name].push(inverseRelation)
    })
  }
  return relations
}
