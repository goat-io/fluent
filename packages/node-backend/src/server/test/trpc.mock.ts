import {
  AnyRootTypes,
  RouterCaller,
  RouterRecord
} from '@trpc/server/unstable-core-do-not-import'
import { requestContext } from '../context/request.context'
import { mockedRegisteredAccountRequest } from './express.mock'
import { mockedFirebaseDecodedToken } from './firebase.mock'
import { BasicAccount } from './mock.model'

export const mockedAuthenticatedTrpcRouter = async <
  TRoot extends AnyRootTypes,
  TRecord extends RouterRecord
>({
  mockedAccount,
  createCaller
}: {
  mockedAccount?: Partial<BasicAccount>
  createCaller: RouterCaller<TRoot, TRecord>
}) => {
  const mockedRequest = mockedRegisteredAccountRequest(mockedAccount)
  const user = mockedFirebaseDecodedToken(mockedAccount)
  const ctx = requestContext(mockedRequest, user)

  return createCaller(ctx)
}
