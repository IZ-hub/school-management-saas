import { Body, Controller, Headers, Ip, Post } from '@nestjs/common';
import { SupportService } from './support.service';
import { CreateSupportMessageDto } from './dto/create-support-message.dto';

/** Public: visitors to the site send questions from the support chat widget. */
@Controller('support')
export class SupportController {
  constructor(private readonly service: SupportService) {}

  @Post('messages')
  async create(
    @Body() dto: CreateSupportMessageDto,
    @Ip() ip: string,
    @Headers('x-forwarded-for') forwardedFor?: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    // Behind Firebase Hosting the socket address is the proxy; the visitor is the first forwarded address.
    const visitorKey = forwardedFor?.split(',')[0].trim() || ip;
    const data = await this.service.create(dto, visitorKey, userAgent);
    return { data };
  }
}
