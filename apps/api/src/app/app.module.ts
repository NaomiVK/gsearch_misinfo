import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Services
import {
  CacheService,
  SearchConsoleService,
  ScamDetectionService,
  ComparisonService,
  TrendsService,
} from '../services';

// Controllers
import {
  AnalyticsController,
  ScamsController,
  ComparisonController,
  TrendsController,
  ExportController,
} from '../controllers';

@Module({
  imports: [],
  controllers: [
    AppController,
    AnalyticsController,
    ScamsController,
    ComparisonController,
    TrendsController,
    ExportController,
  ],
  providers: [
    AppService,
    CacheService,
    SearchConsoleService,
    ScamDetectionService,
    ComparisonService,
    TrendsService,
  ],
})
export class AppModule {}
