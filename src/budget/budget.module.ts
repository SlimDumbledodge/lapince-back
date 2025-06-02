import { Module } from '@nestjs/common';
import { BudgetService } from './budget.service';
import { BudgetController } from './budget.controller';
import { DrizzleModule } from 'src/db/drizzle/drizzle.module';
import { CategoriesModule } from 'src/categories/categories.module';

@Module({
  imports: [DrizzleModule, CategoriesModule],
  controllers: [BudgetController],
  providers: [BudgetService],
  exports: [BudgetService]
})
export class BudgetModule {}
