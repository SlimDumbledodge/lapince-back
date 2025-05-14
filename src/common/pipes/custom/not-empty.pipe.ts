import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class NotEmptyPipe implements PipeTransform {
  transform(value: any) {
    if (value === null || value === undefined || value === '') {
      throw new BadRequestException('Value cannot be empty');
    }
    return value;
  }
}