import mongoose from 'mongoose'

const codeforcesUserSnapshotSchema = new mongoose.Schema(
  {
    handle: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    profile: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    submissionSummary: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    recentSubmissions: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    ratingHistory: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    fetchedSubmissionCount: {
      type: Number,
      required: true,
    },
    syncedAt: {
      type: Date,
      required: true,
      default: Date.now,
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

export const CodeforcesUserSnapshot = mongoose.model(
  'CodeforcesUserSnapshot',
  codeforcesUserSnapshotSchema,
)
