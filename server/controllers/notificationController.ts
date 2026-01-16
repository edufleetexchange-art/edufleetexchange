import { Request, Response } from 'express';
import Notification from '../models/Notification.js';
import { AuthRequest } from '../middleware/auth.js';

// Get user's notifications
export const getNotifications = async (req: Request, res: Response) => {
  try {
    // Use type assertion to AuthRequest to access userId safely
    const authReq = req as AuthRequest;
    const userId = authReq.userId || (authReq.user && authReq.user._id);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID not found in request',
        code: 'AUTH_ERROR',
      });
    }

    const { page = 1, limit = 20, type, unreadOnly } = req.query;

    const query: any = { userId };

    if (type) {
      query.type = type;
    }

    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const notifications = await Notification.find(query)
      .sort('-createdAt')
      .skip(skip)
      .limit(limitNum);

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ userId, isRead: false });

    res.status(200).json({
      success: true,
      data: notifications,
      unreadCount,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch notifications',
      code: 'FETCH_NOTIFICATIONS_FAILED',
    });
  }
};

// Get unread count
export const getUnreadCount = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.userId || (authReq.user && authReq.user._id);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User ID not found in request',
        code: 'AUTH_ERROR',
      });
    }

    const count = await Notification.countDocuments({
      userId,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      data: { count },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get unread count',
      code: 'GET_COUNT_FAILED',
    });
  }
};

// Mark notification as read
export const markAsRead = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.userId || (authReq.user && authReq.user._id);
    const notificationId = req.params.id;

    const notification = await Notification.findOne({
      _id: notificationId,
      userId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found',
        code: 'NOTIFICATION_NOT_FOUND',
      });
    }

    notification.isRead = true;
    await notification.save();

    res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to mark notification as read',
      code: 'MARK_READ_FAILED',
    });
  }
};

// Mark all as read
export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.userId || (authReq.user && authReq.user._id);

    await Notification.updateMany(
      { userId, isRead: false },
      { isRead: true }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to mark all as read',
      code: 'MARK_ALL_READ_FAILED',
    });
  }
};

// Delete notification
export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.userId || (authReq.user && authReq.user._id);
    const notificationId = req.params.id;

    console.log(`[Delete Notification] Request for ID: ${notificationId} by User: ${userId}`);

    const notification = await Notification.findOne({
      _id: notificationId,
      userId,
    });

    if (!notification) {
      console.warn(`[Delete Notification] Notification not found or unauthorized. ID: ${notificationId}, User: ${userId}`);
      return res.status(404).json({
        success: false,
        error: 'Notification not found',
        code: 'NOTIFICATION_NOT_FOUND',
      });
    }

    await Notification.findOneAndDelete({ _id: notificationId, userId });
    console.log(`[Delete Notification] Successfully deleted notification: ${notificationId}`);

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error: any) {
    console.error(`[Delete Notification] Error:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete notification',
      code: 'DELETE_NOTIFICATION_FAILED',
    });
  }
};
0