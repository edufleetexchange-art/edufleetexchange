import { Request, Response } from 'express';
import Job from '../models/Job.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import Application from '../models/Application.js';
import { AuthRequest } from '../middleware/auth.js';
import { ISubscriptionPlan } from '../models/SubscriptionPlan.js';

// Helper to get data delay date
const getDataDelayDate = (user: any): Date | null => {
  if (!user || user.role === 'admin') return null;

  const plan = user.subscription?.planId as unknown as ISubscriptionPlan;
  const delayDays = plan?.features?.dataDelayDays ?? 10; // Default to 10 days if guest or no plan

  if (delayDays === 0) return null;

  const delayDate = new Date();
  delayDate.setDate(delayDate.getDate() - delayDays);
  return delayDate;
};

// Create a new job
export const createJob = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId).populate('subscription.planId');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    // Check subscription limits for job posts
    if (user.role !== 'admin') {
      const plan = user.subscription?.planId as unknown as ISubscriptionPlan;
      const maxJobPosts = plan?.features?.maxJobPosts ?? 0;
      const jobPostsUsed = user.subscription?.jobPostsUsed ?? 0;

      if (maxJobPosts !== -1 && jobPostsUsed >= maxJobPosts) {
        return res.status(403).json({
          success: false,
          error: `You have reached your job post limit (${maxJobPosts}). Please upgrade your plan.`,
          code: 'LIMIT_REACHED',
        });
      }
    }

    const jobData = {
      ...req.body,
      instituteId: userId,
      instituteName: user.instituteName || user.name,
      contactEmail: user.email,
    };

    const job = await Job.create(jobData);

    // Update jobPostsUsed counter
    if (user.subscription) {
      user.subscription.jobPostsUsed = (user.subscription.jobPostsUsed || 0) + 1;
      await user.save();
    }

    res.status(201).json({
      success: true,
      data: job,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create job',
      code: 'CREATE_JOB_FAILED',
    });
  }
};

// Get all jobs with filters
export const getAllJobs = async (req: AuthRequest, res: Response) => {
  try {
    const {
      location,
      subjects,
      employmentType,
      minSalary,
      maxSalary,
      experience,
      search,
      sort = '-createdAt',
      page = 1,
      limit = 20,
    } = req.query;

    const query: any = { status: 'active' };

    // Apply subscription data delay
    const delayDate = getDataDelayDate(req.user);
    if (delayDate) {
      query.createdAt = { $lte: delayDate };
    }

    // Apply filters
    if (location) {
      query.$or = [
        { 'location.city': new RegExp(location as string, 'i') },
        { 'location.state': new RegExp(location as string, 'i') },
      ];
    }

    if (subjects) {
      const subjectArray = (subjects as string).split(',');
      query.subjects = { $in: subjectArray };
    }

    if (employmentType) {
      query.employmentType = employmentType;
    }

    if (minSalary) {
      query['salary.min'] = { $gte: Number(minSalary) };
    }

    if (maxSalary) {
      query['salary.max'] = { $lte: Number(maxSalary) };
    }

    if (experience) {
      query['experience.min'] = { $lte: Number(experience) };
      query['experience.max'] = { $gte: Number(experience) };
    }

    if (search) {
      query.$or = [
        { title: new RegExp(search as string, 'i') },
        { description: new RegExp(search as string, 'i') },
        { instituteName: new RegExp(search as string, 'i') },
      ];
    }

    // Pagination
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const jobs = await Job.find(query)
      .sort(sort as string)
      .skip(skip)
      .limit(limitNum)
      .populate('instituteId', 'name instituteName email phone');

    const total = await Job.countDocuments(query);

    res.status(200).json({
      success: true,
      data: jobs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch jobs',
      code: 'FETCH_JOBS_FAILED',
    });
  }
};

