import { AuthenticationStrategy, UserProfileFactory } from '@loopback/authentication'
import { RedirectRoute, Request } from '@loopback/rest'
import { UserProfile } from '@loopback/security'
import { Strategy } from 'passport'
/**
 * Adapter class to invoke passport-strategy
 *   1. provides express dependencies to the passport strategies
 *   2. provides shimming of requests for passport authentication
 *   3. provides life-cycle similar to express to the passport-strategy
 *   4. provides state methods to the strategy instance
 * see: https://github.com/jaredhanson/passport
 */
export declare class StrategyAdapter<U> implements AuthenticationStrategy {
  private readonly strategy
  readonly name: string
  private userProfileFactory
  /**
   * @param strategy instance of a class which implements a
   * {@link http://passportjs.org/ | passport-strategy}.
   */
  constructor(strategy: Strategy, name: string, userProfileFactory?: UserProfileFactory<U>)
  /**
   * The function to invoke the contained passport strategy.
   *     1. Create an instance of the strategy
   *     2. add success and failure state handlers
   *     3. authenticate using the strategy
   * @param request The incoming request.
   */
  authenticate(request: Request): Promise<UserProfile | undefined>
}
