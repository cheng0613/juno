import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common'
import { ProvidersService } from './providers.service.js'

@Controller('api/models')
export class ModelsController {
  constructor(private readonly providersService: ProvidersService) {}

  @Get()
  async getModels() {
    return this.providersService.getModels(true)
  }

  @Get('all')
  async getAllModels() {
    return this.providersService.getModels(false)
  }

  @Post('custom')
  async addCustomModel(@Body() body: any) {
    await this.providersService.addCustomModel(body)
    return { success: true }
  }

  @Delete('custom/:provider/:modelId')
  async removeCustomModel(
    @Param('provider') provider: string,
    @Param('modelId') modelId: string,
  ) {
    await this.providersService.removeCustomModel(provider, modelId)
    return { success: true }
  }
}