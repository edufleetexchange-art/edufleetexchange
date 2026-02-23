import { Response } from 'express';
import Activity from '../models/Activity.js';
import Task from '../models/Task.js';
import Lead from '../models/Lead.js';
import { AuthRequest } from '../middleware/auth.js';
import { logAction } from '../utils/auditLogger.js';

/**
 * @desc    Get activities for a lead
 * @route   GET /api/crm/leads/:leadId/activities
 */
export const getLeadActivities = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { leadId } = req.params;
    const activities = await Activity.find({ leadId })
      .sort({ createdAt: -1 })
      .populate('userId', 'name email employeeId');
    
    res.status(200).json({ success: true, data: activities });
  } catch (error) {
    console.error('Get lead activities error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * @desc    Create an activity
 * @route   POST /api/crm/activities
 */
export const createActivity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const activity = await Activity.create({
      ...req.body,
      userId: req.user._id
    });

    await logAction({
      user: req.user,
      action: 'CREATE_CRM_ACTIVITY',
      targetId: activity._id.toString(),
      targetType: 'Activity',
      details: `Logged ${activity.type} for lead ${activity.leadId}`,
      req
    });

    res.status(201).json({ success: true, data: activity });
  } catch (error) {
    console.error('Create activity error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * @desc    Get tasks (assigned to current user)
 * @route   GET /api/crm/tasks
 */
export const getMyTasks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const { status } = req.query;
    const query: any = { assignedTo: req.user._id };
    
    if (status && status !== 'all') {
      query.status = status;
    }

    const tasks = await Task.find(query)
      .sort({ dueDate: 1 })
      .populate('leadId', 'name email instituteName phone type status')
      .populate('createdBy', 'name email');
    
    res.status(200).json({ success: true, data: tasks });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * @desc    Create a task
 * @route   POST /api/crm/tasks
 */
export const createTask = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const task = await Task.create({
      ...req.body,
      createdBy: req.user._id,
      assignedTo: req.body.assignedTo || req.user._id
    });

    await logAction({
      user: req.user,
      action: 'CREATE_CRM_TASK',
      targetId: task._id.toString(),
      targetType: 'Task',
      details: `Created task: ${task.title}`,
      req
    });

    res.status(201).json({ success: true, data: task });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * @desc    Update task status
 * @route   PUT /api/crm/tasks/:id
 */
export const updateTaskStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const task = await Task.findById(id);
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    task.status = status;
    if (status === 'completed') {
      task.completedAt = new Date();
    }
    await task.save();

    res.status(200).json({ success: true, data: task });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};