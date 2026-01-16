// Seed data for subscription plans and notifications

// Define the type for subscription plan seed data
interface SubscriptionPlanSeed {
  name: string;
  displayName: string;
  planType: 'teacher' | 'institute' | 'vendor';
  description: string;
  price: number;
  duration: number;
  features: {
    maxListings: number;
    maxJobPosts: number;
    maxBrowsesPerMonth: number;
    dataDelayDays: number;
    teacherDataDelayDays: number;
    canAdvertiseVehicles: boolean;
    instantVehicleAlerts: boolean;
    instantJobAlerts: boolean;
    priorityListings: boolean;
    analytics: boolean;
    supportLevel: 'basic' | 'priority' | 'premium';
  };
  isActive: boolean;
}

export const subscriptionPlansData: SubscriptionPlanSeed[] = [
  // INSTITUTE PLANS
  {
    name: 'institute-free',
    displayName: 'Institute Basic (Free)',
    planType: 'institute',
    description: 'Basic access for institutes to explore the platform with limited features.',
    price: 0,
    duration: 365,
    features: {
      maxListings: 0,
      maxJobPosts: 1,
      maxBrowsesPerMonth: 10,
      dataDelayDays: 10,
      teacherDataDelayDays: 15,
      canAdvertiseVehicles: false,
      instantVehicleAlerts: false,
      instantJobAlerts: false,
      priorityListings: false,
      analytics: false,
      supportLevel: 'basic',
    },
    isActive: true,
  },
  {
    name: 'institute-silver',
    displayName: 'Institute Professional',
    planType: 'institute',
    description: 'Ideal for growing institutes with regular vehicle and hiring needs.',
    price: 999,
    duration: 30,
    features: {
      maxListings: 5,
      maxJobPosts: 5,
      maxBrowsesPerMonth: 50,
      dataDelayDays: 5,
      teacherDataDelayDays: 7,
      canAdvertiseVehicles: true,
      instantVehicleAlerts: false,
      instantJobAlerts: false,
      priorityListings: false,
      analytics: true,
      supportLevel: 'priority',
    },
    isActive: true,
  },
  {
    name: 'institute-gold',
    displayName: 'Institute Business',
    planType: 'institute',
    description: 'Best for large institutes with high volume requirements.',
    price: 2499,
    duration: 30,
    features: {
      maxListings: 20,
      maxJobPosts: 20,
      maxBrowsesPerMonth: 150,
      dataDelayDays: 2,
      teacherDataDelayDays: 3,
      canAdvertiseVehicles: true,
      instantVehicleAlerts: true,
      instantJobAlerts: true,
      priorityListings: true,
      analytics: true,
      supportLevel: 'premium',
    },
    isActive: true,
  },
  {
    name: 'institute-elite',
    displayName: 'Institute Elite',
    planType: 'institute',
    description: 'Ultimate access for large educational groups with zero limitations.',
    price: 4999,
    duration: 30,
    features: {
      maxListings: 100,
      maxJobPosts: 100,
      maxBrowsesPerMonth: 1000,
      dataDelayDays: 0,
      teacherDataDelayDays: 0,
      canAdvertiseVehicles: true,
      instantVehicleAlerts: true,
      instantJobAlerts: true,
      priorityListings: true,
      analytics: true,
      supportLevel: 'premium',
    },
    isActive: true,
  },

  // TEACHER PLANS
  {
    name: 'teacher-free',
    displayName: 'Teacher Basic (Free)',
    planType: 'teacher',
    description: 'Basic profile for teachers to apply to jobs.',
    price: 0,
    duration: 365,
    features: {
      maxListings: 0,
      maxJobPosts: 0,
      maxBrowsesPerMonth: 20,
      dataDelayDays: 5,
      teacherDataDelayDays: 0,
      canAdvertiseVehicles: false,
      instantVehicleAlerts: false,
      instantJobAlerts: false,
      priorityListings: false,
      analytics: false,
      supportLevel: 'basic',
    },
    isActive: true,
  },
  {
    name: 'teacher-pro',
    displayName: 'Teacher Professional',
    planType: 'teacher',
    description: 'Get hired faster with early access to jobs and featured profile.',
    price: 299,
    duration: 30,
    features: {
      maxListings: 0,
      maxJobPosts: 0,
      maxBrowsesPerMonth: 100,
      dataDelayDays: 0,
      teacherDataDelayDays: 0,
      canAdvertiseVehicles: false,
      instantVehicleAlerts: false,
      instantJobAlerts: true,
      priorityListings: true,
      analytics: true,
      supportLevel: 'priority',
    },
    isActive: true,
  },

  // VENDOR PLANS
  {
    name: 'vendor-free',
    displayName: 'Vendor Basic (Free)',
    planType: 'vendor',
    description: 'List your products/services with limited visibility.',
    price: 0,
    duration: 365,
    features: {
      maxListings: 2,
      maxJobPosts: 0,
      maxBrowsesPerMonth: 5,
      dataDelayDays: 0,
      teacherDataDelayDays: 0,
      canAdvertiseVehicles: false,
      instantVehicleAlerts: false,
      instantJobAlerts: false,
      priorityListings: false,
      analytics: false,
      supportLevel: 'basic',
    },
    isActive: true,
  },
  {
    name: 'vendor-premium',
    displayName: 'Vendor Premium',
    planType: 'vendor',
    description: 'Showcase your brand with full details and verified badge.',
    price: 1499,
    duration: 30,
    features: {
      maxListings: 50,
      maxJobPosts: 0,
      maxBrowsesPerMonth: 50,
      dataDelayDays: 0,
      teacherDataDelayDays: 0,
      canAdvertiseVehicles: false,
      instantVehicleAlerts: false,
      instantJobAlerts: false,
      priorityListings: true,
      analytics: true,
      supportLevel: 'premium',
    },
    isActive: true,
  },
];

