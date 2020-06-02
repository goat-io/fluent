import { Collection } from 'fireorm'

@Collection()
export class Todo {
  id: string
  text: string
  done: boolean
}
