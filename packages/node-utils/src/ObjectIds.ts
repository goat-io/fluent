class ObjectIdsClass {
  /**
   *
   */
  get = async (id?: string) => {
    const { ObjectId } = await import('bson')

    if (id) {
      return new ObjectId(id)
    }
    return new ObjectId()
  }

  /**
   *
   */
  getString = async (id?: string): Promise<string> => {
    const { ObjectId } = await import('bson')

    if (id) {
      return new ObjectId(id).toString()
    }
    return new ObjectId().toString()
  }

  isValid = async (id: string): Promise<boolean> => {
    const { ObjectId } = await import('bson')
    return ObjectId.isValid(id)
  }
}

export const ObjectIds = new ObjectIdsClass()