// Get single job by ID
export const getJobById = async (req: AuthRequest, res: Response) => {
  try {
    const job = await Job.findById(req.params.id).populate(
      'instituteId',
      'name instituteName email phone avatar'
    );

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
        code: 'JOB_NOT_FOUND',
      });
    }

    // Check visibility based on delay if not admin/owner
    if (!req.user || (req.user.role !== 'admin' && req.user._id.toString() !== job.instituteId.toString())) {
      const delayDate = getDataDelayDate(req.user);
      if (delayDate && job.createdAt > delayDate) {
        return res.status(403).json({
          success: false,
          error: 'Access restricted: This job is only available for premium subscribers at the moment.',
          code: 'SUBSCRIPTION_REQUIRED',
        });
      }
    }

    res.status(200).json({
      success: true,
      data: job,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch job',
      code: 'FETCH_JOB_FAILED',
    });
  }
};

// Update job
export const updateJob = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    let job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
        code: 'JOB_NOT_FOUND',
      });
    }

    // Check ownership (unless admin)
    if (userRole !== 'admin' && job.instituteId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this job',
        code: 'UNAUTHORIZED',
      });
    }

    job = await Job.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: job,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update job',
      code: 'UPDATE_JOB_FAILED',
    });
  }
};

// Delete job
export const deleteJob = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
        code: 'JOB_NOT_FOUND',
      });
    }

    // Check ownership (unless admin)
    if (userRole !== 'admin' && job.instituteId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this job',
        code: 'UNAUTHORIZED',
      });
    }

    await Job.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Job deleted successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete job',
      code: 'DELETE_JOB_FAILED',
    });
  }
};

// Get institute's jobs
export const getInstituteJobs = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const jobs = await Job.find({ instituteId: userId }).sort('-createdAt');

    res.status(200).json({
      success: true,
      data: jobs,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch jobs',
      code: 'FETCH_JOBS_FAILED',
    });
  }
};

// Apply to job
export const applyToJob = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const jobId = req.params.id;
    const { coverLetter } = req.body;

    if (!coverLetter) {
      return res.status(400).json({
        success: false,
        error: 'Cover letter is required',
        code: 'COVER_LETTER_REQUIRED',
      });
    }

    const job = await Job.findById(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found',
        code: 'JOB_NOT_FOUND',
      });
    }

    if (job.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Job is not active',
        code: 'JOB_INACTIVE',
      });
    }

    // Check if already applied
    const existingApplication = await Application.findOne({ jobId, teacherId: userId });
    if (existingApplication) {
      return res.status(400).json({
        success: false,
        error: 'You have already applied to this job',
        code: 'ALREADY_APPLIED',
      });
    }

    // Get teacher details
    const teacher = await User.findById(userId);
    if (!teacher) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    // Create application
    const application = await Application.create({
      jobId,
      teacherId: userId,
      teacherName: teacher.name,
      instituteId: job.instituteId,
      instituteName: job.instituteName,
      coverLetter,
    });

    // Increment applications count
    job.applicationsCount += 1;
    await job.save();

    // Create notification for institute
    await Notification.create({
      userId: job.instituteId,
      type: 'message',
      title: 'New Job Application',
      message: `${teacher.name} applied for ${job.title}`,
      link: `/institute/job/${job._id}/applications`,
    });

    res.status(201).json({
      success: true,
      data: application,
      message: 'Application submitted successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to apply to job',
      code: 'APPLY_JOB_FAILED',
    });
  }
};

