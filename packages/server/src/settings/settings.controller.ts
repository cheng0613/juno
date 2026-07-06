import { Controller, Get, Put, Body } from '@nestjs/common'
import { SettingsService } from './settings.service.js'

@Controller('api/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getSettings(): Promise<Record<string, unknown>> {
    return this.settingsService.getAll()
  }

  @Put('default-model')
  async setDefaultModel(@Body() body: { provider: string; modelId: string; thinkingLevel?: string }) {
    await this.settingsService.setDefaultModel(body.provider, body.modelId)
    if (body.thinkingLevel) {
      this.settingsService.setThinkingLevel(body.thinkingLevel as any)
    }
    return { success: true }
  }

  @Put('enabled-models')
  async setEnabledModels(@Body() body: { patterns: string[] }) {
    this.settingsService.setEnabledModels(body.patterns)
    return { success: true }
  }
}