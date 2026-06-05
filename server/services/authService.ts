import mongoose from 'mongoose';
import Account from '../models/Account.js';
import InstituteProfile from '../models/InstituteProfile.js';
import TeacherProfile from '../models/TeacherProfile.js';
import VendorProfile from '../models/VendorProfile.js';
import ConsultantProfile from '../models/ConsultantProfile.js';
import StaffProfile from '../models/StaffProfile.js';
import Subscription from '../models/Subscription.js';
import SubscriptionPlan from '../models/SubscriptionPlan.js';

type Address = { street: string; city: string; state: string; pincode: string; country?: string };

export type Bundle = {
  account: any;
  profile: any;
  subscription: any;
};

function defaultSubscriptionFromPlan(accountId: mongoose.Types.ObjectId, plan: any) {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + (plan?.duration ?? 30));
  return {
    accountId,
    planId: plan?._id,
    status: 'active' as const,
    paymentStatus: 'completed' as const,
    startDate,
    endDate,
    listingsUsed: 0,
    listingsLimit:
      plan?.features?.maxListings ??
      plan?.features?.maxVehicleListings ??
      plan?.features?.maxProductListings ??
      0,
    jobPostsUsed: 0,
    jobPostsLimit: plan?.features?.maxJobPosts ?? 0,
    browseCount: 0,
    browseCountLimit: plan?.features?.maxBrowsesPerMonth ?? 0,
    lastBrowseReset: startDate,
    notes: 'Free plan assigned on signup',
  };
}

/** Shared helper: find the plan (by planId or free fallback) and create a Subscription within a session. */
async function createSubscriptionForAccount(
  accountId: mongoose.Types.ObjectId,
  planType: string,
  planId: string | undefined,
  session: mongoose.ClientSession,
  notes?: string
): Promise<any> {
  let plan: any = null;
  if (planId) {
    plan = await SubscriptionPlan.findById(planId).session(session);
  }
  if (!plan) {
    plan = await SubscriptionPlan.findOne({ planType, price: 0, isActive: true }).session(session);
  }
  const subData = defaultSubscriptionFromPlan(accountId, plan);
  if (notes) subData.notes = notes;
  const [subscription] = await Subscription.create([subData], { session });
  return subscription;
}

