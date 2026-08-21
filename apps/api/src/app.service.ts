import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello() {
    return {
      app: 'SPulso API',
      status: 'running',
      health: '/health',
    };
  }
}
