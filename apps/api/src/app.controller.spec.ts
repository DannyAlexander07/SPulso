import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('describe el servicio y su endpoint de salud', () => {
      expect(appController.getHello()).toEqual({
        app: 'SPulso API',
        health: '/health',
        status: 'running',
      });
    });
  });
});
