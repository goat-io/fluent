class ObjectIdsClass {
  private ObjectIdClass: any | undefined
  
  private async getObjectIdClass() {
    if (!this.ObjectIdClass) {
      const { ObjectId } = await import('bson')
      this.ObjectIdClass = ObjectId
    }
    return this.ObjectIdClass
  }
  
  /**
   *
   */
  get = async (id?: string) => {
    const ObjectId = await this.getObjectIdClass()
    return id ? new ObjectId(id) : new ObjectId()
  }

  /**
   *
   */
  getString = async (id?: string): Promise<string> => {
    const ObjectId = await this.getObjectIdClass()
    return id ? new ObjectId(id).toString() : new ObjectId().toString()
  }

  isValid = async (id: string): Promise<boolean> => {
    const ObjectId = await this.getObjectIdClass()
    return ObjectId.isValid(id)
  }
}

export const ObjectIds = new ObjectIdsClass()