// Get applications
export const getApplications = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;
    const { jobId } = req.query;

    const query: any = {};

    if (userRole === 'teacher') {
      // Teacher: get their own applications
      query.teacherId = userId;
    } else if (userRole === 'institute') {
      // Institute: get applications for their jobs
      if (jobId) {
        // Verify job belongs to institute
        const job = await Job.findById(jobId);
        if (!job || job.instituteId.toString() !== userId) {
          return res.status(403).json({
            success: false,
            error: 'Not authorized to view these applications',
            code: 'UNAUTHORIZED',
          });
        }
        query.jobId = jobId;
      } else {
        query.instituteId = userId;
      }
    } else if (userRole === 'admin') {
      // Admin: get all or filter by jobId
      if (jobId) {
        query.jobId = jobId;
      }
    }

    const applications = await Application.find(query)
      .sort('-appliedDate')
      .populate('teacherId', 'name email phone location experience qualifications subjects avatar bio')
      .populate('jobId', 'title department location salary employmentType');

    res.status(200).json({
      success: true,
      data: applications,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch applications',
      code: 'FETCH_APPLICATIONS_FAILED',
    });
  }
};

// State machine validation helper
// RELAXED TRANSITIONS: Allow any reasonable status change for smooth UX
// Users should be able to accept directly from any state, reject from any state, etc.
const validateStatusTransition = (currentStatus: string, newStatus: string): { valid: boolean; error?: string } => {
  // All valid statuses
  const allStatuses = ['pending', 'reviewed', 'shortlisted', 'interview_scheduled', 'accepted', 'rejected'];
  
  // Check if new status is valid
  if (!allStatuses.includes(newStatus)) {
    return {
      valid: false,
      error: `Invalid status: ${newStatus}. Valid statuses: ${allStatuses.join(', ')}`,
    };
  }

  // No transition needed if status is the same
  if (currentStatus === newStatus) {
    return { valid: true };
  }

  // RELAXED POLICY: Allow nearly all transitions for user flexibility
  // The only restriction: once "accepted", you can only change to "rejected" (to correct mistakes)
  // This provides smooth UX while maintaining logical workflow
  
  // Define any truly invalid transitions (minimal restrictions)
  const invalidTransitions: Record<string, string[]> = {
    // Once accepted, can only reject (not go back to earlier stages)
    accepted: ['pending', 'reviewed', 'shortlisted', 'interview_scheduled'],
  };

  // Check if this specific transition is blocked
  if (invalidTransitions[currentStatus]?.includes(newStatus)) {
    // Provide helpful message about what CAN be done
    const allowedFromAccepted = allStatuses.filter(s => !invalidTransitions.accepted.includes(s) && s !== 'accepted');
    return {
      valid: false,
      error: `Cannot change from "${currentStatus}" to "${newStatus}". From accepted status, you can only change to: ${allowedFromAccepted.join(', ')}`,
    };
  }

  return { valid: true };
};

