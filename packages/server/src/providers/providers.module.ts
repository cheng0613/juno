import { Module } from '@nestjs/common'
import { ProvidersController } from './providers.controller.js'
import { ModelsController } from './models.controller.js'
import { ProvidersService } from './providers.service.js'
import { PiModule } from '../pi/pi.module.js'

@Module({
  imports: [PiModule],
  controllers: [ProvidersController, ModelsController],
  providers: [ProvidersService],
})
export class ProvidersModule {}