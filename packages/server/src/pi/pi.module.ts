import { Module } from '@nestjs/common'
import { PiService } from './pi.service.js'
import { PiGateway } from './pi.gateway.js'

@Module({
  providers: [PiService, PiGateway],
  exports: [PiService],
})
export class PiModule {}