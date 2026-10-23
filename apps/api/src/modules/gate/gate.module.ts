import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { GateController } from './gate.controller';
import { GateService } from './gate.service';
import { StaffClockService } from './staff-clock.service';

@Module({
  imports: [AttendanceModule],
  controllers: [GateController],
  providers: [GateService, StaffClockService],
})
export class GateModule {}
