import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseExtensionsService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseExtensionsService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    if (this.dataSource.options.type !== 'postgres') {
      return;
    }

    try {
      await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS unaccent;');
    } catch (error) {
      this.logger.error(
        'No se pudo habilitar la extension unaccent en PostgreSQL',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
