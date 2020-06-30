import { Injectable, Inject } from '@nestjs/common'
import { Role } from './roles.entity'
import { RoleDtoIn, RoleDtoOut } from './roles.dto'
import { TypeOrmConnector } from '../../../../Providers/TypeOrm/TypeOrmConnector'
import { Repository } from 'typeorm'

@Injectable()
export class RoleService {
  public model: TypeOrmConnector<Role, RoleDtoIn, RoleDtoOut>
  constructor(
    @Inject('Role_REPOSITORY')
    private Roles: Repository<Role>
  ) {
    this.model = new TypeOrmConnector<Role, RoleDtoIn, RoleDtoOut>({
      repository: this.Roles
    })
  }
}