// User subscriptions will be assigned to institutes
// Format: Will be created after users are seeded
export const userSubscriptionsTemplate = {
  // Example structure:
  // userId: 'ObjectId reference to User',
  // subscriptionPlanId: 'ObjectId reference to SubscriptionPlan',
  // planName: 'Basic Plan',
  // startDate: new Date(),
  // endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  // status: 'active',
  // browseCountUsed: 5,
  // lastBrowseResetAt: new Date(),
  // listingCountUsed: 2,
  // assignedBy: 'admin-user-id',
  // notes: 'Initial subscription',
};

// Notification templates
export const notificationTemplatesData = {
  listing_approved: {
    type: 'listing_approved',
    title: 'Vehicle Listing Approved',
    message: 'Your vehicle listing "{vehicleTitle}" has been approved and is now live on the marketplace.',
    priority: 'medium',
  },
  subscription_expiring: {
    type: 'subscription_expiring',
    title: 'Subscription Expiring Soon',
    message: 'Your {planName} subscription will expire in {daysRemaining} days. Renew now to continue enjoying premium features.',
    priority: 'high',
  },
  browse_limit_warning: {
    type: 'browse_limit_warning',
    title: 'Browse Limit Warning',
    message: 'You have used {used} out of {total} vehicle detail views this month. Upgrade your plan for more access.',
    priority: 'medium',
  },
  listing_limit_reached: {
    type: 'listing_limit_reached',
    title: 'Listing Limit Reached',
    message: 'You have reached your listing limit of {limit} vehicles. Upgrade your plan to list more vehicles.',
    priority: 'high',
  },
  subscription_expired: {
    type: 'subscription_expired',
    title: 'Subscription Expired',
    message: 'Your subscription has expired. Renew now to restore your access to premium features.',
    priority: 'high',
  },
  new_feature: {
    type: 'new_feature',
    title: 'New Feature Available',
    message: 'Check out our new feature: {featureName}. Learn more about how it can benefit your institute.',
    priority: 'low',
  },
  system_alert: {
    type: 'system_alert',
    title: 'System Update',
    message: 'System maintenance scheduled for {date} at {time}. Expected downtime: {duration}.',
    priority: 'medium',
  },
};

// Sample notifications (will be created for users)
export const sampleNotificationsData = [
  {
    // For institutes with approved listings
    type: 'listing_approved',
    title: 'Vehicle Listing Approved',
    message: 'Your vehicle listing has been approved and is now visible to all users.',
    priority: 'medium',
    isRead: false,
  },
  {
    // Welcome notification
    type: 'new_feature',
    title: 'Welcome to EduFleet Exchange!',
    message: 'Thank you for joining EduFleet Exchange. Explore our marketplace to find the perfect vehicles for your institute.',
    priority: 'low',
    isRead: false,
  },
  {
    // For users approaching browse limit
    type: 'browse_limit_warning',
    title: 'Browse Limit Warning',
    message: 'You have used 8 out of 10 vehicle detail views this month. Consider upgrading for unlimited access.',
    priority: 'medium',
    isRead: false,
  },
];
