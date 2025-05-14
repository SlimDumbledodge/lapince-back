import { BadRequestException } from '@nestjs/common';
import { ZodValidationPipe } from './zod-validation.pipe';
import { z } from 'zod';

describe('ZodValidationPipe', () => {
  let pipe: ZodValidationPipe;
  const schema = z.object({
    name: z.string().min(1),
    age: z.number().min(0),
  }).strict();

  beforeEach(() => {
    pipe = new ZodValidationPipe(schema);
  });

  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });

  it('should validate and transform valid data', () => {
    const validData = {
      name: 'John',
      age: 25,
    };

    const result = pipe.transform(validData, { type: 'body', metatype: Object });
    expect(result).toEqual(validData);
  });

  it('should throw BadRequestException for invalid data type', () => {
    const invalidData = {
      name: '',  // Invalid: empty string
      age: -1,   // Invalid: negative number
    };

    expect(() => {
      pipe.transform(invalidData, { type: 'body', metatype: Object });
    }).toThrow(BadRequestException);
  });

  it('should throw BadRequestException for extra properties', () => {
    const dataWithExtra = {
      name: 'John',
      age: 25,
      extra: 'field', // Invalid: unknown field (strict mode)
    };

    expect(() => {
      pipe.transform(dataWithExtra, { type: 'body', metatype: Object });
    }).toThrow(BadRequestException);
  });

  it('should throw BadRequestException for missing required properties', () => {
    const incompleteData = {
      name: 'John',
      // age is missing
    };

    expect(() => {
      pipe.transform(incompleteData, { type: 'body', metatype: Object });
    }).toThrow(BadRequestException);
  });
}); 