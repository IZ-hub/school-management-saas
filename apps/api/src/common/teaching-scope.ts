import { ForbiddenException } from '@nestjs/common';
import { JwtPayload } from './decorators/current-user.decorator';

/**
 * What a signed-in person may do in academics. Admins can do everything; a teacher is limited to the
 * classes and subjects they're given in Class subjects, and the classes they are form teacher of.
 */
export class TeachingScope {
  constructor(
    readonly all: boolean,
    readonly teacherId: string | null,
    /** "classId|subjectId" pairs the teacher teaches. */
    readonly subjects: Set<string>,
    /** Classes the teacher teaches at least one subject in. */
    readonly classes: Set<string>,
    /** Classes the teacher is form teacher of. */
    readonly formClasses: Set<string>,
  ) {}

  static async load(db: FirebaseFirestore.Firestore, user: JwtPayload): Promise<TeachingScope> {
    if (user.role !== 'TEACHER') return new TeachingScope(true, null, new Set(), new Set(), new Set());
    const me = await db.collection('users').doc(user.sub).get();
    const teacherId: string | null = me.exists && me.data()!.schoolId === user.schoolId ? me.data()!.teacherId ?? null : null;
    if (!teacherId) return new TeachingScope(false, null, new Set(), new Set(), new Set());
    const [assignments, classes] = await Promise.all([
      db.collection('teachingAssignments').where('schoolId', '==', user.schoolId).where('teacherId', '==', teacherId).get(),
      db.collection('classes').where('schoolId', '==', user.schoolId).where('teacherId', '==', teacherId).get(),
    ]);
    return new TeachingScope(
      false,
      teacherId,
      new Set(assignments.docs.map((d) => `${d.data().classId}|${d.data().subjectId}`)),
      new Set(assignments.docs.map((d) => d.data().classId as string)),
      new Set(classes.docs.filter((d) => d.data().status !== 'INACTIVE').map((d) => d.id)),
    );
  }

  canScore(classId: string, subjectId: string) {
    return this.all || this.subjects.has(`${classId}|${subjectId}`);
  }

  /** Form teachers and anyone teaching in the class can see its results and take its register. */
  canViewClass(classId: string) {
    return this.all || this.formClasses.has(classId) || this.classes.has(classId);
  }

  canRemark(classId: string) {
    return this.all || this.formClasses.has(classId);
  }

  private deny(what: string): never {
    if (!this.all && !this.teacherId) {
      throw new ForbiddenException("Your account isn't linked to a teacher record yet. Ask your school admin to link it on the Staff accounts page.");
    }
    throw new ForbiddenException(what);
  }

  requireScore(classId: string, subjectId: string, label = 'this subject') {
    if (!this.canScore(classId, subjectId)) this.deny(`You can only enter scores for subjects you teach. ${label} isn't assigned to you in Class subjects.`);
  }

  requireClass(classId: string, className = 'this class') {
    if (!this.canViewClass(classId)) this.deny(`You don't teach ${className}. Ask your school admin to assign you in Class subjects.`);
  }

  requireRemark(classId: string, className = 'this class') {
    if (!this.canRemark(classId)) this.deny(`Only ${className}'s form teacher can write the class teacher's remark.`);
  }
}
