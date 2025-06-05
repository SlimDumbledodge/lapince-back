import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common';
import * as schema from '../db/schema';
import { z } from 'zod';

export type UserEntity = schema.User & {accountId: string, accountName: string, amount: number}

export const User = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      throw new BadRequestException('User not found');
    }

    const schema = z.string().uuid();
    const accountId = schema.safeParse(user.id);
    if (!accountId.success) {
      throw new BadRequestException('Invalid account ID');
    }

    return user as UserEntity;
  },
);