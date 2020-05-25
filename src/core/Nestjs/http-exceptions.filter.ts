import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus
} from '@nestjs/common'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse()
    const request = ctx.getRequest()

    // this.logger.error(exception)
    console.log('exception', exception)
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : Number(exception.status) || HttpStatus.INTERNAL_SERVER_ERROR

    /* If we are using Express
    response.status().json({
      status,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url
    })
    */

    // If we are using Fastify
    response.code(status).send({
      status,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: exception.message
    })
  }
}
