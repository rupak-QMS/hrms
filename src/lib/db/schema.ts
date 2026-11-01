/**
 * Drizzle ORM schema — reflects the full PostgreSQL schema.
 * Tables are organized by HRMS module.
 */
import {
  pgTable, uuid, varchar, text, boolean, integer, decimal,
  timestamp, date, jsonb, pgEnum, index, uniqueIndex,
} from 'drizzle-orm/pg-core'

// ──────────────────────────────────────────────
// Enums
// ──────────────────────────────────────────────

export const tenantTierEnum = pgEnum('tenant_tier', ['starter', 'professional', 'enterprise'])
export const userRoleEnum   = pgEnum('user_role', [
  'super_admin', 'director', 'hr_officer', 'compliance_manager',
  'operations_manager', 'team_leader', 'payroll_officer',
  'employee', 'contractor', 'auditor', 'it_admin',
])
export const employmentTypeEnum = pgEnum('employment_type', [
  'full_time', 'part_time', 'casual', 'contractor', 'volunteer',
])
export const complianceStatusEnum = pgEnum('compliance_status', ['green', 'amber', 'red', 'pending'])
export const documentStatusEnum   = pgEnum('document_status', ['active', 'expired', 'archived', 'pending_review'])

// ──────────────────────────────────────────────
// Module 01 — Tenants (Multi-Tenant Core)
// ──────────────────────────────────────────────

export const tenants = pgTable('hrms_tenants', {
  id:          uuid('id').primaryKey().defaultRandom(),
  name:        varchar('name', { length: 255 }).notNull(),
  slug:        varchar('slug', { length: 100 }).notNull().unique(),
  tier:        tenantTierEnum('tier').notNull().default('starter'),
  logoUrl:     text('logo_url'),
  primaryColor:varchar('primary_color', { length: 7 }),
  isActive:    boolean('is_active').notNull().default(true),
  settings:    jsonb('settings').default({}),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  updatedAt:   timestamp('updated_at').notNull().defaultNow(),
})

export const tenantModules = pgTable('hrms_tenant_modules', {
  id:        uuid('id').primaryKey().defaultRandom(),
  tenantId:  uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  moduleId:  integer('module_id').notNull(),
  moduleName:varchar('module_name', { length: 100 }).notNull(),
  isEnabled: boolean('is_enabled').notNull().default(false),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  updatedBy: uuid('updated_by'),
}, (t) => ({
  uniqueIdx: uniqueIndex('tenant_module_unique').on(t.tenantId, t.moduleId),
}))

// ──────────────────────────────────────────────
// Module 03 — Users & RBAC
// ──────────────────────────────────────────────

export const users = pgTable('hrms_users', {
  id:             uuid('id').primaryKey().defaultRandom(),
  tenantId:       uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  email:          varchar('email', { length: 255 }).notNull(),
  passwordHash:   text('password_hash').notNull(),
  role:           userRoleEnum('role').notNull().default('employee'),
  isActive:       boolean('is_active').notNull().default(true),
  totpSecret:          text('totp_secret'),
  totpEnabled:         boolean('totp_enabled').notNull().default(false),
  lastLoginAt:         timestamp('last_login_at'),
  passwordChangedAt:   timestamp('password_changed_at'),
  passwordResetToken:  text('password_reset_token'),
  passwordResetExpiry: timestamp('password_reset_expiry'),
  createdAt:           timestamp('created_at').notNull().defaultNow(),
  updatedAt:           timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  emailIdx: uniqueIndex('users_email_tenant').on(t.tenantId, t.email),
}))

// ──────────────────────────────────────────────
// Module 02 — Employee Master Profiles
// ──────────────────────────────────────────────

export const employees = pgTable('hrms_employees', {
  id:               uuid('id').primaryKey().defaultRandom(),
  tenantId:         uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId:           uuid('user_id').references(() => users.id),
  employeeNumber:   varchar('employee_number', { length: 50 }).notNull(),
  firstName:        varchar('first_name', { length: 100 }).notNull(),
  lastName:         varchar('last_name', { length: 100 }).notNull(),
  preferredName:    varchar('preferred_name', { length: 100 }),
  dateOfBirth:      date('date_of_birth'),
  gender:           varchar('gender', { length: 50 }),
  phone:            varchar('phone', { length: 20 }),
  email:            varchar('email', { length: 255 }).notNull(),
  address:          text('address'),
  photoUrl:         text('photo_url'),
  // Employment
  entityName:       varchar('entity_name', { length: 100 }), // Yahweh Care | Yahweh Property Care
  departmentId:     uuid('department_id'),
  positionId:       uuid('position_id'),
  managerId:        uuid('manager_id').references((): any => employees.id),
  branchId:         uuid('branch_id'),
  employmentType:   employmentTypeEnum('employment_type').notNull(),
  awardClassification: varchar('award_classification', { length: 100 }),
  payLevel:         varchar('pay_level', { length: 50 }),
  hourlyRate:       decimal('hourly_rate', { precision: 10, scale: 4 }),
  annualSalary:     decimal('annual_salary', { precision: 12, scale: 2 }),
  ordinaryHoursPerWeek: decimal('ordinary_hours_per_week', { precision: 5, scale: 2 }).default('38'),
  startDate:        date('start_date').notNull(),
  probationEndDate: date('probation_end_date'),
  endDate:          date('end_date'),
  isActive:         boolean('is_active').notNull().default(true),
  // Compliance
  complianceStatus: complianceStatusEnum('compliance_status').notNull().default('pending'),
  ndisWorker:       boolean('ndis_worker').notNull().default(false),
  createdAt:        timestamp('created_at').notNull().defaultNow(),
  updatedAt:        timestamp('updated_at').notNull().defaultNow(),
  deletedAt:        timestamp('deleted_at'),
}, (t) => ({
  tenantIdx:     index('employees_tenant_idx').on(t.tenantId),
  empNumberIdx:  uniqueIndex('employees_number_tenant').on(t.tenantId, t.employeeNumber),
}))

export const emergencyContacts = pgTable('hrms_emergency_contacts', {
  id:           uuid('id').primaryKey().defaultRandom(),
  employeeId:   uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  name:         varchar('name', { length: 200 }).notNull(),
  relationship: varchar('relationship', { length: 100 }),
  phone:        varchar('phone', { length: 20 }),
  email:        varchar('email', { length: 255 }),
  isPrimary:    boolean('is_primary').notNull().default(false),
})

export const branches = pgTable('hrms_branches', {
  id:        uuid('id').primaryKey().defaultRandom(),
  tenantId:  uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name:      varchar('name', { length: 200 }).notNull(),
  code:      varchar('code', { length: 20 }),
  address:   text('address'),
  suburb:    varchar('suburb', { length: 100 }),
  state:     varchar('state', { length: 50 }),
  postcode:  varchar('postcode', { length: 10 }),
  country:   varchar('country', { length: 100 }).default('Australia'),
  phone:     varchar('phone', { length: 20 }),
  email:     varchar('email', { length: 255 }),
  managerId: uuid('manager_id'),
  isActive:  boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index('branches_tenant_idx').on(t.tenantId),
}))

export const departments = pgTable('hrms_departments', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name:        varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  parentId:    uuid('parent_id'),
  isActive:    boolean('is_active').notNull().default(true),
})

export const positions = pgTable('hrms_positions', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  tenantId:            uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  departmentId:        uuid('department_id').references(() => departments.id),
  title:               varchar('title', { length: 200 }).notNull(),
  description:         text('description'),
  isParticipantFacing: boolean('is_participant_facing').notNull().default(false),
  isRiskAssessed:      boolean('is_risk_assessed').notNull().default(false),
  isKeyPersonnel:      boolean('is_key_personnel').notNull().default(false),
  isWhsSensitive:      boolean('is_whs_sensitive').notNull().default(false),
  isActive:            boolean('is_active').notNull().default(true),
})

// ──────────────────────────────────────────────
// Module 04 — Audit Logging
// ──────────────────────────────────────────────

export const auditLogs = pgTable('hrms_audit_logs', {
  id:         uuid('id').primaryKey().defaultRandom(),
  tenantId:   uuid('tenant_id').notNull().references(() => tenants.id),
  userId:     uuid('user_id'),
  action:     varchar('action', { length: 100 }).notNull(),
  resource:   varchar('resource', { length: 100 }).notNull(),
  resourceId: uuid('resource_id'),
  oldValues:  jsonb('old_values'),
  newValues:  jsonb('new_values'),
  ipAddress:  varchar('ip_address', { length: 45 }),
  userAgent:  text('user_agent'),
  createdAt:  timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx:   index('audit_tenant_idx').on(t.tenantId),
  createdIdx:  index('audit_created_idx').on(t.createdAt),
}))

// ──────────────────────────────────────────────
// Module 05 — Document Management
// ──────────────────────────────────────────────

export const documents = pgTable('hrms_documents', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId:   uuid('employee_id').references(() => employees.id),
  category:     varchar('category', { length: 100 }).notNull(),
  title:        varchar('title', { length: 300 }).notNull(),
  blobUrl:      text('blob_url').notNull(),
  fileName:     varchar('file_name', { length: 255 }),
  fileSizeBytes:integer('file_size_bytes'),
  mimeType:     varchar('mime_type', { length: 100 }),
  status:       documentStatusEnum('status').notNull().default('active'),
  expiryDate:   date('expiry_date'),
  uploadedBy:   uuid('uploaded_by'),
  notes:        text('notes'),
  version:      integer('version').notNull().default(1),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
  deletedAt:    timestamp('deleted_at'),
}, (t) => ({
  tenantIdx:   index('docs_tenant_idx').on(t.tenantId),
  employeeIdx: index('docs_employee_idx').on(t.employeeId),
}))

// ──────────────────────────────────────────────
// Module 06 — Pre-Employment Screening
// ──────────────────────────────────────────────

export const screeningRecords = pgTable('hrms_screening_records', {
  id:            uuid('id').primaryKey().defaultRandom(),
  tenantId:      uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId:    uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  checkType:     varchar('check_type', { length: 100 }).notNull(), // police_check, wwcc, ndis_screening, etc.
  status:        complianceStatusEnum('status').notNull().default('pending'),
  referenceNumber: varchar('reference_number', { length: 100 }),
  issuedDate:    date('issued_date'),
  expiryDate:    date('expiry_date'),
  documentId:    uuid('document_id').references(() => documents.id),
  notes:         text('notes'),
  verifiedBy:    uuid('verified_by'),
  verifiedAt:    timestamp('verified_at'),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
  updatedAt:     timestamp('updated_at').notNull().defaultNow(),
})

// ──────────────────────────────────────────────
// Module 07 — Compliance Lock
// ──────────────────────────────────────────────

export const complianceLockExceptions = pgTable('hrms_compliance_lock_exceptions', {
  id:             uuid('id').primaryKey().defaultRandom(),
  tenantId:       uuid('tenant_id').notNull().references(() => tenants.id),
  employeeId:     uuid('employee_id').notNull().references(() => employees.id),
  reason:         text('reason').notNull(),
  expiresAt:      timestamp('expires_at').notNull(),
  approvedBy:     uuid('approved_by').notNull(),
  approvedAt:     timestamp('approved_at').notNull().defaultNow(),
  isActive:       boolean('is_active').notNull().default(true),
})

// ──────────────────────────────────────────────
// Module 08 — Ongoing Compliance Tracking
// ──────────────────────────────────────────────

export const complianceTracking = pgTable('hrms_compliance_tracking', {
  id:              uuid('id').primaryKey().defaultRandom(),
  tenantId:        uuid('tenant_id').notNull().references(() => tenants.id),
  employeeId:      uuid('employee_id').notNull().references(() => employees.id),
  itemType:        varchar('item_type', { length: 100 }).notNull(),
  status:          complianceStatusEnum('status').notNull().default('green'),
  dueDate:         date('due_date'),
  lastCheckedAt:   timestamp('last_checked_at'),
  escalatedAt:     timestamp('escalated_at'),
  escalatedTo:     uuid('escalated_to'),
  notes:           text('notes'),
  updatedAt:       timestamp('updated_at').notNull().defaultNow(),
})

