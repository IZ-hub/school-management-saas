import { Module } from '@nestjs/common';
import { GateModule } from '../gate/gate.module';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';

@Module({
  imports: [GateModule],
  controllers: [PayrollController],
  providers: [PayrollService],
})
export class PayrollModule {}
