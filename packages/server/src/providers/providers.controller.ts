import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common'
import { ProvidersService } from './providers.service.js'

@Controller('api/providers')
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Get()
  async getProviders() {
    return this.providersService.getProviders()
  }

  @Get(':name/status')
  async getAuthStatus(@Param('name') name: string) {
    return this.providersService.getAuthStatus(name)
  }

  @Post(':name/credentials')
  async setApiKey(
    @Param('name') name: string,
    @Body() body: { key: string; env?: Record<string, string> },
  ) {
    await this.providersService.setApiKey(name, body.key, body.env)
    return { success: true }
  }

  @Delete(':name/credentials')
  async removeApiKey(@Param('name') name: string) {
    await this.providersService.removeApiKey(name)
    return { success: true }
  }

  @Post(':name/test')
  async testConnection(@Param('name') name: string) {
    return this.providersService.testConnection(name)
  }

  @Get(':name/endpoint')
  async getEndpoint(@Param('name') name: string) {
    return this.providersService.getEndpoint(name)
  }

  @Put(':name/endpoint')
  async setEndpoint(
    @Param('name') name: string,
    @Body() body: { baseUrl?: string; api?: string; headers?: Record<string, string> },
  ) {
    await this.providersService.setEndpoint(name, body)
    return { success: true }
  }

  @Delete(':name/endpoint')
  async removeEndpoint(@Param('name') name: string) {
    await this.providersService.removeEndpoint(name)
    return { success: true }
  }

  @Post('custom')
  async addCustomProvider(
    @Body() body: {
      name: string
      displayName?: string
      baseUrl: string
      api: string
      apiKey?: string
      models?: { id: string; name?: string; contextWindow?: number; maxTokens?: number }[]
    },
  ) {
    await this.providersService.addCustomProvider(body)
    return { success: true }
  }
}