import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module.js'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.enableCors({
    origin: ['http://localhost:5173', 'http://localhost:4173'],
    credentials: true,
  })

  const port = process.env.PORT || 8000
  await app.listen(port)
  console.log(`Juno server running on http://localhost:${port}`)
}

bootstrap()