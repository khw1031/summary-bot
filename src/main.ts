import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getBotToken } from 'nestjs-telegraf';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const bot = app.get(getBotToken());
  app.use(bot.webhookCallback('/api/telegram-webhook'));

  const port = process.env.PORT || 3000;
  await app.listen(port);
}
bootstrap();
