import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
import { World } from './graphql.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  readUserWorld(user: string): World {
    return this.appService.readUserWorld(user);
  }
}
