import AuditLog from '../models/AuditLog.js';

interface AuditUser {
  _id: any;
  employeeId?: string;
  name: string;
  role: string;
}

interface AuditParams {
  user: AuditUser;
  action: string;
  targetId?: string;
  targetType?: string;
  details: string;
  req?: any;
}

export const logAction = async ({
  user,
  action,
  targetId,
  targetType,
  details,
  req,
}: AuditParams) => {
  try {
    await AuditLog.create({
      userId: user._id,
      employeeId: user.employeeId,
      userName: user.name,
      userRole: user.role,
      action,
      targetId,
      targetType,
      details,
      ipAddress: req?.ip,
      userAgent: req?.get('User-Agent'),
    });
  } catch (error) {
    console.error('Audit logging failed:', error);
  }
};
