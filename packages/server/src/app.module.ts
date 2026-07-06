import { Module } from '@nestjs/common'
import { PiModule } from './pi/pi.module.js'
import { ProvidersModule } from './providers/providers.module.js'
import { SettingsModule } from './settings/settings.module.js'

@Module({
  imports: [PiModule, ProvidersModule, SettingsModule],
})
export class AppModule {}