// ──────────────────────────────────────────────
// Module 09 — Onboarding & Induction
// ──────────────────────────────────────────────

export const onboardingRecords = pgTable('hrms_onboarding_records', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id),
  employeeId:   uuid('employee_id').notNull().references(() => employees.id),
  stage:        varchar('stage', { length: 50 }).notNull(), // pre_start, day1, week1, weeks2_4, end_probation, fully_active
  status:       varchar('status', { length: 50 }).notNull().default('pending'),
  completedAt:  timestamp('completed_at'),
  buddyId:      uuid('buddy_id').references(() => employees.id),
  notes:        text('notes'),
  checklist:    jsonb('checklist').default([]),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
})

// ──────────────────────────────────────────────
// Module 10 — Training Management & LMS
// ──────────────────────────────────────────────

export const courses = pgTable('hrms_courses', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id),
  title:        varchar('title', { length: 300 }).notNull(),
  description:  text('description'),
  category:     varchar('category', { length: 100 }),
  isMandatory:  boolean('is_mandatory').notNull().default(false),
  validityMonths: integer('validity_months'), // null = no expiry
  content:      jsonb('content').default([]),
  isActive:     boolean('is_active').notNull().default(true),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
  deletedAt:    timestamp('deleted_at'),
})

export const trainingRecords = pgTable('hrms_training_records', {
  id:             uuid('id').primaryKey().defaultRandom(),
  tenantId:       uuid('tenant_id').notNull().references(() => tenants.id),
  employeeId:     uuid('employee_id').notNull().references(() => employees.id),
  courseId:       uuid('course_id').notNull().references(() => courses.id),
  status:         varchar('status', { length: 50 }).notNull().default('enrolled'),
  completedAt:    timestamp('completed_at'),
  expiryDate:     date('expiry_date'),
  certificateUrl: text('certificate_url'),
  score:          decimal('score', { precision: 5, scale: 2 }),
  attempts:       integer('attempts').notNull().default(0),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
  deletedAt:      timestamp('deleted_at'),
})

// ──────────────────────────────────────────────
// Module 11 — Competency Management
// ──────────────────────────────────────────────

export const competencies = pgTable('hrms_competencies', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id),
  name:        varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  category:    varchar('category', { length: 100 }),
  isActive:    boolean('is_active').notNull().default(true),
})

export const competencyAssessments = pgTable('hrms_competency_assessments', {
  id:              uuid('id').primaryKey().defaultRandom(),
  tenantId:        uuid('tenant_id').notNull().references(() => tenants.id),
  employeeId:      uuid('employee_id').notNull().references(() => employees.id),
  competencyId:    uuid('competency_id').notNull().references(() => competencies.id),
  assessorId:      uuid('assessor_id').references(() => employees.id),
  outcome:         varchar('outcome', { length: 50 }), // competent, not_yet_competent
  assessedAt:      timestamp('assessed_at'),
  expiryDate:      date('expiry_date'),
  evidence:        text('evidence'),
  notes:           text('notes'),
  createdAt:       timestamp('created_at').notNull().defaultNow(),
})

// ──────────────────────────────────────────────
// Module 12 — Supervision Management
// ──────────────────────────────────────────────

export const supervisionRecords = pgTable('hrms_supervision_records', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id),
  employeeId:   uuid('employee_id').notNull().references(() => employees.id),
  supervisorId: uuid('supervisor_id').notNull().references(() => employees.id),
  scheduledDate:date('scheduled_date').notNull(),
  conductedAt:  timestamp('conducted_at'),
  type:         varchar('type', { length: 50 }), // regular, probation, high_risk
  status:       varchar('status', { length: 50 }).notNull().default('scheduled'),
  notes:        text('notes'),
  actionItems:  jsonb('action_items').default([]),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
})

// ──────────────────────────────────────────────
// Module 14 — Recruitment & ATS
// ──────────────────────────────────────────────

export const jobRequisitions = pgTable('hrms_job_requisitions', {
  id:             uuid('id').primaryKey().defaultRandom(),
  tenantId:       uuid('tenant_id').notNull().references(() => tenants.id),
  positionId:     uuid('position_id').references(() => positions.id),
  title:          varchar('title', { length: 300 }).notNull(),
  description:    text('description'),
  status:         varchar('status', { length: 50 }).notNull().default('draft'),
  requestedBy:    uuid('requested_by'),
  approvedBy:     uuid('approved_by'),
  approvedAt:     timestamp('approved_at'),
  closedAt:       timestamp('closed_at'),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
})

export const candidates = pgTable('hrms_candidates', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id),
  firstName:    varchar('first_name', { length: 100 }).notNull(),
  lastName:     varchar('last_name', { length: 100 }).notNull(),
  email:        varchar('email', { length: 255 }).notNull(),
  phone:        varchar('phone', { length: 20 }),
  resumeUrl:    text('resume_url'),
  source:       varchar('source', { length: 100 }),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
})

export const applications = pgTable('hrms_applications', {
  id:              uuid('id').primaryKey().defaultRandom(),
  tenantId:        uuid('tenant_id').notNull().references(() => tenants.id),
  requisitionId:   uuid('requisition_id').notNull().references(() => jobRequisitions.id),
  candidateId:     uuid('candidate_id').notNull().references(() => candidates.id),
  status:          varchar('status', { length: 50 }).notNull().default('received'),
  // Statuses: received, shortlisted, interviewed, checks, offer, hired, rejected
  interviewScore:  decimal('interview_score', { precision: 5, scale: 2 }),
  notes:           text('notes'),
  createdAt:       timestamp('created_at').notNull().defaultNow(),
  updatedAt:       timestamp('updated_at').notNull().defaultNow(),
})

// ──────────────────────────────────────────────
// Module 15 — Contracting & E-Sign
// ──────────────────────────────────────────────

export const contracts = pgTable('hrms_contracts', {
  id:             uuid('id').primaryKey().defaultRandom(),
  tenantId:       uuid('tenant_id').notNull().references(() => tenants.id),
  employeeId:     uuid('employee_id').notNull().references(() => employees.id),
  type:           varchar('type', { length: 100 }).notNull(), // employment, casual, contractor
  pdfUrl:         text('pdf_url'),
  signedPdfUrl:   text('signed_pdf_url'),
  status:         varchar('status', { length: 50 }).notNull().default('draft'),
  sentAt:         timestamp('sent_at'),
  signedAt:       timestamp('signed_at'),
  signatureIp:    varchar('signature_ip', { length: 45 }),
  signatureData:  text('signature_data'), // PNG base64
  tfnProvided:    boolean('tfn_provided').notNull().default(false),
  superFund:      varchar('super_fund', { length: 200 }),
  bankBsb:        varchar('bank_bsb', { length: 10 }),
  bankAccount:    varchar('bank_account', { length: 20 }),
  endDate:        date('end_date'), // for fixed-term contracts
  notes:          text('notes'),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
})

// ──────────────────────────────────────────────
// Module 16 — Probation & Performance
// ──────────────────────────────────────────────

export const performanceReviews = pgTable('hrms_performance_reviews', {
  id:              uuid('id').primaryKey().defaultRandom(),
  tenantId:        uuid('tenant_id').notNull().references(() => tenants.id),
  employeeId:      uuid('employee_id').notNull().references(() => employees.id),
  reviewerId:      uuid('reviewer_id').references(() => employees.id),
  type:            varchar('type', { length: 50 }).notNull(), // probation_4wk, mid_probation, end_probation, annual, kpi
  status:          varchar('status', { length: 50 }).notNull().default('scheduled'),
  scheduledDate:   date('scheduled_date'),
  completedAt:     timestamp('completed_at'),
  overallRating:   decimal('overall_rating', { precision: 3, scale: 1 }),
  employeeInput:   jsonb('employee_input'),
  managerInput:    jsonb('manager_input'),
  kpis:            jsonb('kpis').default([]),
  developmentPlan: text('development_plan'),
  outcome:         varchar('outcome', { length: 100 }), // confirmed, extended, pip, terminated
  createdAt:       timestamp('created_at').notNull().defaultNow(),
  updatedAt:       timestamp('updated_at').notNull().defaultNow(),
})

// ──────────────────────────────────────────────
// Module 17 — WHS & Injury Management
// ──────────────────────────────────────────────

export const whsIncidents = pgTable('hrms_whs_incidents', {
  id:              uuid('id').primaryKey().defaultRandom(),
  tenantId:        uuid('tenant_id').notNull().references(() => tenants.id),
  reportedBy:      uuid('reported_by').notNull().references(() => employees.id),
  employeeId:      uuid('employee_id').references(() => employees.id),
  type:            varchar('type', { length: 100 }).notNull(), // hazard, injury, near_miss, unsafe_condition
  severity:        varchar('severity', { length: 50 }), // low, medium, high, critical
  description:     text('description').notNull(),
  location:        varchar('location', { length: 200 }),
  occurredAt:      timestamp('occurred_at').notNull(),
  status:          varchar('status', { length: 50 }).notNull().default('open'),
  correctiveActions: jsonb('corrective_actions').default([]),
  closedAt:        timestamp('closed_at'),
  createdAt:       timestamp('created_at').notNull().defaultNow(),
})

// ──────────────────────────────────────────────
// Module 18 — Grievance & Investigation
// ──────────────────────────────────────────────

export const grievances = pgTable('hrms_grievances', {
  id:             uuid('id').primaryKey().defaultRandom(),
  tenantId:       uuid('tenant_id').notNull().references(() => tenants.id),
  lodgedBy:       uuid('lodged_by').references(() => employees.id), // null = anonymous
  subjectId:      uuid('subject_id').references(() => employees.id),
  type:           varchar('type', { length: 100 }).notNull(), // grievance, misconduct, bullying, safety
  isAnonymous:    boolean('is_anonymous').notNull().default(false),
  riskRating:     varchar('risk_rating', { length: 20 }), // low, medium, high, critical
  description:    text('description').notNull(),
  status:         varchar('status', { length: 50 }).notNull().default('new'),
  // Status flow: new → triage → assigned → evidence → response → findings → outcome → closed
  assignedTo:     uuid('assigned_to'),
  outcome:        text('outcome'),
  closedAt:       timestamp('closed_at'),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
  updatedAt:      timestamp('updated_at').notNull().defaultNow(),
})

// ──────────────────────────────────────────────
// Module 19 — Separation & Exit Management
// ──────────────────────────────────────────────

export const separationRecords = pgTable('hrms_separation_records', {
  id:               uuid('id').primaryKey().defaultRandom(),
  tenantId:         uuid('tenant_id').notNull().references(() => tenants.id),
  employeeId:       uuid('employee_id').notNull().references(() => employees.id),
  type:             varchar('type', { length: 100 }).notNull(), // resignation, termination, redundancy, contract_end
  reason:           text('reason'),
  noticeDate:       date('notice_date'),
  lastWorkingDay:   date('last_working_day'),
  exitInterviewAt:  timestamp('exit_interview_at'),
  exitInterviewNotes: text('exit_interview_notes'),
  checklistComplete: boolean('checklist_complete').notNull().default(false),
  assetsReturned:   boolean('assets_returned').notNull().default(false),
  systemAccessRevoked: boolean('system_access_revoked').notNull().default(false),
  status:           varchar('status', { length: 50 }).notNull().default('pending'),
  createdAt:        timestamp('created_at').notNull().defaultNow(),
})

// ──────────────────────────────────────────────
// Module 26 — Assets & Equipment
// ──────────────────────────────────────────────