// Update application status
export const updateApplicationStatus = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;
    const applicationId = req.params.id;
    const { status, interviewScheduled } = req.body;

    const application = await Application.findById(applicationId);

    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application not found',
        code: 'APPLICATION_NOT_FOUND',
      });
    }

    // Check authorization
    if (userRole !== 'admin' && application.instituteId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this application',
        code: 'UNAUTHORIZED',
      });
    }

    // Validate status transition
    if (status && status !== application.status) {
      const validation = validateStatusTransition(application.status, status);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error,
          code: 'INVALID_STATUS_TRANSITION',
        });
      }

      // Update status with timestamp
      application.status = status;
      
      // Track status changes with timestamps
      switch (status) {
        case 'reviewed':
          application.reviewedAt = new Date();
          break;
        case 'shortlisted':
          application.shortlistedAt = new Date();
          break;
        case 'rejected':
          application.rejectedAt = new Date();
          // Cancel interview if scheduled
          if (application.interviewScheduled) {
            application.interviewScheduled = undefined;
          }
          break;
        case 'accepted':
          application.acceptedAt = new Date();
          break;
      }

      // Add to history
      if (!application.statusHistory) {
        application.statusHistory = [];
      }
      application.statusHistory.push({
        status,
        changedAt: new Date(),
        changedBy: userId,
      });
    }

    // Update interview details if provided
    if (interviewScheduled) {
      // Validate that application is in correct state for scheduling
      // Allow scheduling from any state EXCEPT rejected or accepted (makes no sense to schedule for those)
      const disallowedStates = ['rejected', 'accepted'];
      if (disallowedStates.includes(application.status)) {
        return res.status(400).json({
          success: false,
          error: `Interview cannot be scheduled for ${application.status} applications. Please change the status first.`,
          code: 'INVALID_STATE_FOR_INTERVIEW',
        });
      }

      application.interviewScheduled = {
        ...interviewScheduled,
        scheduledAt: new Date(),
      };

      // Auto-update status to interview_scheduled if not already there
      if (application.status !== 'interview_scheduled') {
        application.status = 'interview_scheduled';
        if (!application.statusHistory) {
          application.statusHistory = [];
        }
        application.statusHistory.push({
          status: 'interview_scheduled',
          changedAt: new Date(),
          changedBy: userId,
        });
      }
    }

    await application.save();

    // Create notification for teacher
    if (status) {
      const teacher = await User.findById(application.teacherId);
      if (teacher) {
        let message = '';
        switch (status) {
          case 'reviewed':
            message = `Your application for ${application.instituteName} has been reviewed`;
            break;
          case 'shortlisted':
            message = `You have been shortlisted for ${application.instituteName}`;
            break;
          case 'accepted':
            message = `Congratulations! Your application has been accepted by ${application.instituteName}`;
            break;
          case 'rejected':
            message = `Your application for ${application.instituteName} was not successful`;
            break;
        }

        if (message) {
          await Notification.create({
            userId: application.teacherId,
            type: status === 'accepted' ? 'success' : status === 'rejected' ? 'error' : 'info',
            title: 'Application Status Update',
            message,
            link: `/teacher/dashboard`,
          });
        }
      }
    }

    // Create notification for interview schedule
    if (interviewScheduled) {
      await Notification.create({
        userId: application.teacherId,
        type: 'info',
        title: 'Interview Scheduled',
        message: `Interview scheduled for ${application.instituteName}`,
        link: `/teacher/dashboard`,
      });
    }

    res.status(200).json({
      success: true,
      data: application,
      message: 'Application updated successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update application',
      code: 'UPDATE_APPLICATION_FAILED',
    });
  }
};

// Reschedule interview
export const rescheduleInterview = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;
    const applicationId = req.params.id;
    const { interviewScheduled } = req.body;

    if (!interviewScheduled) {
      return res.status(400).json({
        success: false,
        error: 'Interview details are required',
        code: 'INTERVIEW_DETAILS_REQUIRED',
      });
    }

    const application = await Application.findById(applicationId);

    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application not found',
        code: 'APPLICATION_NOT_FOUND',
      });
    }

    // Check authorization
    if (userRole !== 'admin' && application.instituteId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to reschedule this interview',
        code: 'UNAUTHORIZED',
      });
    }

    // Validate that interview was already scheduled
    if (application.status !== 'interview_scheduled' || !application.interviewScheduled) {
      return res.status(400).json({
        success: false,
        error: 'Interview must be scheduled before rescheduling',
        code: 'INTERVIEW_NOT_SCHEDULED',
      });
    }

    // Update interview details
    application.interviewScheduled = {
      ...interviewScheduled,
      scheduledAt: new Date(),
    };

    // Add to history
    if (!application.statusHistory) {
      application.statusHistory = [];
    }
    application.statusHistory.push({
      status: 'interview_rescheduled',
      changedAt: new Date(),
      changedBy: userId,
    });

    await application.save();

    // Create notification for teacher
    await Notification.create({
      userId: application.teacherId,
      type: 'warning',
      title: 'Interview Rescheduled',
      message: `Your interview with ${application.instituteName} has been rescheduled`,
      link: `/teacher/dashboard`,
    });

    res.status(200).json({
      success: true,
      data: application,
      message: 'Interview rescheduled successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to reschedule interview',
      code: 'RESCHEDULE_INTERVIEW_FAILED',
    });
  }
};