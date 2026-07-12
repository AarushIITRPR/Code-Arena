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
    syncedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
)

export const CodeforcesUserSnapshot = mongoose.model(
  'CodeforcesUserSnapshot',
  codeforcesUserSnapshotSchema,
)
