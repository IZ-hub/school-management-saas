import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { GateController } from './gate.controller';
import { GateService } from './gate.service';

@Module({
  imports: [AttendanceModule],
  controllers: [GateController],
  providers: [GateService],
})
export class GateModule {}
