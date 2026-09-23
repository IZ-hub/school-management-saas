export interface TimetableDocument {
  id: string;
  schoolId: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  room: string;
  day: string; // Monday, Tuesday, etc.
  startTime: string; // "08:00"
  endTime: string;   // "09:00"
  createdAt: Date;
  updatedAt: Date;
}
