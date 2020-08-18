import { AuthGuard } from '@nestjs/passport'
import { Injectable } from '@nestjs/common'

@Injectable()
export class GoatJWTAuthGuard extends AuthGuard('jwt') {}
