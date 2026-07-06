import { Module } from '@nestjs/common'
import { SettingsController } from './settings.controller.js'
import { SettingsService } from './settings.service.js'
import { PiModule } from '../pi/pi.module.js'

@Module({
  imports: [PiModule],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}