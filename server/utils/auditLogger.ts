import AuditLog from '../models/AuditLog.js';
import { IUser } from '../models/User.js';

interface AuditParams {
  user: IUser;
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
