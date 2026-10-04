import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

/**
 * Logs unexpected server errors with enough context to find them (Google Cloud Error Reporting
 * groups these automatically), then answers as Nest normally would. Expected errors (4xx) are not logged.
 */
@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost) {
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    if (status >= 500) {
      const req = host.switchToHttp().getRequest();
      const err = exception instanceof Error ? exception : new Error(String(exception));
      this.log.error(`${req?.method} ${req?.originalUrl ?? req?.url} (school ${req?.user?.schoolId ?? '-'}): ${err.message}`, err.stack);
    }
    super.catch(exception, host);
  }
}
