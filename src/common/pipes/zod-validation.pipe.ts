import { ArgumentMetadata, PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      // Affiche les erreurs détaillées pour faciliter le débogage
      // console.error('Validation errors:', result.error.format());

      throw new BadRequestException({
        message: 'Validation failed',
        errors: result.error.format(), // Renvoie les erreurs détaillées
      });
    }

    return result.data;
  }
}