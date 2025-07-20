import { GoatEntity } from './entities/goat.entity'

export const flock: GoatEntity[] = [
  {
    name: 'Goatee',
    age: 12,
    breed: {
      type: 'Alpine',
      family: 'Bovidae'
    }
  },
  {
    name: 'Billy',
    age: 8,
    breed: {
      type: 'Nubian',
      family: 'Bovidae'
    }
  },
  {
    name: 'Nanny',
    age: 15,
    breed: {
      type: 'Boer',
      family: 'Bovidae'
    }
  },
  {
    name: 'Goatee',
    age: 10,
    breed: {
      type: 'Angora',
      family: 'Bovidae'
    }
  }
]