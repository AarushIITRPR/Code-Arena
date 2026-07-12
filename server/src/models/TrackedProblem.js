import mongoose from 'mongoose'

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
      enum: ['Planned', 'Attempted', 'Solved', 'Revise'],
      default: 'Planned',
    },
    queue: {
      type: String,
      enum: ['Today', 'Revision', 'Weak Topic', 'Later'],
      default: 'Later',
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
    mistakeType: {
      type: String,
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
