import { inject } from '@loopback/core'
import { post, Request, requestBody, Response, RestBindings } from '@loopback/rest'
import { file, Providers, Upload } from '../../Uploads/Upload'

const openAPITag = 'Uploads'
export class FileUploadController {
  /**
   *
   * @param request
   * @param response
   */
  @post('/file/upload', {
    responses: {
      '200': {
        content: {
          'application/json': {
            schema: {
              type: 'string'
            }
          }
        },
        description: 'File Upload'
      }
    },
    tags: [openAPITag]
  })
  public async upload(
    @file()
    request: Request,
    @inject(RestBindings.Http.RESPONSE) response: Response
  ): Promise<object> {
    const upload = await new Upload(Providers.Local, request, response).file({ folder: 'myfolder' })
    return upload
  }
}