export const assets = pgTable('hrms_assets', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id),
  name:         varchar('name', { length: 200 }).notNull(),
  category:     varchar('category', { length: 100 }).notNull(), // uniform, ppe, laptop, keys, etc.
  serialNumber: varchar('serial_number', { length: 100 }),
  status:       varchar('status', { length: 50 }).notNull().default('available'),
  notes:        text('notes'),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
})

export const assetAssignments = pgTable('hrms_asset_assignments', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id),
  assetId:      uuid('asset_id').notNull().references(() => assets.id),
  employeeId:   uuid('employee_id').notNull().references(() => employees.id),
  issuedAt:     timestamp('issued_at').notNull().defaultNow(),
  issuedBy:     uuid('issued_by'),
  returnedAt:   timestamp('returned_at'),
  returnedTo:   uuid('returned_to'),
  condition:    varchar('condition', { length: 50 }),
  notes:        text('notes'),
})

// ──────────────────────────────────────────────
// Module 25 — Employee Voice / Surveys
// ──────────────────────────────────────────────

export const surveys = pgTable('hrms_surveys', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id),
  title:       varchar('title', { length: 300 }).notNull(),
  type:        varchar('type', { length: 100 }), // new_starter_30, probation_90, annual, exit
  isAnonymous: boolean('is_anonymous').notNull().default(true),
  questions:   jsonb('questions').default([]),
  isActive:    boolean('is_active').notNull().default(true),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
})

export const surveyResponses = pgTable('hrms_survey_responses', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id),
  surveyId:    uuid('survey_id').notNull().references(() => surveys.id),
  employeeId:  uuid('employee_id').references(() => employees.id), // null if anonymous
  answers:     jsonb('answers').notNull(),
  submittedAt: timestamp('submitted_at').notNull().defaultNow(),
})

// ──────────────────────────────────────────────
// Module 22 — Recognition & Rewards
// ──────────────────────────────────────────────

export const recognitions = pgTable('hrms_recognitions', {
  id:             uuid('id').primaryKey().defaultRandom(),
  tenantId:       uuid('tenant_id').notNull().references(() => tenants.id),
  recipientId:    uuid('recipient_id').notNull().references(() => employees.id),
  nominatedBy:    uuid('nominated_by').references(() => employees.id),
  type:           varchar('type', { length: 100 }).notNull(), // employee_of_quarter, peer, safety_champion, etc.
  reason:         text('reason'),
  certificateUrl: text('certificate_url'),
  period:         varchar('period', { length: 50 }), // e.g. Q1-2026
  isPublic:       boolean('is_public').notNull().default(true),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
})

// ──────────────────────────────────────────────
// Module 23 — Referral Program
// ──────────────────────────────────────────────

export const referrals = pgTable('hrms_referrals', {
  id:               uuid('id').primaryKey().defaultRandom(),
  tenantId:         uuid('tenant_id').notNull().references(() => tenants.id),
  referrerId:       uuid('referrer_id').notNull().references(() => employees.id),
  referredEmployeeId: uuid('referred_employee_id').references(() => employees.id),
  referredName:     varchar('referred_name', { length: 200 }),
  referredEmail:    varchar('referred_email', { length: 255 }),
  status:           varchar('status', { length: 50 }).notNull().default('pending'),
  bonusAmount:      decimal('bonus_amount', { precision: 10, scale: 2 }),
  bonusPaidAt:      timestamp('bonus_paid_at'),
  notes:            text('notes'),
  createdAt:        timestamp('created_at').notNull().defaultNow(),
})

// ──────────────────────────────────────────────
// Module 27 — Rostering
// ──────────────────────────────────────────────

/** NDIS participants / service recipients linked to shifts */
export const participants = pgTable('hrms_participants', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  firstName:    varchar('first_name', { length: 100 }).notNull(),
  lastName:     varchar('last_name', { length: 100 }).notNull(),
  preferredName:varchar('preferred_name', { length: 100 }),
  ndisNumber:   varchar('ndis_number', { length: 20 }),
  dateOfBirth:  date('date_of_birth'),
  address:      text('address'),
  phone:        varchar('phone', { length: 20 }),
  email:        varchar('email', { length: 255 }),
  // Support details
  supportLevel: varchar('support_level', { length: 100 }),  // e.g. daily_activities, community_participation
  fundingBody:  varchar('funding_body', { length: 100 }).default('NDIS'),
  planStartDate:date('plan_start_date'),
  planEndDate:  date('plan_end_date'),
  notes:        text('notes'),
  isActive:     boolean('is_active').notNull().default(true),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index('participants_tenant_idx').on(t.tenantId),
}))

// ─── Participant Management CRM (Module 39) ──────────────────────────────────

export const participantGoals = pgTable('hrms_participant_goals', {
  id:             uuid('id').primaryKey().defaultRandom(),
  tenantId:       uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  participantId:  uuid('participant_id').notNull().references(() => participants.id, { onDelete: 'cascade' }),
  goalCategory:   varchar('goal_category', { length: 100 }).notNull().default('daily_living'), // daily_living, social_community, employment, health_wellbeing, learning, home_living
  title:          varchar('title', { length: 255 }).notNull(),
  description:    text('description'),
  status:         varchar('status', { length: 50 }).notNull().default('not_started'), // not_started, in_progress, achieved, on_hold, discontinued
  targetDate:     date('target_date'),
  achievedDate:   date('achieved_date'),
  progressNotes:  text('progress_notes'),
  createdBy:      varchar('created_by', { length: 255 }),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
  updatedAt:      timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx:      index('participant_goals_tenant_idx').on(t.tenantId),
  participantIdx: index('participant_goals_participant_idx').on(t.participantId),
}))

export const participantSupportPlans = pgTable('hrms_participant_support_plans', {
  id:                uuid('id').primaryKey().defaultRandom(),
  tenantId:          uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  participantId:     uuid('participant_id').notNull().references(() => participants.id, { onDelete: 'cascade' }),
  planType:          varchar('plan_type', { length: 50 }).notNull().default('initial'),   // initial, review, transition
  title:             varchar('title', { length: 255 }).notNull(),
  status:            varchar('status', { length: 50 }).notNull().default('draft'),        // draft, active, expired, archived
  planStartDate:     date('plan_start_date'),
  planEndDate:       date('plan_end_date'),
  reviewDate:        date('review_date'),
  totalBudget:       decimal('total_budget', { precision: 12, scale: 2 }),
  fundedSupports:    text('funded_supports'),
  coordinatorName:   varchar('coordinator_name', { length: 255 }),
  coordinatorOrg:    varchar('coordinator_org', { length: 255 }),
  coordinatorEmail:  varchar('coordinator_email', { length: 255 }),
  notes:             text('notes'),
  createdBy:         varchar('created_by', { length: 255 }),
  createdAt:         timestamp('created_at').notNull().defaultNow(),
  updatedAt:         timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx:      index('participant_support_plans_tenant_idx').on(t.tenantId),
  participantIdx: index('participant_support_plans_participant_idx').on(t.participantId),
}))

export const participantNotes = pgTable('hrms_participant_notes', {
  id:             uuid('id').primaryKey().defaultRandom(),
  tenantId:       uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  participantId:  uuid('participant_id').notNull().references(() => participants.id, { onDelete: 'cascade' }),
  noteType:       varchar('note_type', { length: 50 }).notNull().default('case_note'), // case_note, progress_note, incident_note, general
  title:          varchar('title', { length: 255 }),
  content:        text('content').notNull(),
  visibility:     varchar('visibility', { length: 50 }).notNull().default('internal'), // internal, shared, participant
  createdBy:      varchar('created_by', { length: 255 }),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
  updatedAt:      timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx:      index('participant_notes_tenant_idx').on(t.tenantId),
  participantIdx: index('participant_notes_participant_idx').on(t.participantId),
}))

export const participantContacts = pgTable('hrms_participant_contacts', {
  id:             uuid('id').primaryKey().defaultRandom(),
  tenantId:       uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  participantId:  uuid('participant_id').notNull().references(() => participants.id, { onDelete: 'cascade' }),
  contactType:    varchar('contact_type', { length: 50 }).notNull().default('emergency'), // emergency, guardian, support_coordinator, family, other
  firstName:      varchar('first_name', { length: 100 }).notNull(),
  lastName:       varchar('last_name', { length: 100 }),
  relationship:   varchar('relationship', { length: 100 }),
  phone:          varchar('phone', { length: 20 }),
  email:          varchar('email', { length: 255 }),
  address:        text('address'),
  isPrimary:      boolean('is_primary').notNull().default(false),
  notes:          text('notes'),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
  updatedAt:      timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx:      index('participant_contacts_tenant_idx').on(t.tenantId),
  participantIdx: index('participant_contacts_participant_idx').on(t.participantId),
}))

// ─── Module 40: Medication & Health Support ───────────────────────────────────

export const participantMedications = pgTable('hrms_participant_medications', {
  id:             uuid('id').primaryKey().defaultRandom(),
  tenantId:       uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  participantId:  uuid('participant_id').notNull().references(() => participants.id, { onDelete: 'cascade' }),
  medicationName: varchar('medication_name', { length: 255 }).notNull(),
  genericName:    varchar('generic_name', { length: 255 }),
  dosage:         varchar('dosage', { length: 100 }),
  form:           varchar('form', { length: 50 }).notNull().default('tablet'),  // tablet, capsule, liquid, injection, patch, inhaler, cream, drops, other
  route:          varchar('route', { length: 50 }).notNull().default('oral'),   // oral, topical, inhaled, injection, sublingual, other
  frequency:      varchar('frequency', { length: 100 }),
  prescribedBy:   varchar('prescribed_by', { length: 255 }),
  indication:     text('indication'),
  instructions:   text('instructions'),
  startDate:      date('start_date'),
  endDate:        date('end_date'),
  status:         varchar('status', { length: 50 }).notNull().default('active'), // active, paused, discontinued, completed
  requiresAssist: boolean('requires_assist').notNull().default(true),
  refrigerated:   boolean('refrigerated').notNull().default(false),
  notes:          text('notes'),
  createdBy:      varchar('created_by', { length: 255 }),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
  updatedAt:      timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx:      index('participant_medications_tenant_idx').on(t.tenantId),
  participantIdx: index('participant_medications_participant_idx').on(t.participantId),
}))

export const participantMedicationLogs = pgTable('hrms_participant_medication_logs', {
  id:            uuid('id').primaryKey().defaultRandom(),
  tenantId:      uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  medicationId:  uuid('medication_id').notNull().references(() => participantMedications.id, { onDelete: 'cascade' }),
  participantId: uuid('participant_id').notNull().references(() => participants.id, { onDelete: 'cascade' }),
  scheduledTime: timestamp('scheduled_time').notNull(),
  administeredAt: timestamp('administered_at'),
  outcome:       varchar('outcome', { length: 50 }).notNull().default('given'), // given, missed, refused, held, partial
  administeredBy: varchar('administered_by', { length: 255 }),
  notes:         text('notes'),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx:      index('medication_logs_tenant_idx').on(t.tenantId),
  medicationIdx:  index('medication_logs_medication_idx').on(t.medicationId),
  participantIdx: index('medication_logs_participant_idx').on(t.participantId),
}))

export const participantHealthConditions = pgTable('hrms_participant_health_conditions', {
  id:             uuid('id').primaryKey().defaultRandom(),
  tenantId:       uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  participantId:  uuid('participant_id').notNull().references(() => participants.id, { onDelete: 'cascade' }),
  conditionName:  varchar('condition_name', { length: 255 }).notNull(),
  conditionType:  varchar('condition_type', { length: 100 }).notNull().default('chronic'), // chronic, acute, allergy, mental_health, disability, other
  icdCode:        varchar('icd_code', { length: 20 }),
  severity:       varchar('severity', { length: 50 }).notNull().default('moderate'), // mild, moderate, severe, critical
  diagnosedDate:  date('diagnosed_date'),
  diagnosedBy:    varchar('diagnosed_by', { length: 255 }),
  status:         varchar('status', { length: 50 }).notNull().default('active'), // active, resolved, managed, monitoring
  description:    text('description'),
  managementPlan: text('management_plan'),
  alerts:         text('alerts'),
  createdBy:      varchar('created_by', { length: 255 }),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
  updatedAt:      timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx:      index('health_conditions_tenant_idx').on(t.tenantId),
  participantIdx: index('health_conditions_participant_idx').on(t.participantId),
}))

