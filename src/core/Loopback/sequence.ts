import {
  AuthenticateFn,
  AUTHENTICATION_STRATEGY_NOT_FOUND,
  AuthenticationBindings,
  USER_PROFILE_NOT_FOUND
} from '@loopback/authentication'
import { inject } from '@loopback/context'
import {
  FindRoute,
  InvokeMethod,
  ParseParams,
  Reject,
  RequestContext,
  RestBindings,
  Send,
  SequenceHandler
} from '@loopback/rest'

const SequenceActions = RestBindings.SequenceActions

export class GoatSequence implements SequenceHandler {
  constructor(
    @inject(SequenceActions.FIND_ROUTE) protected findRoute: FindRoute,
    @inject(SequenceActions.PARSE_PARAMS)
    protected parseParams: ParseParams,
    @inject(SequenceActions.INVOKE_METHOD)
    protected invoke: InvokeMethod,
    @inject(SequenceActions.SEND) public send: Send,
    @inject(SequenceActions.REJECT) public reject: Reject,
    @inject(AuthenticationBindings.AUTH_ACTION)
    protected authenticateRequest: AuthenticateFn
  ) {}

  public async handle(context: RequestContext) {
    try {
      const { request, response } = context

      const route = this.findRoute(request)

      await this.authenticateRequest(request)

      const args = await this.parseParams(request, route)

      const result = await this.invoke(route, args)

      this.send(response, result)
    } catch (error) {
      if (error.code === AUTHENTICATION_STRATEGY_NOT_FOUND || error.code === USER_PROFILE_NOT_FOUND) {
        Object.assign(error, { statusCode: 401 })
      }
      this.reject(context, error)
      return
    }
  }
}