function avatarFor(email: string) {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`;
}

export interface InstituteSignupInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  instituteName: string;
  contactPerson?: string;
  address: Address;
  instituteSearchability?: boolean;
}

export async function signupInstitute(input: InstituteSignupInput): Promise<Bundle> {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const [account] = await Account.create(
        [
          {
            name: input.name,
            email: input.email,
            password: input.password,
            role: 'institute',
            phone: input.phone,
            avatar: avatarFor(input.email),
            isVerified: false,
            isActive: true,
          },
        ],
        { session }
      );
      const [profile] = await InstituteProfile.create(
        [
          {
            accountId: account._id,
            instituteName: input.instituteName,
            contactPerson: input.contactPerson,
            instituteSearchability: input.instituteSearchability ?? false,
            address: input.address,
          },
        ],
        { session }
      );
      const plan = await SubscriptionPlan.findOne({
        planType: 'institute',
        price: 0,
        isActive: true,
      }).session(session);
      const [subscription] = await Subscription.create(
        [defaultSubscriptionFromPlan(account._id, plan)],
        { session }
      );
      return {
        account: account.toJSON(),
        profile: profile.toJSON(),
        subscription: subscription.toJSON(),
      };
    });
  } finally {
    session.endSession();
  }
}

export interface TeacherSignupInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  experience: number;
  qualifications: string[];
  subjects: string[];
  bio?: string;
  location?: string;
  preferredLocation?: string[];
  isAvailable?: boolean;
}

export async function signupTeacher(input: TeacherSignupInput): Promise<Bundle> {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const [account] = await Account.create(
        [
          {
            name: input.name,
            email: input.email,
            password: input.password,
            role: 'teacher',
            phone: input.phone,
            avatar: avatarFor(input.email),
            isActive: true,
            isVerified: false,
          },
        ],
        { session }
      );
      const [profile] = await TeacherProfile.create(
        [
          {
            accountId: account._id,
            experience: input.experience,
            qualifications: input.qualifications,
            subjects: input.subjects,
            bio: input.bio,
            location: input.location,
            preferredLocation: input.preferredLocation,
            isAvailable: input.isAvailable ?? true,
          },
        ],
        { session }
      );
      const plan = await SubscriptionPlan.findOne({
        planType: 'teacher',
        price: 0,
        isActive: true,
      }).session(session);
      const [subscription] = await Subscription.create(
        [defaultSubscriptionFromPlan(account._id, plan)],
        { session }
      );
      return {
        account: account.toJSON(),
        profile: profile.toJSON(),
        subscription: subscription.toJSON(),
      };
    });
  } finally {
    session.endSession();
  }
}

export interface VendorSignupInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  businessName: string;
  contactPerson?: string;
  website?: string;
  address?: Partial<Address>;
}

export async function signupVendor(input: VendorSignupInput): Promise<Bundle> {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const [account] = await Account.create(
        [
          {
            name: input.name,
            email: input.email,
            password: input.password,
            role: 'vendor',
            phone: input.phone,
            avatar: avatarFor(input.email),
            isActive: true,
            isVerified: false,
          },
        ],
        { session }
      );
      const [profile] = await VendorProfile.create(
        [
          {
            accountId: account._id,
            businessName: input.businessName,
            contactPerson: input.contactPerson,
            phone: input.phone,
            website: input.website,
            address: input.address,
          },
        ],
        { session }
      );
      const plan = await SubscriptionPlan.findOne({
        planType: 'vendor',
        price: 0,
        isActive: true,
      }).session(session);
      const [subscription] = await Subscription.create(
        [defaultSubscriptionFromPlan(account._id, plan)],
        { session }
      );
      return {
        account: account.toJSON(),
        profile: profile.toJSON(),
        subscription: subscription.toJSON(),
      };
    });
  } finally {
    session.endSession();
  }
}

export interface ConsultantSignupInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  agencyName?: string;
  registrationNumber?: string;
  yearsOfExperience: number;
  specializations: { subjects: string[]; levels: string[]; regions: string[] };
  bio?: string;
  website?: string;
  address?: Partial<Address>;
}

export async function signupConsultant(input: ConsultantSignupInput): Promise<Bundle> {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const [account] = await Account.create(
        [
          {
            name: input.name,
            email: input.email,
            password: input.password,
            role: 'consultant',
            phone: input.phone,
            avatar: avatarFor(input.email),
            isActive: true,
            isVerified: false,
          },
        ],
        { session }
      );
      const [profile] = await ConsultantProfile.create(
        [
          {
            accountId: account._id,
            agencyName: input.agencyName,
            registrationNumber: input.registrationNumber,
            yearsOfExperience: input.yearsOfExperience,
            specializations: input.specializations,
            bio: input.bio,
            website: input.website,
            phone: input.phone,
            address: input.address,
          },
        ],
        { session }
      );
      const plan = await SubscriptionPlan.findOne({
        planType: 'consultant',
        price: 0,
        isActive: true,
      }).session(session);
      const [subscription] = await Subscription.create(
        [defaultSubscriptionFromPlan(account._id, plan)],
        { session }
      );
      return {
        account: account.toJSON(),
        profile: profile.toJSON(),
        subscription: subscription.toJSON(),
      };
    });
  } finally {
    session.endSession();
  }
}

const PROFILE_MODEL_BY_ROLE: Record<string, any> = {
  institute: InstituteProfile,
  teacher: TeacherProfile,
  vendor: VendorProfile,
  consultant: ConsultantProfile,
  admin: StaffProfile,
  marketing: StaffProfile,
  sales: StaffProfile,
};

export async function loadBundle(accountId: string): Promise<Bundle> {
  const account = await Account.findById(accountId);
  if (!account) throw new Error('Account not found');
  const ProfileModel = PROFILE_MODEL_BY_ROLE[account.role];
  const [profile, subscription] = await Promise.all([
    ProfileModel ? ProfileModel.findOne({ accountId: account._id }) : Promise.resolve(null),
    Subscription.findOne({ accountId: account._id, status: 'active' }),
  ]);
  return {
    account: account.toJSON(),
    profile: profile ? profile.toJSON() : null,
    subscription: subscription ? subscription.toJSON() : null,
  };
}

export async function login(email: string, password: string): Promise<Bundle> {
  const account = await Account.findOne({ email: email.toLowerCase() }).select('+password');
  if (!account) throw new Error('Invalid credentials');
  if (!account.isActive) throw new Error('Account is inactive');
  const ok = await (account as any).comparePassword(password);
  if (!ok) throw new Error('Invalid credentials');
  return loadBundle(String(account._id));
}

// ─── Admin / Sales creation helpers ─────────────────────────────────────────

export interface AdminCreateInstituteInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  instituteName: string;
  contactPerson?: string;
  address: { street: string; city: string; state: string; pincode: string; country?: string };
  planId?: string;
  isVerified?: boolean;
}

export async function adminCreateInstitute(input: AdminCreateInstituteInput): Promise<Bundle> {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const [account] = await Account.create(
        [
          {
            name: input.name,
            email: input.email,
            password: input.password,
            role: 'institute',
            phone: input.phone,
            avatar: avatarFor(input.email),
            isVerified: input.isVerified ?? true,
            isActive: true,
          },
        ],
        { session }
      );
      const [profile] = await InstituteProfile.create(
        [
          {
            accountId: account._id,
            instituteName: input.instituteName,
            contactPerson: input.contactPerson,
            address: input.address,
          },
        ],
        { session }
      );
      const subscription = await createSubscriptionForAccount(
        account._id,
        'institute',
        input.planId,
        session,
        input.planId ? 'Plan assigned on admin onboarding' : 'Free plan assigned on admin onboarding'
      );
      return {
        account: account.toJSON(),
        profile: profile.toJSON(),
        subscription: subscription.toJSON(),
      };
    });
  } finally {
    session.endSession();
  }
}

export interface AdminCreateTeacherInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  experience: number;
  qualifications: string[];
  subjects: string[];
  bio?: string;
  location?: string;
  preferredLocation?: string[];
  isAvailable?: boolean;
  planId?: string;
  isVerified?: boolean;
}

export async function adminCreateTeacher(input: AdminCreateTeacherInput): Promise<Bundle> {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const [account] = await Account.create(
        [
          {
            name: input.name,
            email: input.email,
            password: input.password,
            role: 'teacher',
            phone: input.phone,
            avatar: avatarFor(input.email),
            isVerified: input.isVerified ?? true,
            isActive: true,
          },
        ],
        { session }
      );
      const [profile] = await TeacherProfile.create(
        [
          {
            accountId: account._id,
            experience: input.experience,
            qualifications: input.qualifications,
            subjects: input.subjects,
            bio: input.bio,
            location: input.location,
            preferredLocation: input.preferredLocation,
            isAvailable: input.isAvailable ?? true,
          },
        ],
        { session }
      );
      const subscription = await createSubscriptionForAccount(
        account._id,
        'teacher',
        input.planId,
        session,
        input.planId ? 'Plan assigned on admin onboarding' : 'Free plan assigned on admin onboarding'
      );
      return {
        account: account.toJSON(),
        profile: profile.toJSON(),
        subscription: subscription.toJSON(),
      };
    });
  } finally {
    session.endSession();
  }
}

export interface AdminCreateVendorInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  businessName: string;
  contactPerson?: string;
  website?: string;
  address?: Partial<{ street: string; city: string; state: string; pincode: string; country: string }>;
  planId?: string;
  isVerified?: boolean;
}

export async function adminCreateVendor(input: AdminCreateVendorInput): Promise<Bundle> {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const [account] = await Account.create(
        [
          {
            name: input.name,
            email: input.email,
            password: input.password,
            role: 'vendor',
            phone: input.phone,
            avatar: avatarFor(input.email),
            isVerified: input.isVerified ?? true,
            isActive: true,
          },
        ],
        { session }
      );
      const [profile] = await VendorProfile.create(
        [
          {
            accountId: account._id,
            businessName: input.businessName,
            contactPerson: input.contactPerson,
            phone: input.phone,
            website: input.website,
            address: input.address,
          },
        ],
        { session }
      );
      const subscription = await createSubscriptionForAccount(
        account._id,
        'vendor',
        input.planId,
        session,
        input.planId ? 'Plan assigned on admin onboarding' : 'Free plan assigned on admin onboarding'
      );
      return {
        account: account.toJSON(),
        profile: profile.toJSON(),
        subscription: subscription.toJSON(),
      };
    });
  } finally {
    session.endSession();
  }
}

export interface AdminCreateStaffInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: 'admin' | 'marketing' | 'sales';
  employeeId?: string;
  department?: string;
  permissions?: string[];
  isVerified?: boolean;
}

export async function adminCreateStaff(input: AdminCreateStaffInput): Promise<Bundle> {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const [account] = await Account.create(
        [
          {
            name: input.name,
            email: input.email,
            password: input.password,
            role: input.role,
            phone: input.phone,
            avatar: avatarFor(input.email),
            isVerified: input.isVerified ?? true,
            isActive: true,
          },
        ],
        { session }
      );
      const staffData: Record<string, any> = { accountId: account._id };
      if (input.employeeId) staffData.employeeId = input.employeeId;
      if (input.department) staffData.department = input.department;
      if (input.permissions) staffData.permissions = input.permissions;
      const [staffProfile] = await StaffProfile.create([staffData], { session });
      return {
        account: account.toJSON(),
        profile: staffProfile.toJSON(),
        subscription: null,
      };
    });
  } finally {
    session.endSession();
  }
}