export const participantHealthAppointments = pgTable('hrms_participant_health_appointments', {
  id:              uuid('id').primaryKey().defaultRandom(),
  tenantId:        uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  participantId:   uuid('participant_id').notNull().references(() => participants.id, { onDelete: 'cascade' }),
  appointmentType: varchar('appointment_type', { length: 100 }).notNull().default('gp'), // gp, specialist, allied_health, dental, mental_health, other
  providerName:    varchar('provider_name', { length: 255 }),
  providerOrg:     varchar('provider_org', { length: 255 }),
  appointmentDate: date('appointment_date').notNull(),
  appointmentTime: varchar('appointment_time', { length: 10 }),
  location:        varchar('location', { length: 255 }),
  purpose:         text('purpose'),
  outcome:         text('outcome'),
  followUpDate:    date('follow_up_date'),
  followUpNotes:   text('follow_up_notes'),
  status:          varchar('status', { length: 50 }).notNull().default('scheduled'), // scheduled, completed, cancelled, missed
  requiresTransport: boolean('requires_transport').notNull().default(false),
  supportWorkerNeeded: boolean('support_worker_needed').notNull().default(false),
  createdBy:       varchar('created_by', { length: 255 }),
  createdAt:       timestamp('created_at').notNull().defaultNow(),
  updatedAt:       timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx:      index('health_appointments_tenant_idx').on(t.tenantId),
  participantIdx: index('health_appointments_participant_idx').on(t.participantId),
}))

// ─── Module 41: Incident & Behaviour Support ──────────────────────────────────

export const participantIncidents = pgTable('hrms_participant_incidents', {
  id:                uuid('id').primaryKey().defaultRandom(),
  tenantId:          uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  participantId:     uuid('participant_id').notNull().references(() => participants.id, { onDelete: 'cascade' }),
  incidentDate:      date('incident_date').notNull(),
  incidentTime:      varchar('incident_time', { length: 10 }),
  location:          varchar('location', { length: 255 }),
  incidentType:      varchar('incident_type', { length: 100 }).notNull().default('general'),
  severity:          varchar('severity', { length: 50 }).notNull().default('minor'),
  description:       text('description').notNull(),
  immediateAction:   text('immediate_action'),
  witnesses:         text('witnesses'),
  reportedBy:        varchar('reported_by', { length: 255 }),
  reportedTo:        varchar('reported_to', { length: 255 }),
  ndisReportable:    boolean('ndis_reportable').notNull().default(false),
  policeReport:      boolean('police_report').notNull().default(false),
  policeReportNumber:varchar('police_report_number', { length: 100 }),
  status:            varchar('status', { length: 50 }).notNull().default('open'),
  outcome:           text('outcome'),
  followUpRequired:  boolean('follow_up_required').notNull().default(false),
  followUpDate:      date('follow_up_date'),
  followUpNotes:     text('follow_up_notes'),
  createdBy:         varchar('created_by', { length: 255 }),
  createdAt:         timestamp('created_at').notNull().defaultNow(),
  updatedAt:         timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx:      index('participant_incidents_tenant_idx').on(t.tenantId),
  participantIdx: index('participant_incidents_participant_idx').on(t.participantId),
}))

export const participantBehaviourPlans = pgTable('hrms_participant_behaviour_plans', {
  id:                uuid('id').primaryKey().defaultRandom(),
  tenantId:          uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  participantId:     uuid('participant_id').notNull().references(() => participants.id, { onDelete: 'cascade' }),
  planName:          varchar('plan_name', { length: 255 }).notNull(),
  behaviourType:     varchar('behaviour_type', { length: 100 }),
  triggers:          text('triggers'),
  earlyWarnings:     text('early_warnings'),
  preventionStrategies: text('prevention_strategies'),
  deEscalationStrategies: text('de_escalation_strategies'),
  responseStrategies: text('response_strategies'),
  postIncidentSupport: text('post_incident_support'),
  authorisedBy:      varchar('authorised_by', { length: 255 }),
  reviewDate:        date('review_date'),
  status:            varchar('status', { length: 50 }).notNull().default('active'),
  notes:             text('notes'),
  createdBy:         varchar('created_by', { length: 255 }),
  createdAt:         timestamp('created_at').notNull().defaultNow(),
  updatedAt:         timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx:      index('behaviour_plans_tenant_idx').on(t.tenantId),
  participantIdx: index('behaviour_plans_participant_idx').on(t.participantId),
}))

export const participantRestrictivePractices = pgTable('hrms_participant_restrictive_practices', {
  id:                uuid('id').primaryKey().defaultRandom(),
  tenantId:          uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  participantId:     uuid('participant_id').notNull().references(() => participants.id, { onDelete: 'cascade' }),
  practiceType:      varchar('practice_type', { length: 100 }).notNull(),
  description:       text('description').notNull(),
  authorisedBy:      varchar('authorised_by', { length: 255 }),
  authorisedDate:    date('authorised_date'),
  expiryDate:        date('expiry_date'),
  regulatoryApproval:boolean('regulatory_approval').notNull().default(false),
  approvalReference: varchar('approval_reference', { length: 255 }),
  monitoringFrequency: varchar('monitoring_frequency', { length: 100 }),
  lastReviewDate:    date('last_review_date'),
  nextReviewDate:    date('next_review_date'),
  status:            varchar('status', { length: 50 }).notNull().default('active'),
  notes:             text('notes'),
  createdBy:         varchar('created_by', { length: 255 }),
  createdAt:         timestamp('created_at').notNull().defaultNow(),
  updatedAt:         timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx:      index('restrictive_practices_tenant_idx').on(t.tenantId),
  participantIdx: index('restrictive_practices_participant_idx').on(t.participantId),
}))

// ─── Module 42: Roster & Shift Management ────────────────────────────────────

export const rosterTemplates = pgTable('hrms_roster_templates', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name:        varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  status:      varchar('status', { length: 50 }).notNull().default('active'),
  createdBy:   varchar('created_by', { length: 255 }),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  updatedAt:   timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index('roster_templates_tenant_idx').on(t.tenantId),
}))

export const rosterTemplateSlots = pgTable('hrms_roster_template_slots', {
  id:             uuid('id').primaryKey().defaultRandom(),
  tenantId:       uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  templateId:     uuid('template_id').notNull().references(() => rosterTemplates.id, { onDelete: 'cascade' }),
  dayOfWeek:      integer('day_of_week').notNull(), // 0=Mon, 6=Sun
  startTime:      varchar('start_time', { length: 5 }).notNull(), // HH:MM
  endTime:        varchar('end_time', { length: 5 }).notNull(),
  shiftType:      varchar('shift_type', { length: 100 }).notNull().default('standard'),
  location:       varchar('location', { length: 255 }),
  participantId:  uuid('participant_id'),
  requiredStaff:  integer('required_staff').notNull().default(1),
  notes:          text('notes'),
}, (t) => ({
  templateIdx: index('roster_template_slots_template_idx').on(t.templateId),
}))

export const shiftSwapRequests = pgTable('hrms_shift_swap_requests', {
  id:              uuid('id').primaryKey().defaultRandom(),
  tenantId:        uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  shiftId:         uuid('shift_id').notNull().references(() => shifts.id, { onDelete: 'cascade' }),
  requestedById:   uuid('requested_by_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  swapWithId:      uuid('swap_with_id').references(() => employees.id),
  reason:          text('reason'),
  status:          varchar('status', { length: 50 }).notNull().default('pending'),
  reviewedBy:      varchar('reviewed_by', { length: 255 }),
  reviewedAt:      timestamp('reviewed_at'),
  reviewNotes:     text('review_notes'),
  createdAt:       timestamp('created_at').notNull().defaultNow(),
  updatedAt:       timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index('shift_swap_requests_tenant_idx').on(t.tenantId),
  shiftIdx:  index('shift_swap_requests_shift_idx').on(t.shiftId),
}))

export const shifts = pgTable('hrms_shifts', {
  id:            uuid('id').primaryKey().defaultRandom(),
  tenantId:      uuid('tenant_id').notNull().references(() => tenants.id),
  employeeId:    uuid('employee_id').notNull().references(() => employees.id),
  participantId: uuid('participant_id').references(() => participants.id),
  startTime:     timestamp('start_time').notNull(),
  endTime:       timestamp('end_time').notNull(),
  shiftType:     varchar('shift_type', { length: 100 }).default('standard'), // standard, sleepover, active_night, on_call
  location:      varchar('location', { length: 200 }),
  clientSite:    varchar('client_site', { length: 200 }),
  status:        varchar('status', { length: 50 }).notNull().default('draft'), // draft, published, confirmed, completed, cancelled
  publishedAt:   timestamp('published_at'),
  compliancePassed: boolean('compliance_passed').notNull().default(false),
  notes:         text('notes'),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
  updatedAt:     timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx:  index('shifts_tenant_idx').on(t.tenantId),
  empIdx:     index('shifts_employee_idx').on(t.employeeId),
  timeIdx:    index('shifts_time_idx').on(t.startTime, t.endTime),
}))

export const timesheets = pgTable('hrms_timesheets', {
  id:            uuid('id').primaryKey().defaultRandom(),
  tenantId:      uuid('tenant_id').notNull().references(() => tenants.id),
  employeeId:    uuid('employee_id').notNull().references(() => employees.id),
  shiftId:       uuid('shift_id').references(() => shifts.id),
  clockIn:       timestamp('clock_in'),
  clockOut:      timestamp('clock_out'),
  breakMinutes:  integer('break_minutes').notNull().default(0),
  hoursWorked:   decimal('hours_worked', { precision: 5, scale: 2 }),
  notes:         text('notes'),
  approvedBy:    uuid('approved_by'),
  approvedAt:    timestamp('approved_at'),
  rejectedReason:text('rejected_reason'),
  status:        varchar('status', { length: 50 }).notNull().default('pending'), // pending, submitted, approved, rejected
  createdAt:     timestamp('created_at').notNull().defaultNow(),
  updatedAt:     timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index('timesheets_tenant_idx').on(t.tenantId),
  empIdx:    index('timesheets_employee_idx').on(t.employeeId),
}))

// ──────────────────────────────────────────────
// Employee Availability (for rostering)
// ──────────────────────────────────────────────

/** Weekly recurring availability slots per employee */
export const employeeAvailability = pgTable('hrms_employee_availability', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id),
  employeeId:  uuid('employee_id').notNull().references(() => employees.id),
  dayOfWeek:   integer('day_of_week').notNull(), // 0=Mon … 6=Sun
  startTime:   varchar('start_time', { length: 5 }).notNull(),  // HH:MM
  endTime:     varchar('end_time',   { length: 5 }).notNull(),  // HH:MM
  isAvailable: boolean('is_available').notNull().default(true),
  note:        text('note'),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  updatedAt:   timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index('availability_tenant_idx').on(t.tenantId),
  empIdx:    index('availability_emp_idx').on(t.employeeId),
}))

// ──────────────────────────────────────────────
// Module 28 — Payroll
// ──────────────────────────────────────────────

