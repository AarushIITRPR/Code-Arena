import mongoose from 'mongoose'

export const TRACKING_STATUSES = ['Planned', 'Attempted', 'Solved', 'Revise']
export const TRACKING_QUEUES = ['Today', 'Revision', 'Weak Topic', 'Later']
export const TRACKING_MISTAKE_TYPES = [
  'Concept gap',
  'Implementation bug',
  'Edge case missed',
  'TLE / optimization',
  'Could not derive approach',
]
export const TRACKING_CONFIDENCE_SCORES = [1, 2, 3, 4, 5]

const trackedProblemSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      enum: ['Codeforces'],
      required: true,
    },
    externalId: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    rating: {
      type: Number,
      default: null,
    },
    tags: {
      type: [String],
      default: [],
    },
    contestId: {
      type: Number,
      default: null,
    },
    problemIndex: {
      type: String,
      default: null,
      trim: true,
    },
    status: {
      type: String,
      enum: TRACKING_STATUSES,
      default: 'Planned',
    },
    queue: {
      type: String,
      enum: TRACKING_QUEUES,
      default: 'Later',
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    mistakeType: {
      type: String,
      enum: TRACKING_MISTAKE_TYPES,
      default: null,
      trim: true,
    },
    confidence: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(document, returnedObject) {
        returnedObject.id = returnedObject._id.toString()
        delete returnedObject._id
        delete returnedObject.__v
      },
    },
  },
)

trackedProblemSchema.index({ platform: 1, externalId: 1 }, { unique: true })

export const TrackedProblem = mongoose.model(
  'TrackedProblem',
  trackedProblemSchema,
)
