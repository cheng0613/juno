import { Injectable } from '@nestjs/common'
import { SettingsManager } from '@earendil-works/pi-coding-agent'
import { PiService } from '../pi/pi.service.js'

@Injectable()
export class SettingsService {
  constructor(private readonly piService: PiService) {}

  get sm(): SettingsManager { return this.piService.settings }

  getAll(): Record<string, unknown> {
    return {
      defaultProvider: this.sm.getDefaultProvider(),
      defaultModel: this.sm.getDefaultModel(),
      defaultThinkingLevel: this.sm.getDefaultThinkingLevel(),
      enabledModels: this.sm.getEnabledModels(),
      transport: this.sm.getTransport(),
    }
  }

  async setDefaultModel(provider: string, modelId: string) {
    this.sm.setDefaultModelAndProvider(provider, modelId)
    await this.sm.flush()
  }

  setThinkingLevel(level: 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh') {
    this.sm.setDefaultThinkingLevel(level)
  }

  setEnabledModels(patterns: string[]) {
    this.sm.setEnabledModels(patterns)
  }
}