export const payrollRecords = pgTable('hrms_payroll_records', {
  id:               uuid('id').primaryKey().defaultRandom(),
  tenantId:         uuid('tenant_id').notNull().references(() => tenants.id),
  employeeId:       uuid('employee_id').notNull().references(() => employees.id),
  periodStart:      date('period_start').notNull(),
  periodEnd:        date('period_end').notNull(),
  // Pay inputs
  hoursWorked:      decimal('hours_worked', { precision: 8, scale: 2 }),
  hourlyRate:       decimal('hourly_rate', { precision: 10, scale: 4 }),
  // Calculated amounts
  grossPay:         decimal('gross_pay', { precision: 10, scale: 2 }),
  paygWithholding:  decimal('payg_withholding', { precision: 10, scale: 2 }),
  medicareLevy:     decimal('medicare_levy', { precision: 10, scale: 2 }),
  superContribution:decimal('super_contribution', { precision: 10, scale: 2 }),
  netPay:           decimal('net_pay', { precision: 10, scale: 2 }),
  // Full breakdown stored as JSON (allowances, deductions, leave loadings, etc.)
  payslipData:      jsonb('payslip_data').default({}),
  status:           varchar('status', { length: 50 }).notNull().default('pending'),
  exportedToXero:   boolean('exported_to_xero').notNull().default(false),
  exportedAt:       timestamp('exported_at'),
  createdAt:        timestamp('created_at').notNull().defaultNow(),
})

// ──────────────────────────────────────────────
// Module 13 — Workforce Planning
// ──────────────────────────────────────────────

export const headcountPlan = pgTable('hrms_headcount_plan', {
  id:             uuid('id').primaryKey().defaultRandom(),
  tenantId:       uuid('tenant_id').notNull().references(() => tenants.id),
  departmentId:   uuid('department_id').references(() => departments.id),
  positionId:     uuid('position_id').references(() => positions.id),
  plannedCount:   integer('planned_count').notNull(),
  currentCount:   integer('current_count').notNull().default(0),
  vacancyCount:   integer('vacancy_count').notNull().default(0),
  targetDate:     date('target_date'),
  status:         varchar('status', { length: 50 }).notNull().default('open'),
  notes:          text('notes'),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
})

// ──────────────────────────────────────────────
// Module 24 — DEI
// ──────────────────────────────────────────────

export const diversityData = pgTable('hrms_diversity_data', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  tenantId:             uuid('tenant_id').notNull().references(() => tenants.id),
  employeeId:           uuid('employee_id').notNull().references(() => employees.id),
  gender:               varchar('gender', { length: 50 }),
  indigenousStatus:     boolean('indigenous_status'),
  disabilityStatus:     boolean('disability_status'),
  culturalBackground:   varchar('cultural_background', { length: 100 }),
  adjustmentsRequired:  text('adjustments_required'),
  selfReported:         boolean('self_reported').notNull().default(true),
  createdAt:            timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  empUnique: uniqueIndex('diversity_employee_unique').on(t.tenantId, t.employeeId),
}))

// ──────────────────────────────────────────────
// Module 21 — Employee Experience & Benefits
// ──────────────────────────────────────────────

export const employeeBenefits = pgTable('hrms_employee_benefits', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id),
  employeeId:   uuid('employee_id').notNull().references(() => employees.id),
  type:         varchar('type', { length: 100 }).notNull(), // eap, study_support, discount, etc.
  description:  text('description'),
  startDate:    date('start_date'),
  endDate:      date('end_date'),
  notes:        text('notes'),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
})

// ──────────────────────────────────────────────
// Notifications (cross-module)
// ──────────────────────────────────────────────

export const notifications = pgTable('hrms_notifications', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id),
  userId:      uuid('user_id').notNull().references(() => users.id),
  type:        varchar('type', { length: 100 }).notNull(),
  title:       varchar('title', { length: 300 }).notNull(),
  body:        text('body'),
  isRead:      boolean('is_read').notNull().default(false),
  link:        varchar('link', { length: 500 }),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  userIdx: index('notifications_user_idx').on(t.userId),
}))

// ──────────────────────────────────────────────
// Employee Notes
// ──────────────────────────────────────────────

export const employeeNotes = pgTable('hrms_employee_notes', {
  id:         uuid('id').primaryKey().defaultRandom(),
  tenantId:   uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  authorId:   uuid('author_id').notNull().references(() => users.id),
  authorEmail:varchar('author_email', { length: 255 }).notNull(),
  content:    text('content').notNull(),
  createdAt:  timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx:   index('employee_notes_tenant_idx').on(t.tenantId),
  employeeIdx: index('employee_notes_employee_idx').on(t.employeeId),
}))

// ──────────────────────────────────────────────
// Platform — Super Admins (no tenant FK)
// ──────────────────────────────────────────────

export const superAdmins = pgTable('hrms_super_admins', {
  id:           uuid('id').primaryKey().defaultRandom(),
  email:        varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name:         varchar('name', { length: 255 }).notNull(),
  isActive:     boolean('is_active').notNull().default(true),
  lastLoginAt:  timestamp('last_login_at'),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
})

// ──────────────────────────────────────────────
// Platform — Announcements (no tenant FK)
// Broadcast messages from super admins to all tenants or specific ones.
// ──────────────────────────────────────────────

// ── Leave Management ─────────────────────────────────────────────────────────
export const leaveTypeEnum   = pgEnum('leave_type',   ['annual', 'sick', 'personal', 'unpaid', 'long_service', 'carer', 'compassionate'])
export const leaveStatusEnum = pgEnum('leave_status', ['pending', 'approved', 'rejected', 'cancelled'])

export const leaveRequests = pgTable('hrms_leave_requests', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId:   uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  leaveType:    leaveTypeEnum('leave_type').notNull(),
  startDate:    date('start_date').notNull(),
  endDate:      date('end_date').notNull(),
  totalDays:    integer('total_days').notNull(),
  reason:       text('reason'),
  status:       leaveStatusEnum('status').notNull().default('pending'),
  reviewedBy:   varchar('reviewed_by', { length: 255 }), // user id (JWT sub) of approver
  reviewedAt:   timestamp('reviewed_at'),
  reviewNote:   text('review_note'),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx:    index('leave_tenant_idx').on(t.tenantId),
  employeeIdx:  index('leave_employee_idx').on(t.employeeId),
  statusIdx:    index('leave_status_idx').on(t.status),
  dateIdx:      index('leave_date_idx').on(t.startDate),
}))

// ── Public Holidays ───────────────────────────────────────────────────────────
export const publicHolidays = pgTable('hrms_public_holidays', {
  id:         uuid('id').primaryKey().defaultRandom(),
  tenantId:   uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name:       varchar('name', { length: 200 }).notNull(),
  date:       date('date').notNull(),
  country:    varchar('country', { length: 10 }).notNull().default('AU'),
  state:      varchar('state', { length: 10 }),  // null = national
  isNational: boolean('is_national').notNull().default(true),
  createdAt:  timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx:  index('ph_tenant_idx').on(t.tenantId),
  dateIdx:    index('ph_date_idx').on(t.date),
  uniqueIdx:  uniqueIndex('ph_unique').on(t.tenantId, t.date, t.name),
}))

// ──────────────────────────────────────────────
// Module 15 — Offer Letters & Acceptance Tracking
// ──────────────────────────────────────────────

export const offerLetters = pgTable('hrms_offer_letters', {
  id:               uuid('id').primaryKey().defaultRandom(),
  tenantId:         uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  // Candidate (pre-hire — may not have an employee record yet)
  candidateName:    varchar('candidate_name', { length: 255 }).notNull(),
  candidateEmail:   varchar('candidate_email', { length: 255 }).notNull(),
  // Position
  position:         varchar('position', { length: 255 }).notNull(),
  department:       varchar('department', { length: 255 }),
  employmentType:   varchar('employment_type', { length: 50 }).notNull().default('full_time'),
  startDate:        date('start_date'),
  salaryAmount:     integer('salary_amount'),  // annual gross in dollars
  salaryCycle:      varchar('salary_cycle', { length: 20 }).notNull().default('annual'),
  // Template content (markdown/plain text — rendered into PDF)
  templateContent:  text('template_content'),
  pdfUrl:           text('pdf_url'),
  // Status lifecycle: draft → sent → accepted | rejected | expired | withdrawn
  status:           varchar('status', { length: 50 }).notNull().default('draft'),
  sentAt:           timestamp('sent_at'),
  acceptedAt:       timestamp('accepted_at'),
  rejectedAt:       timestamp('rejected_at'),
  expiresAt:        timestamp('expires_at'),
  // One-time token for candidate self-service accept/reject link (TODO: email via Resend)
  acceptanceToken:  text('acceptance_token'),
  // Optional links
  recruitmentId:    uuid('recruitment_id'),
  employeeId:       uuid('employee_id').references(() => employees.id),
  createdBy:        varchar('created_by', { length: 255 }),
  notes:            text('notes'),
  createdAt:        timestamp('created_at').notNull().defaultNow(),
  updatedAt:        timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx:  index('offer_letters_tenant_idx').on(t.tenantId),
  statusIdx:  index('offer_letters_status_idx').on(t.status),
  emailIdx:   index('offer_letters_email_idx').on(t.candidateEmail),
}))

export const offerLetterEvents = pgTable('hrms_offer_letter_events', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  offerId:     uuid('offer_id').notNull().references(() => offerLetters.id, { onDelete: 'cascade' }),
  // Event types: created | sent | viewed | accepted | rejected | expired | withdrawn | pdf_generated | note_added
  event:       varchar('event', { length: 100 }).notNull(),
  note:        text('note'),
  performedBy: varchar('performed_by', { length: 255 }),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  offerIdx:  index('offer_events_offer_idx').on(t.offerId),
}))

// ──────────────────────────────────────────────
// Module 16 — Promotion Cases
// ──────────────────────────────────────────────

export const promotionRequests = pgTable('hrms_promotion_requests', {
  id:              uuid('id').primaryKey().defaultRandom(),
  tenantId:        uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId:      uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  // Raised by (manager / HR)
  raisedById:      varchar('raised_by_id', { length: 255 }),
  raisedByName:    varchar('raised_by_name', { length: 255 }),
  // Current position snapshot
  currentTitle:    varchar('current_title', { length: 255 }),
  currentSalary:   integer('current_salary'),
  // Proposed
  proposedTitle:   varchar('proposed_title', { length: 255 }).notNull(),
  proposedSalary:  integer('proposed_salary'),
  effectiveDate:   date('effective_date'),
  // Case details
  justification:   text('justification').notNull(),
  // Status lifecycle: pending → under_review → approved | rejected → implemented
  status:          varchar('status', { length: 50 }).notNull().default('pending'),
  reviewedBy:      varchar('reviewed_by', { length: 255 }),
  reviewedAt:      timestamp('reviewed_at'),
  reviewNotes:     text('review_notes'),
  implementedAt:   timestamp('implemented_at'),
  createdAt:       timestamp('created_at').notNull().defaultNow(),
  updatedAt:       timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx:    index('promotions_tenant_idx').on(t.tenantId),
  employeeIdx:  index('promotions_employee_idx').on(t.employeeId),
  statusIdx:    index('promotions_status_idx').on(t.status),
}))

export const promotionEvents = pgTable('hrms_promotion_events', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  promotionId:  uuid('promotion_id').notNull().references(() => promotionRequests.id, { onDelete: 'cascade' }),
  // Event types: raised | submitted_for_review | approved | rejected | implemented | note_added | salary_updated
  event:        varchar('event', { length: 100 }).notNull(),
  note:         text('note'),
  performedBy:  varchar('performed_by', { length: 255 }),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  promotionIdx: index('promotion_events_promo_idx').on(t.promotionId),
}))

// ──────────────────────────────────────────────
// Module 19 — Separation Event History
// (extends existing separationRecords)
// ──────────────────────────────────────────────

