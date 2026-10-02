import { IsIn } from 'class-validator';
import { ATTENDANCE_STATUSES, AttendanceStatus } from './save-register.dto';

/** Correct a single student's mark. Use the class register to mark a whole class. */
export class UpdateAttendanceDto {
  @IsIn(ATTENDANCE_STATUSES as unknown as string[]) status: AttendanceStatus;
}