export const separationEvents = pgTable('hrms_separation_events', {
  id:            uuid('id').primaryKey().defaultRandom(),
  tenantId:      uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  separationId:  uuid('separation_id').notNull().references(() => separationRecords.id, { onDelete: 'cascade' }),
  // Event types: initiated | notice_received | exit_interview_scheduled | exit_interview_done
  //              assets_returned | access_revoked | completed | note_added | document_uploaded
  event:         varchar('event', { length: 100 }).notNull(),
  note:          text('note'),
  performedBy:   varchar('performed_by', { length: 255 }),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  sepIdx: index('separation_events_sep_idx').on(t.separationId),
}))

// ──────────────────────────────────────────────
// Module 17b — Performance Goals
// (linked to performanceReviews above)
// ──────────────────────────────────────────────

export const performanceGoals = pgTable('hrms_performance_goals', {
  id:            uuid('id').primaryKey().defaultRandom(),
  tenantId:      uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId:    uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  reviewId:      uuid('review_id').references(() => performanceReviews.id, { onDelete: 'set null' }),
  title:         varchar('title', { length: 255 }).notNull(),
  description:   text('description'),
  category:      varchar('category', { length: 100 }),
  targetDate:    date('target_date'),
  status:        varchar('status', { length: 50 }).notNull().default('active'),
  progress:      integer('progress').notNull().default(0),
  selfRating:    integer('self_rating'),
  managerRating: integer('manager_rating'),
  managerNote:   text('manager_note'),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
  updatedAt:     timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx:   index('perf_goals_tenant_idx').on(t.tenantId),
  employeeIdx: index('perf_goals_employee_idx').on(t.employeeId),
  reviewIdx:   index('perf_goals_review_idx').on(t.reviewId),
}))

export const announcementPriorityEnum = pgEnum('announcement_priority', ['info', 'warning', 'critical'])

export const platformAnnouncements = pgTable('hrms_platform_announcements', {
  id:             uuid('id').primaryKey().defaultRandom(),
  title:          varchar('title', { length: 300 }).notNull(),
  body:           text('body').notNull(),
  priority:       announcementPriorityEnum('priority').notNull().default('info'),
  // 'all' or a JSON array of tenant IDs
  targetTenants:  text('target_tenants').notNull().default('all'),
  expiresAt:      timestamp('expires_at'),
  isActive:       boolean('is_active').notNull().default(true),
  createdBy:      varchar('created_by', { length: 255 }).notNull(), // super admin email
  createdAt:      timestamp('created_at').notNull().defaultNow(),
  updatedAt:      timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  activeIdx:   index('announcements_active_idx').on(t.isActive),
  createdIdx:  index('announcements_created_idx').on(t.createdAt),
}))

// ──────────────────────────────────────────────
// Offer Letter — Custom Templates (per tenant)
// ──────────────────────────────────────────────
export const offerLetterTemplates = pgTable('hrms_offer_letter_templates', {
  id:        uuid('id').primaryKey().defaultRandom(),
  tenantId:  uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name:      varchar('name', { length: 255 }).notNull(),
  content:   text('content').notNull(),           // extracted plain text with {{merge}} tags
  fileUrl:   text('file_url'),                    // original uploaded file (Vercel Blob)
  isActive:  boolean('is_active').notNull().default(true),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index('offer_tmpl_tenant_idx').on(t.tenantId),
}))

// ──────────────────────────────────────────────
// CRM — Core (Leads, Contacts, Accounts, Deals)
// ──────────────────────────────────────────────

export const crmLeads = pgTable('hrms_crm_leads', {
  id:            uuid('id').primaryKey().defaultRandom(),
  tenantId:      uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  firstName:     varchar('first_name', { length: 255 }).notNull(),
  lastName:      varchar('last_name', { length: 255 }),
  email:         varchar('email', { length: 255 }),
  phone:         varchar('phone', { length: 50 }),
  company:       varchar('company', { length: 255 }),
  jobTitle:      varchar('job_title', { length: 255 }),
  source:        varchar('source', { length: 100 }),       // website, referral, linkedin, cold_call, etc.
  status:        varchar('status', { length: 50 }).notNull().default('new'),  // new, contacted, qualified, converted, lost
  stage:         varchar('stage', { length: 50 }).notNull().default('new'),   // Kanban column
  score:         integer('score').default(0),
  assignedTo:    varchar('assigned_to', { length: 255 }),  // user email
  notes:         text('notes'),
  tags:          jsonb('tags').$type<string[]>().default([]),
  customFields:  jsonb('custom_fields').$type<Record<string, unknown>>().default({}),
  convertedAt:   timestamp('converted_at'),
  convertedToId: uuid('converted_to_id'),                 // contact id after conversion
  createdBy:     varchar('created_by', { length: 255 }),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
  updatedAt:     timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx:  index('crm_leads_tenant_idx').on(t.tenantId),
  statusIdx:  index('crm_leads_status_idx').on(t.status),
  assignedIdx: index('crm_leads_assigned_idx').on(t.assignedTo),
}))

export const crmContacts = pgTable('hrms_crm_contacts', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  accountId:    uuid('account_id'),
  firstName:    varchar('first_name', { length: 255 }).notNull(),
  lastName:     varchar('last_name', { length: 255 }),
  email:        varchar('email', { length: 255 }),
  phone:        varchar('phone', { length: 50 }),
  mobile:       varchar('mobile', { length: 50 }),
  jobTitle:     varchar('job_title', { length: 255 }),
  department:   varchar('department', { length: 255 }),
  isPrimary:    boolean('is_primary').default(false),
  assignedTo:   varchar('assigned_to', { length: 255 }),
  notes:        text('notes'),
  tags:         jsonb('tags').$type<string[]>().default([]),
  customFields: jsonb('custom_fields').$type<Record<string, unknown>>().default({}),
  createdBy:    varchar('created_by', { length: 255 }),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx:  index('crm_contacts_tenant_idx').on(t.tenantId),
  accountIdx: index('crm_contacts_account_idx').on(t.accountId),
}))

export const crmAccounts = pgTable('hrms_crm_accounts', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name:         varchar('name', { length: 255 }).notNull(),
  industry:     varchar('industry', { length: 100 }),
  website:      varchar('website', { length: 500 }),
  phone:        varchar('phone', { length: 50 }),
  email:        varchar('email', { length: 255 }),
  address:      text('address'),
  city:         varchar('city', { length: 100 }),
  state:        varchar('state', { length: 100 }),
  country:      varchar('country', { length: 100 }),
  abn:          varchar('abn', { length: 20 }),
  revenue:      decimal('revenue', { precision: 15, scale: 2 }),
  employees:    integer('employees'),
  type:         varchar('type', { length: 50 }).default('prospect'),   // prospect, customer, partner, vendor
  status:       varchar('status', { length: 50 }).default('active'),
  assignedTo:   varchar('assigned_to', { length: 255 }),
  notes:        text('notes'),
  tags:         jsonb('tags').$type<string[]>().default([]),
  customFields: jsonb('custom_fields').$type<Record<string, unknown>>().default({}),
  createdBy:    varchar('created_by', { length: 255 }),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index('crm_accounts_tenant_idx').on(t.tenantId),
  nameIdx:   index('crm_accounts_name_idx').on(t.name),
}))

export const crmDeals = pgTable('hrms_crm_deals', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  accountId:    uuid('account_id'),
  contactId:    uuid('contact_id'),
  title:        varchar('title', { length: 255 }).notNull(),
  value:        decimal('value', { precision: 15, scale: 2 }),
  currency:     varchar('currency', { length: 10 }).default('AUD'),
  stage:        varchar('stage', { length: 50 }).notNull().default('prospecting'),
  // prospecting, qualification, proposal, negotiation, closed_won, closed_lost
  probability:  integer('probability').default(0),
  closeDate:    date('close_date'),
  source:       varchar('source', { length: 100 }),
  assignedTo:   varchar('assigned_to', { length: 255 }),
  notes:        text('notes'),
  lostReason:   text('lost_reason'),
  tags:         jsonb('tags').$type<string[]>().default([]),
  customFields: jsonb('custom_fields').$type<Record<string, unknown>>().default({}),
  createdBy:    varchar('created_by', { length: 255 }),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx:  index('crm_deals_tenant_idx').on(t.tenantId),
  stageIdx:   index('crm_deals_stage_idx').on(t.stage),
  accountIdx: index('crm_deals_account_idx').on(t.accountId),
}))

export const crmActivities = pgTable('hrms_crm_activities', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  type:        varchar('type', { length: 50 }).notNull(), // call, email, meeting, note, task
  subject:     varchar('subject', { length: 255 }).notNull(),
  notes:       text('notes'),
  dueDate:     timestamp('due_date'),
  completedAt: timestamp('completed_at'),
  isDone:      boolean('is_done').default(false),
  // Polymorphic association
  relatedType: varchar('related_type', { length: 50 }),   // lead, contact, account, deal
  relatedId:   uuid('related_id'),
  assignedTo:  varchar('assigned_to', { length: 255 }),
  createdBy:   varchar('created_by', { length: 255 }),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  updatedAt:   timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx:   index('crm_activities_tenant_idx').on(t.tenantId),
  relatedIdx:  index('crm_activities_related_idx').on(t.relatedType, t.relatedId),
  assignedIdx: index('crm_activities_assigned_idx').on(t.assignedTo),
}))

// ─── NDIS Practice Standards Audit ──────────────────────────────────────────

export const ndisAudits = pgTable('hrms_ndis_audits', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  title:        varchar('title', { length: 255 }).notNull(),
  auditType:    varchar('audit_type', { length: 100 }).notNull(), // internal, external, certification, surveillance
  standard:     varchar('standard', { length: 255 }).notNull(),   // e.g. "NDIS Practice Standard 1.1 — Person-centred Supports"
  outcomeGroup: varchar('outcome_group', { length: 100 }),        // rights_protection, governance, support_provision, workforce
  status:       varchar('status', { length: 50 }).notNull().default('scheduled'), // scheduled, in_progress, completed, overdue
  result:       varchar('result', { length: 50 }),                // conformant, non_conformant, not_applicable, partial
  riskRating:   varchar('risk_rating', { length: 50 }),           // low, medium, high, critical
  scheduledDate: date('scheduled_date').notNull(),
  completedDate: date('completed_date'),
  nextReviewDate: date('next_review_date'),
  auditorName:  varchar('auditor_name', { length: 255 }),
  auditorOrg:   varchar('auditor_org', { length: 255 }),
  findingSummary: text('finding_summary'),
  correctiveActions: text('corrective_actions'),
  evidenceUrl:  varchar('evidence_url', { length: 1000 }),
  notes:        text('notes'),
  assignedTo:   varchar('assigned_to', { length: 255 }),
  createdBy:    varchar('created_by', { length: 255 }),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx:  index('ndis_audits_tenant_idx').on(t.tenantId),
  statusIdx:  index('ndis_audits_status_idx').on(t.status),
  dateIdx:    index('ndis_audits_date_idx').on(t.scheduledDate),
}))

export const ndisAuditActions = pgTable('hrms_ndis_audit_actions', {
  id:          uuid('id').primaryKey().defaultRandom(),
  tenantId:    uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  auditId:     uuid('audit_id').notNull().references(() => ndisAudits.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  priority:    varchar('priority', { length: 50 }).notNull().default('medium'), // low, medium, high, critical
  status:      varchar('status', { length: 50 }).notNull().default('open'),     // open, in_progress, resolved, closed
  dueDate:     date('due_date'),
  resolvedAt:  timestamp('resolved_at'),
  assignedTo:  varchar('assigned_to', { length: 255 }),
  notes:       text('notes'),
  createdBy:   varchar('created_by', { length: 255 }),
  createdAt:   timestamp('created_at').notNull().defaultNow(),
  updatedAt:   timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index('ndis_audit_actions_tenant_idx').on(t.tenantId),
  auditIdx:  index('ndis_audit_actions_audit_idx').on(t.auditId),
}))

// ─── NDIS Reportable Incidents ───────────────────────────────────────────────

export const ndisIncidents = pgTable('hrms_ndis_incidents', {
  id:               uuid('id').primaryKey().defaultRandom(),
  tenantId:         uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  // Classification
  incidentType:     varchar('incident_type', { length: 100 }).notNull(), // death, serious_injury, abuse, neglect, unlawful_sexual, unauthorised_restrictive_practice, other
  incidentCategory: varchar('incident_category', { length: 100 }),       // sub-category
  isReportable:     boolean('is_reportable').notNull().default(true),     // must be reported to NDIS Commission
  // Status & workflow
  status:           varchar('status', { length: 50 }).notNull().default('open'), // open, under_review, reported_to_commission, closed
  severity:         varchar('severity', { length: 50 }).notNull().default('medium'), // low, medium, high, critical
  // People involved
  participantId:    uuid('participant_id').references(() => participants.id, { onDelete: 'set null' }),
  participantName:  varchar('participant_name', { length: 255 }),         // fallback if not in DB
  workerName:       varchar('worker_name', { length: 255 }),
  workerRole:       varchar('worker_role', { length: 100 }),
  witnessNames:     text('witness_names'),
  // Incident details
  title:            varchar('title', { length: 255 }).notNull(),
  description:      text('description').notNull(),
  location:         varchar('location', { length: 500 }),
  incidentDate:     timestamp('incident_date').notNull(),
  discoveredDate:   timestamp('discovered_date'),
  reportedInternally: boolean('reported_internally').notNull().default(false),
  internalReportDate: date('internal_report_date'),
  // NDIS Commission reporting
  commissionNotified: boolean('commission_notified').notNull().default(false),
  commissionNotifyDate: date('commission_notify_date'),
  commissionRefNumber:  varchar('commission_ref_number', { length: 100 }),
  // Police / external
  policeNotified:   boolean('police_notified').notNull().default(false),
  policeReportNumber: varchar('police_report_number', { length: 100 }),
  // Response & outcome
  immediateActions: text('immediate_actions'),
  rootCause:        text('root_cause'),
  outcomeDescription: text('outcome_description'),
  // Evidence & docs
  evidenceUrl:      varchar('evidence_url', { length: 1000 }),
  // Meta
  assignedTo:       varchar('assigned_to', { length: 255 }),
  notes:            text('notes'),
  createdBy:        varchar('created_by', { length: 255 }),
  createdAt:        timestamp('created_at').notNull().defaultNow(),
  updatedAt:        timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx:    index('ndis_incidents_tenant_idx').on(t.tenantId),
  statusIdx:    index('ndis_incidents_status_idx').on(t.status),
  dateIdx:      index('ndis_incidents_date_idx').on(t.incidentDate),
  participantIdx: index('ndis_incidents_participant_idx').on(t.participantId),
}))

export const ndisIncidentActions = pgTable('hrms_ndis_incident_actions', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  incidentId:   uuid('incident_id').notNull().references(() => ndisIncidents.id, { onDelete: 'cascade' }),
  description:  text('description').notNull(),
  actionType:   varchar('action_type', { length: 100 }).default('corrective'), // corrective, preventive, notification, investigation
  priority:     varchar('priority', { length: 50 }).notNull().default('medium'),
  status:       varchar('status', { length: 50 }).notNull().default('open'),
  dueDate:      date('due_date'),
  resolvedAt:   timestamp('resolved_at'),
  assignedTo:   varchar('assigned_to', { length: 255 }),
  notes:        text('notes'),
  createdBy:    varchar('created_by', { length: 255 }),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx:    index('ndis_incident_actions_tenant_idx').on(t.tenantId),
  incidentIdx:  index('ndis_incident_actions_incident_idx').on(t.incidentId),
}))

// ─── Expense Management ──────────────────────────────────────────────────────

export const expenseClaims = pgTable('hrms_expense_claims', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId:   uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  title:        varchar('title', { length: 255 }).notNull(),
  category:     varchar('category', { length: 100 }).notNull(), // travel, meals, accommodation, equipment, training, other
  amount:       decimal('amount', { precision: 15, scale: 2 }).notNull(),
  currency:     varchar('currency', { length: 10 }).default('AUD'),
  expenseDate:  date('expense_date').notNull(),
  description:  text('description'),
  receiptUrl:   varchar('receipt_url', { length: 1000 }),
  status:       varchar('status', { length: 50 }).notNull().default('pending'), // pending, approved, rejected, paid
  submittedAt:  timestamp('submitted_at').defaultNow(),
  reviewedBy:   varchar('reviewed_by', { length: 255 }),
  reviewedAt:   timestamp('reviewed_at'),
  reviewNotes:  text('review_notes'),
  paidAt:       timestamp('paid_at'),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx:   index('expense_claims_tenant_idx').on(t.tenantId),
  employeeIdx: index('expense_claims_employee_idx').on(t.employeeId),
  statusIdx:   index('expense_claims_status_idx').on(t.status),
}))

// ─── Module 43: Payroll & Finance ────────────────────────────────────────────

export const payrollRuns = pgTable('hrms_payroll_runs', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull(),
  name:         varchar('name', { length: 255 }).notNull(),
  periodStart:  date('period_start').notNull(),
  periodEnd:    date('period_end').notNull(),
  payDate:      date('pay_date'),
  frequency:    varchar('frequency', { length: 50 }).notNull().default('fortnightly'), // weekly, fortnightly, monthly
  status:       varchar('status', { length: 50 }).notNull().default('draft'), // draft, processing, finalised, paid
  totalGross:   decimal('total_gross', { precision: 12, scale: 2 }).default('0'),
  totalNet:     decimal('total_net', { precision: 12, scale: 2 }).default('0'),
  totalTax:     decimal('total_tax', { precision: 12, scale: 2 }).default('0'),
  totalSuper:   decimal('total_super', { precision: 12, scale: 2 }).default('0'),
  employeeCount:integer('employee_count').default(0),
  notes:        text('notes'),
  createdBy:    varchar('created_by', { length: 255 }),
  finalisedBy:  varchar('finalised_by', { length: 255 }),
  finalisedAt:  timestamp('finalised_at'),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index('payroll_runs_tenant_idx').on(t.tenantId),
  statusIdx: index('payroll_runs_status_idx').on(t.status),
}))

export const payrollRunEntries = pgTable('hrms_payroll_run_entries', {
  id:              uuid('id').primaryKey().defaultRandom(),
  tenantId:        uuid('tenant_id').notNull(),
  runId:           uuid('run_id').notNull().references(() => payrollRuns.id, { onDelete: 'cascade' }),
  employeeId:      uuid('employee_id').notNull(),
  employeeNumber:  varchar('employee_number', { length: 50 }),
  firstName:       varchar('first_name', { length: 100 }),
  lastName:        varchar('last_name', { length: 100 }),
  employmentType:  varchar('employment_type', { length: 50 }),
  hoursWorked:     decimal('hours_worked', { precision: 8, scale: 2 }).default('0'),
  hourlyRate:      decimal('hourly_rate', { precision: 10, scale: 4 }).default('0'),
  ordinaryPay:     decimal('ordinary_pay', { precision: 10, scale: 2 }).default('0'),
  overtimePay:     decimal('overtime_pay', { precision: 10, scale: 2 }).default('0'),
  allowances:      decimal('allowances', { precision: 10, scale: 2 }).default('0'),
  grossPay:        decimal('gross_pay', { precision: 10, scale: 2 }).default('0'),
  paygWithholding: decimal('payg_withholding', { precision: 10, scale: 2 }).default('0'),
  medicareLevy:    decimal('medicare_levy', { precision: 10, scale: 2 }).default('0'),
  otherDeductions: decimal('other_deductions', { precision: 10, scale: 2 }).default('0'),
  superContribution:decimal('super_contribution', { precision: 10, scale: 2 }).default('0'),
  netPay:          decimal('net_pay', { precision: 10, scale: 2 }).default('0'),
  leaveAccrued:    decimal('leave_accrued', { precision: 8, scale: 4 }).default('0'),
  notes:           text('notes'),
  createdAt:       timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index('payroll_run_entries_tenant_idx').on(t.tenantId),
  runIdx:    index('payroll_run_entries_run_idx').on(t.runId),
}))

// ─── Module 44: Employee Self-Service ────────────────────────────────────────

export const essAnnouncements = pgTable('hrms_ess_announcements', {
  id:         uuid('id').primaryKey().defaultRandom(),
  tenantId:   uuid('tenant_id').notNull(),
  title:      varchar('title', { length: 255 }).notNull(),
  body:       text('body').notNull(),
  priority:   varchar('priority', { length: 50 }).notNull().default('info'), // info, warning, critical
  targetRole: varchar('target_role', { length: 100 }), // null = all roles
  publishedAt:timestamp('published_at'),
  expiresAt:  timestamp('expires_at'),
  createdBy:  varchar('created_by', { length: 255 }),
  createdAt:  timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index('ess_announcements_tenant_idx').on(t.tenantId),
}))

export const essQuickLinks = pgTable('hrms_ess_quick_links', {
  id:         uuid('id').primaryKey().defaultRandom(),
  tenantId:   uuid('tenant_id').notNull(),
  label:      varchar('label', { length: 255 }).notNull(),
  url:        varchar('url', { length: 1000 }).notNull(),
  icon:       varchar('icon', { length: 50 }),
  sortOrder:  integer('sort_order').default(0),
  createdAt:  timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index('ess_quick_links_tenant_idx').on(t.tenantId),
}))

// ─── Module 45: Reports & Analytics ──────────────────────────────────────────

export const savedReports = pgTable('hrms_saved_reports', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull(),
  name:         varchar('name', { length: 255 }).notNull(),
  reportType:   varchar('report_type', { length: 100 }).notNull(), // headcount, payroll, leave, compliance, incidents
  filters:      jsonb('filters').default({}),
  columns:      jsonb('columns').default([]),
  sortBy:       varchar('sort_by', { length: 100 }),
  sortDir:      varchar('sort_dir', { length: 10 }).default('asc'),
  isShared:     boolean('is_shared').notNull().default(false),
  createdBy:    varchar('created_by', { length: 255 }),
  lastRunAt:    timestamp('last_run_at'),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
  updatedAt:    timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx: index('saved_reports_tenant_idx').on(t.tenantId),
}))

// ─── Module 9: ESS Onboarding Portal ─────────────────────────────────────────

export const essOnboarding = pgTable('hrms_ess_onboarding', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  tenantId:           uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  employeeId:         uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  // Step 1 — Personal
  preferredName:      varchar('preferred_name', { length: 100 }),
  dateOfBirth:        date('date_of_birth'),
  gender:             varchar('gender', { length: 50 }),
  phone:              varchar('phone', { length: 20 }),
  address:            text('address'),
  // Step 2 — Tax
  tfnDeclared:        boolean('tfn_declared').notNull().default(false),
  taxResidency:       varchar('tax_residency', { length: 50 }),
  taxFreeThreshold:   boolean('tax_free_threshold').notNull().default(false),
  hasHelpDebt:        boolean('has_help_debt').notNull().default(false),
  taxFileNumber:      varchar('tax_file_number', { length: 9 }),
  // Step 3 — Super
  superFundName:      varchar('super_fund_name', { length: 255 }),
  superFundAbn:       varchar('super_fund_abn', { length: 20 }),
  superUsi:           varchar('super_usi', { length: 50 }),
  superMemberNumber:  varchar('super_member_number', { length: 100 }),
  isSmsf:             boolean('is_smsf').notNull().default(false),
  // Step 4 — Bank
  bankName:           varchar('bank_name', { length: 100 }),
  bankBsb:            varchar('bank_bsb', { length: 7 }),
  bankAccountNumber:  varchar('bank_account_number', { length: 20 }),
  bankAccountName:    varchar('bank_account_name', { length: 100 }),
  // Step 5 — Emergency contact
  emergencyName:      varchar('emergency_name', { length: 200 }),
  emergencyRelation:  varchar('emergency_relation', { length: 100 }),
  emergencyPhone:     varchar('emergency_phone', { length: 20 }),
  emergencyPhone2:    varchar('emergency_phone2', { length: 20 }),
  // Workflow
  status:             varchar('status', { length: 50 }).notNull().default('draft'),
  submittedAt:        timestamp('submitted_at'),
  reviewedBy:         varchar('reviewed_by', { length: 255 }),
  reviewedAt:         timestamp('reviewed_at'),
  hrNotes:            text('hr_notes'),
  createdAt:          timestamp('created_at').notNull().defaultNow(),
  updatedAt:          timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx:   index('ess_onboarding_tenant_idx').on(t.tenantId),
  employeeIdx: index('ess_onboarding_employee_idx').on(t.employeeId),
  uniqueIdx:   uniqueIndex('hrms_ess_onboarding_unique').on(t.tenantId, t.employeeId),
}))

// ─── Module 39: Superannuation Tracker ───────────────────────────────────────

export const superFunds = pgTable('hrms_super_funds', {
  id:               uuid('id').primaryKey().defaultRandom(),
  tenantId:         uuid('tenant_id').notNull(),
  employeeId:       uuid('employee_id').notNull(),
  fundName:         varchar('fund_name', { length: 255 }).notNull(),
  fundAbn:          varchar('fund_abn', { length: 20 }),
  usi:              varchar('usi', { length: 50 }),
  memberNumber:     varchar('member_number', { length: 100 }),
  isSmsf:           boolean('is_smsf').notNull().default(false),
  smsfBankBsb:      varchar('smsf_bank_bsb', { length: 7 }),
  smsfBankAccount:  varchar('smsf_bank_account', { length: 20 }),
  smsfEsa:          varchar('smsf_esa', { length: 255 }),
  status:           varchar('status', { length: 50 }).notNull().default('active'),
  isPrimary:        boolean('is_primary').notNull().default(true),
  effectiveFrom:    date('effective_from'),
  effectiveTo:      date('effective_to'),
  source:           varchar('source', { length: 50 }).notNull().default('employee'),
  verifiedAt:       timestamp('verified_at'),
  verifiedBy:       varchar('verified_by', { length: 255 }),
  notes:            text('notes'),
  createdAt:        timestamp('created_at').notNull().defaultNow(),
  updatedAt:        timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx:   index('super_funds_tenant_idx').on(t.tenantId),
  employeeIdx: index('super_funds_employee_idx').on(t.employeeId),
}))

export const superContributions = pgTable('hrms_super_contributions', {
  id:                  uuid('id').primaryKey().defaultRandom(),
  tenantId:            uuid('tenant_id').notNull(),
  employeeId:          uuid('employee_id').notNull(),
  superFundId:         uuid('super_fund_id').notNull(),
  periodStart:         date('period_start').notNull(),
  periodEnd:           date('period_end').notNull(),
  dueDate:             date('due_date').notNull(),
  paidDate:            date('paid_date'),
  grossEarnings:       decimal('gross_earnings', { precision: 12, scale: 2 }).notNull().default('0'),
  sgRate:              decimal('sg_rate', { precision: 5, scale: 4 }).notNull().default('0.115'),
  sgAmount:            decimal('sg_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  voluntaryAmount:     decimal('voluntary_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  totalContribution:   decimal('total_contribution', { precision: 12, scale: 2 }).notNull().default('0'),
  status:              varchar('status', { length: 50 }).notNull().default('pending'),
  paymentReference:    varchar('payment_reference', { length: 255 }),
  notes:               text('notes'),
  createdAt:           timestamp('created_at').notNull().defaultNow(),
  updatedAt:           timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx:   index('super_contributions_tenant_idx').on(t.tenantId),
  employeeIdx: index('super_contributions_employee_idx').on(t.employeeId),
}))

// ─── Module 40: Salary Review & Increment Workflow ───────────────────────────

export const salaryReviews = pgTable('hrms_salary_reviews', {
  id:                uuid('id').primaryKey().defaultRandom(),
  tenantId:          uuid('tenant_id').notNull(),
  employeeId:        uuid('employee_id').notNull(),
  reviewType:        varchar('review_type', { length: 50 }).notNull().default('annual'),
  reviewDate:        date('review_date').notNull(),
  effectiveDate:     date('effective_date'),
  currentSalary:     decimal('current_salary', { precision: 12, scale: 2 }).notNull().default('0'),
  currentBasis:      varchar('current_basis', { length: 20 }).notNull().default('annual'),
  proposedSalary:    decimal('proposed_salary', { precision: 12, scale: 2 }),
  proposedBasis:     varchar('proposed_basis', { length: 20 }),
  incrementAmount:   decimal('increment_amount', { precision: 12, scale: 2 }),
  incrementPercent:  decimal('increment_percent', { precision: 5, scale: 2 }),
  justification:     text('justification'),
  performanceRating: varchar('performance_rating', { length: 50 }),
  marketData:        text('market_data'),
  status:            varchar('status', { length: 50 }).notNull().default('draft'),
  submittedBy:       varchar('submitted_by', { length: 255 }),
  submittedAt:       timestamp('submitted_at'),
  reviewedBy:        varchar('reviewed_by', { length: 255 }),
  reviewedAt:        timestamp('reviewed_at'),
  approvedBy:        varchar('approved_by', { length: 255 }),
  approvedAt:        timestamp('approved_at'),
  rejectionReason:   text('rejection_reason'),
  hrNotes:           text('hr_notes'),
  createdAt:         timestamp('created_at').notNull().defaultNow(),
  updatedAt:         timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx:   index('salary_reviews_tenant_idx').on(t.tenantId),
  employeeIdx: index('salary_reviews_employee_idx').on(t.employeeId),
  statusIdx:   index('salary_reviews_status_idx').on(t.status),
}))

// ─── Module 42: TOIL Tracking ─────────────────────────────────────────────────

export const toilBalances = pgTable('hrms_toil_balances', {
  id:            uuid('id').primaryKey().defaultRandom(),
  tenantId:      uuid('tenant_id').notNull(),
  employeeId:    uuid('employee_id').notNull(),
  balanceHours:  decimal('balance_hours', { precision: 8, scale: 2 }).notNull().default('0'),
  totalAccrued:  decimal('total_accrued', { precision: 8, scale: 2 }).notNull().default('0'),
  totalTaken:    decimal('total_taken', { precision: 8, scale: 2 }).notNull().default('0'),
  expiryDate:    date('expiry_date'),
  updatedAt:     timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  uniqueIdx:  uniqueIndex('toil_balances_unique').on(t.tenantId, t.employeeId),
  tenantIdx:  index('toil_balances_tenant_idx').on(t.tenantId),
}))

export const toilEntries = pgTable('hrms_toil_entries', {
  id:            uuid('id').primaryKey().defaultRandom(),
  tenantId:      uuid('tenant_id').notNull(),
  employeeId:    uuid('employee_id').notNull(),
  entryType:     varchar('entry_type', { length: 20 }).notNull().default('accrual'),
  workDate:      date('work_date').notNull(),
  hours:         decimal('hours', { precision: 6, scale: 2 }).notNull(),
  multiplier:    decimal('multiplier', { precision: 4, scale: 2 }).notNull().default('1.0'),
  shiftId:       uuid('shift_id'),
  timesheetId:   uuid('timesheet_id'),
  description:   text('description'),
  status:        varchar('status', { length: 50 }).notNull().default('approved'),
  requestedAt:   timestamp('requested_at'),
  approvedBy:    varchar('approved_by', { length: 255 }),
  approvedAt:    timestamp('approved_at'),
  rejectedReason: text('rejected_reason'),
  createdBy:     varchar('created_by', { length: 255 }),
  createdAt:     timestamp('created_at').notNull().defaultNow(),
  updatedAt:     timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx:   index('toil_entries_tenant_idx').on(t.tenantId),
  employeeIdx: index('toil_entries_employee_idx').on(t.employeeId),
  dateIdx:     index('toil_entries_date_idx').on(t.workDate),
}))

// ─── Module 46: Employee Work History / Experience ───────────────────────────

export const employeeExperience = pgTable('hrms_employee_experience', {
  id:             uuid('id').primaryKey().defaultRandom(),
  tenantId:       uuid('tenant_id').notNull(),
  employeeId:     uuid('employee_id').notNull().references(() => employees.id, { onDelete: 'cascade' }),
  companyName:    varchar('company_name', { length: 255 }).notNull(),
  jobTitle:       varchar('job_title', { length: 255 }).notNull(),
  employmentType: varchar('employment_type', { length: 50 }).notNull().default('full_time'),
  startDate:      date('start_date').notNull(),
  endDate:        date('end_date'),
  isCurrent:      boolean('is_current').notNull().default(false),
  location:       varchar('location', { length: 255 }),
  description:    text('description'),
  reasonForLeaving: varchar('reason_for_leaving', { length: 255 }),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
  updatedAt:      timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx:   index('employee_experience_tenant_idx').on(t.tenantId),
  employeeIdx: index('employee_experience_employee_idx').on(t.employeeId),
}))

// ──────────────────────────────────────────────
// Module 60 — Helpdesk / Support Tickets (SLA)
// ──────────────────────────────────────────────

export const ticketPriorityEnum = pgEnum('ticket_priority', ['low', 'medium', 'high', 'critical'])
export const ticketStatusEnum   = pgEnum('ticket_status',   ['open', 'in_progress', 'pending', 'resolved', 'closed'])
export const ticketCategoryEnum = pgEnum('ticket_category', ['it', 'hr', 'payroll', 'facilities', 'compliance', 'other'])

// SLA targets in minutes by priority
// critical=4h, high=8h, medium=24h, low=72h
export const supportTickets = pgTable('hrms_support_tickets', {
  id:             uuid('id').primaryKey().defaultRandom(),
  tenantId:       uuid('tenant_id').notNull().references(() => tenants.id),
  ticketNumber:   varchar('ticket_number', { length: 30 }).notNull(),
  title:          varchar('title', { length: 255 }).notNull(),
  description:    text('description').notNull(),
  category:       ticketCategoryEnum('category').notNull().default('other'),
  priority:       ticketPriorityEnum('priority').notNull().default('medium'),
  status:         ticketStatusEnum('status').notNull().default('open'),
  submittedBy:    uuid('submitted_by').references(() => employees.id),
  assignedTo:     uuid('assigned_to').references(() => employees.id),
  slaTargetMins:  integer('sla_target_mins').notNull().default(1440), // 24h default
  slaBreached:    boolean('sla_breached').notNull().default(false),
  resolvedAt:     timestamp('resolved_at'),
  closedAt:       timestamp('closed_at'),
  firstResponseAt: timestamp('first_response_at'),
  createdAt:      timestamp('created_at').notNull().defaultNow(),
  updatedAt:      timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  tenantIdx:    index('support_tickets_tenant_idx').on(t.tenantId),
  statusIdx:    index('support_tickets_status_idx').on(t.tenantId, t.status),
  priorityIdx:  index('support_tickets_priority_idx').on(t.tenantId, t.priority),
  numberIdx:    uniqueIndex('support_tickets_number_idx').on(t.tenantId, t.ticketNumber),
}))

export const ticketComments = pgTable('hrms_ticket_comments', {
  id:         uuid('id').primaryKey().defaultRandom(),
  tenantId:   uuid('tenant_id').notNull().references(() => tenants.id),
  ticketId:   uuid('ticket_id').notNull().references(() => supportTickets.id, { onDelete: 'cascade' }),
  authorId:   uuid('author_id').references(() => employees.id),
  body:       text('body').notNull(),
  isInternal: boolean('is_internal').notNull().default(false),
  createdAt:  timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  ticketIdx: index('ticket_comments_ticket_idx').on(t.ticketId),
}))
